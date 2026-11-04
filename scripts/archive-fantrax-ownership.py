"""Archive read-only Fantrax roster snapshots, preserving gaps and historical team names."""
import argparse
import csv
import io
import concurrent.futures as cf
import datetime as dt
import json
from pathlib import Path
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/tmp/bhl-ownership')
LEAGUES={2018:'vwa89uoajhz15dxv',2019:'2uolurhgjv9p9ryl',2020:'x84a2ac9kb7zbs0w',2021:'o981oceokoydzrkt',2022:'xekefw5vl2q74pi9',2023:'ukw6z6r2lgjl09qn',2024:'jdltul4alva6m2x8',2025:'xawnq4p0m9n3ikmo',2026:'32q8rjpomo2tig1z'}

def fetch(method,league,period=None):
 url=('https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL' if method=='getPlayerIds' else f'https://www.fantrax.com/fxea/general/{method}?leagueId={league}'+(f'&period={period}' if period is not None else ''))
 request=urllib.request.Request(url,headers={'User-Agent':'BHL-Sync/1.0','Accept':'application/json'})
 for attempt in range(2):
  try:
   with urllib.request.urlopen(request,timeout=22) as response:data=json.load(response)
   if not isinstance(data,dict) or data.get('error') or data.get('errors'):raise ValueError('Invalid Fantrax response')
   return data
  except Exception:
   if attempt:raise
   time.sleep(1)

def get_info(year,league):
 file=CACHE/f'{year}-info.json'
 if file.exists() and year!=max(LEAGUES):data=json.loads(file.read_text())
 else:data=fetch('getLeagueInfo',league);file.write_text(json.dumps(data))
 if data.get('seasonYear')!=year:raise ValueError(f'Unexpected season for {year}')
 print(f'SEASON {year}: {len(data["rosterPeriods"])} roster periods',flush=True)
 return year,data

def get_period(job):
 year,league,number=job;file=CACHE/f'{year}-period{number}.json'
 try:
  if file.exists() and year!=max(LEAGUES):data=json.loads(file.read_text())
  else:data=fetch('getTeamRosters',league,number)
  if data.get('period')!=number or len(data.get('rosters',{}))!=16:raise ValueError('Incomplete or wrong period')
  seen=set()
  for team in data['rosters'].values():
   for player in team['rosterItems']:
    pid=str(player['id']).replace('*','')
    if pid in seen:raise ValueError(f'Duplicate player {pid}')
    seen.add(pid)
  file.write_text(json.dumps(data))
  return year,number,data,None
 except Exception as error:return year,number,None,str(error)

def compress(periods,snapshots):
 """Only join numerically adjacent, successfully retrieved periods."""
 result={}
 for p in periods:
  number=p['number'];snapshot=snapshots.get(number)
  if snapshot is None:continue
  for tid,team in snapshot['rosters'].items():
   for player in team['rosterItems']:
    pid=str(player['id']).replace('*','');spans=result.setdefault(pid,[])
    if spans and spans[-1][2]==tid and spans[-1][1]==number-1:spans[-1][1]=number
    else:spans.append([number,number,tid])
 return result

def compress_lineups(periods,snapshots):
 result={}
 for p in periods:
  number=p['number'];snapshot=snapshots.get(number)
  if snapshot is None:continue
  for tid,team in snapshot['rosters'].items():
   for player in team['rosterItems']:
    pid=str(player['id']).replace('*','');spans=result.setdefault(pid,[])
    fields=[tid,player.get('status'),player.get('position')]
    if spans and spans[-1][2:]==fields and spans[-1][1]==number-1:spans[-1][1]=number
    else:spans.append([number,number,*fields])
 return result

def build_names(out):
 ids=set();seasons={}
 for file in out.glob('*.json'):
  archive=json.loads(file.read_text());ids.update(archive.get('ownership',{}))
  for pid in archive.get('ownership',{}):seasons.setdefault(pid,[]).append(archive['season'])
 previous=json.loads((out/'players.json').read_text()).get('players',{}) if (out/'players.json').exists() else {}
 file=CACHE/'player-names.json'
 source=json.loads(file.read_text()) if file.exists() else fetch('getPlayerIds','')
 drafts={};draft_aliases={}
 try:
  draft_file=CACHE/'drafts.csv'
  if draft_file.exists():draft_text=draft_file.read_text()
  else:
   with urllib.request.urlopen('https://docs.google.com/spreadsheets/d/1KtgVk6viZc6wMMKoxBhbUgL6JkjuwuMTyfNH173XWUc/gviz/tq?tqx=out:csv&sheet=DRAFTS',timeout=22) as response:draft_text=response.read().decode('utf-8')
  for row in sorted(csv.DictReader(io.StringIO(draft_text)),key=lambda r:r.get('Année','')):
   pid=row.get('Player ID','').replace('*','').strip();name=row.get('Player','').strip()
   if pid and name:drafts[pid]=name;draft_aliases.setdefault(pid,set()).add(name)
 except Exception as error:print('Draft identity supplement unavailable: '+str(error),flush=True)
 current_file=ROOT/'data/fantrax.json' 
 live=json.loads(current_file.read_text()) if current_file.exists() else {}
 current={str(p['id']).replace('*',''):p['name'] for t in live.get('teams',[]) for p in t['players']}
 players={};missing=[]
 for pid in sorted(ids):
  raw=source.get(pid,{})
  full=str(raw.get('name','')).strip()
  if ',' in full:
   last,first=full.split(',',1);full=first.strip()+' '+last.strip()
  old_name=previous.get(pid,{}).get('name')
  if old_name and old_name.startswith('Joueur Fantrax '):old_name=None
  name=current.get(pid) or full or drafts.get(pid) or old_name
  if not name:missing.append(pid)
  aliases=set(previous.get(pid,{}).get('aliases',[]))|draft_aliases.get(pid,set())
  aliases.update(n for n in [name,full,raw.get('name')] if n)
  players[pid]={'name':name,'aliases':sorted(a for a in aliases if a!=name and not a.startswith('Joueur Fantrax ')),'status':'confirmed' if name else 'unresolved','seasons':sorted(seasons.get(pid,[]),reverse=True)}
 (out/'players.json').write_text(json.dumps({'schemaVersion':1,'unresolvedIds':missing,'players':players},ensure_ascii=False,separators=(',',':'))+'\n')
 print(f'IDENTITIES {len(players)}; unnamed {len(missing)}',flush=True)
 if missing:print('Unnamed IDs: '+','.join(missing),flush=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--current',action='store_true',help='Refresh only the current season, retaining earlier archives');args=parser.parse_args()
 selected={max(LEAGUES):LEAGUES[max(LEAGUES)]} if args.current else LEAGUES
 CACHE.mkdir(exist_ok=True);out=ROOT/'data/ownership';out.mkdir(parents=True,exist_ok=True)
 with cf.ThreadPoolExecutor(max_workers=4) as pool:infos=dict(pool.map(lambda item:get_info(*item),selected.items()))
 now=dt.datetime.now(dt.timezone.utc)
 jobs=[];periods={}
 for year,info in infos.items():
  periods[year]=[p for p in info['rosterPeriods'] if dt.datetime.fromisoformat(p['startDate'])<=now]
  jobs.extend((year,LEAGUES[year],p['number']) for p in periods[year])
 snapshots={year:{} for year in selected};errors={year:[] for year in selected}
 with cf.ThreadPoolExecutor(max_workers=4) as pool:
  futures=[pool.submit(get_period,j) for j in jobs]
  for future in cf.as_completed(futures):
   year,number,data,error=future.result()
   if error:errors[year].append(number);print(f'GAP {year}/{number}: {error}',flush=True)
   else:snapshots[year][number]=data
   if sum(map(len,snapshots.values()))%20==0:print(f'FETCHED {sum(map(len,snapshots.values()))}/{len(jobs)}',flush=True)
 if args.current and errors[max(selected)]:raise ValueError('Current season refresh incomplete; keeping the previous archive')
 previous=json.loads((out/'index.json').read_text()) if (out/'index.json').exists() else {'seasons':[]}
 manifest={'schemaVersion':1,'source':'Fantrax getTeamRosters / getLeagueInfo','updatedAt':now.isoformat(),'seasons':[s for s in previous['seasons'] if int(s['season'][:4]) not in selected]}
 for year in sorted(selected,reverse=True):
  season=f'{year}-{str(year+1)[-2:]}';teams={}
  for number in sorted(snapshots[year]):
   for tid,team in snapshots[year][number]['rosters'].items():
    if tid in teams and teams[tid]['name']!=team['teamName']:raise ValueError('Team name changed inside archive')
    teams[tid]={'name':team['teamName']}
  archive={'schemaVersion':1,'season':season,'leagueId':LEAGUES[year],'retrievedAt':now.isoformat(),'periods':[{'number':p['number'],'start':p['startDate'],'end':p['endDate'],'available':p['number'] in snapshots[year]} for p in periods[year]],'teams':teams,'ownership':compress(periods[year],snapshots[year]),'lineups':compress_lineups(periods[year],snapshots[year]),'scoring':{'categories':infos[year].get('scoringSystem',{}).get('scoringCategories',{}),'settings':infos[year].get('scoringSystem',{}).get('scoringCategorySettings',[])},'missingPeriods':sorted(errors[year])}
  file=f'{season}.json';(out/file).write_text(json.dumps(archive,ensure_ascii=False,separators=(',',':'))+'\n')
  manifest['seasons'].append({'season':season,'leagueId':LEAGUES[year],'file':file,'periods':len(periods[year]),'availablePeriods':len(snapshots[year]),'players':len(archive['ownership']),'missingPeriods':archive['missingPeriods']})
 manifest['seasons'].sort(key=lambda s:s['season'],reverse=True)
 (out/'index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 build_names(out)
 print(json.dumps(manifest,indent=2),flush=True)
if __name__=='__main__':main()
