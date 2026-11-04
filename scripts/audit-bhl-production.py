"""Read-only pilot: compare reconstructed starter points against Fantrax team scores.
Never publishes a career ranking; missing identities/stats prevent validation.
"""
import concurrent.futures as cf
import datetime as dt
import json
from pathlib import Path
import unicodedata
import urllib.parse
import urllib.request
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/ownership/production-pilot.json'
FIELDS={'G':['goals'],'A':['assists'],'SOG':['shots','shotsOnGoal'],'Hit':['hits'],'Blk':['blockedShotAttempts','blockedShots'],'Tk':['takeaways'],'FOW':['faceoffWins','faceoffsWon','totalFaceoffWins','faceoffsWonTotal','totalFaceoffsWon'],'W':['wins'],'GA':['goalsAgainst'],'SV':['saves'],'SHO':['shutouts']}
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'BHL-Sync/1.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=30) as response:return json.load(response)
def key(name):return ''.join(c for c in unicodedata.normalize('NFD',str(name or '')).lower() if c.isalnum() and not unicodedata.combining(c))
def number(row,category):
 for field in FIELDS[category]:
  if row and row.get(field) is not None:return float(row[field])
 return None
def main():
 report={'status':'pending','season':'2025-26','period':1,'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'scope':'Pilot only: starting lineup, NHL regular-season games 2025-10-07 through 2025-10-12. Not a validated career ranking.'}
 try:
  archive=json.loads((ROOT/'data/ownership/2025-26.json').read_text());directory=json.loads((ROOT/'data/ownership/players.json').read_text())['players'];identities=json.loads((ROOT/'data/player-identity-map.json').read_text())['players']
  period=archive['periods'][0]
  # This pilot has its own explicitly inspected boundary before Monday's first game.
  if period['number']!=1 or not period['start'].startswith('2025-10-07') or not period['end'].startswith('2025-10-13T12:29:59'):raise ValueError('Pilot date boundary changed; inspect the NHL schedule before computing')
  expr='gameTypeId=2 and seasonId=20252026 and gameDate>="2025-10-07" and gameDate<="2025-10-12"'
  jobs=[('skater','summary'),('skater','realtime'),('skater','faceoffwins'),('goalie','summary')]
  def fetch_report(job):
   kind,name=job;url='https://api.nhle.com/stats/rest/en/'+kind+'/'+name+'?'+urllib.parse.urlencode({'isAggregate':'true','isGame':'true','start':0,'limit':-1,'cayenneExp':expr});data=get(url)
   if data.get('total')!=len(data.get('data',[])):raise ValueError('Incomplete NHL report '+kind+'/'+name)
   return job,data['data']
  with cf.ThreadPoolExecutor(max_workers=4) as pool:raw=dict(pool.map(fetch_report,jobs))
  indexed={job:{str(r['playerId']):r for r in rows} for job,rows in raw.items()}
  if any(len(indexed[job])!=len(rows) for job,rows in raw.items()):raise ValueError('NHL report contains multiple rows per player; aggregate them explicitly')
  report['reports']={kind+'/'+name:{'rows':len(rows),'fields':sorted(rows[0]) if rows else []} for (kind,name),rows in raw.items()}
  scores=get('https://www.fantrax.com/fxea/general/getMatchupScores?leagueId='+archive['leagueId']+'&period=1');official={}
  for matchup in scores.get('matchups',[]):
   for side in ['away','home']:
    team=matchup[side];tid=team['teamId'];value=float(team['score'])
    if tid in official and official[tid]!=value:raise ValueError('Inconsistent Fantrax team scores')
    official[tid]=value
  if len(official)!=16:raise ValueError('Incomplete Fantrax team scores')
  configs={}
  for group in archive['scoring']['settings']:
   for config in group.get('configs',[]):
    category=config.get('scoringCategory',{}).get('shortName');pos=config.get('position',{}).get('shortName');points=config.get('points')
    if category and pos and points is not None:configs[(category,pos)]=float(points)
  team_results={tid:{'team':t['name'],'official':official.get(tid),'calculated':0,'unresolved':[],'players':[]} for tid,t in archive['teams'].items()}
  for pid,spans in archive['lineups'].items():
   span=next((s for s in spans if s[0]<=1<=s[1]),None)
   if not span or span[3]!='ACTIVE':continue
   _,_,tid,status,pos=span;name=directory[pid]['name'];goalie=pos=='G';kind='goalie' if goalie else 'skater';summary=indexed[(kind,'summary')];identity=identities.get(pid,{})
   nhl_id=str(identity.get('nhlId') or '') if identity.get('status')=='confirmed' else ''
   if not nhl_id:
    matches=[str(r['playerId']) for r in raw[(kind,'summary')] if key(r.get('skaterFullName') or r.get('goalieFullName'))==key(name)]
    if len(matches)==1:nhl_id=matches[0]
   row={'fantraxId':pid,'name':name,'position':pos,'nhlId':nhl_id or None,'stats':{},'points':None}
   if not nhl_id:row['error']='NHL identity not confirmed for this pilot'
   else:
    categories=['W','GA','SV','SHO','G','A'] if goalie else ['G','A','SOG','Hit','Blk','Tk','FOW']
    no_games=nhl_id not in summary;row['gamesPlayed']=0 if no_games else summary[nhl_id].get('gamesPlayed')
    for category in categories:
     weight=configs.get((category,pos),configs.get((category,'Default'),0))
     if weight==0 or no_games:value=0
     elif goalie or category in ['G','A','SOG']:value=number(summary.get(nhl_id),category)
     elif category=='FOW':value=number(indexed[('skater','faceoffwins')].get(nhl_id),category)
     else:value=number(indexed[('skater','realtime')].get(nhl_id),category)
     row['stats'][category]=value
    if all(v is not None for v in row['stats'].values()):row['points']=round(sum(v*configs.get((c,pos),configs.get((c,'Default'),0)) for c,v in row['stats'].items()),4)
    else:row['error']='NHL statistical category missing'
   team_results[tid]['players'].append(row)
   if row['points'] is None:team_results[tid]['unresolved'].append(pid)
   else:team_results[tid]['calculated']+=row['points']
  for result in team_results.values():
   result['calculated']=round(result['calculated'],4);result['difference']=round(result['calculated']-result['official'],4) if not result['unresolved'] else None;result['validated']=not result['unresolved'] and abs(result['difference'])<0.005
  report['teams']=list(team_results.values());report['validatedTeams']=sum(t['validated'] for t in report['teams']);report['status']='validated_pilot' if report['validatedTeams']==16 else 'needs_review'
 except Exception as error:report['status']='blocked';report['error']=type(error).__name__+': '+str(error)
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['teams','reports']},ensure_ascii=False))
if __name__=='__main__':main()
