"""Read-only season audit. Reconstructed points remain provisional until reconciled.
Reads public Fantrax lineups and NHL reports; never changes official scores.
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
REVIEWED_ALIASES={'03rfp':['Samuel Montembeault'],'06snb':['Ben Kindel'],'042xv':['Michael Eyssimont'],'03rfo':['Dan Vladar'],'04ajl':['Bo Groulx'],'004jg':['Patrick Maroon'],'01uor':['Chris Tanev'],'02oax':['Vincent Hinostroza'],'02ob1':['Matthew Benning'],'03edx':['Samuel Blais'],'03eer':['Jacob Middleton'],'03rg2':['William Borgen'],'03rga':['Mikhail Vorobyov'],'03w5q':['Joseph Veleno'],'042xm':['Maxime Lajoie'],'04zb8':['Philip Tomasino'],'051tm':['Zac Jones'],'06iml':['Max Tsyplakov'],'031oi':['Zachary Sanford']}
HISTORICAL_NHL_IDS={'06iml':'8484958'} # Maxim Tsyplakov; NHL ID independently verified
NHL_SEASON_ID='20252026'
REPORTS=[('skater','summary'),('skater','realtime'),('skater','faceoffwins'),('goalie','summary')]
def get(url):
 request=urllib.request.Request(url,headers={'User-Agent':'BHL-Sync/1.0','Accept':'application/json'})
 with urllib.request.urlopen(request,timeout=35) as response:return json.load(response)
def key(name):return ''.join(c for c in unicodedata.normalize('NFD',str(name or '')).lower() if c.isalnum() and not unicodedata.combining(c))
def number(row,category):
 for field in FIELDS[category]:
  if row and row.get(field) is not None:return float(row[field])
 return None
def nhl_report(kind,name,start=None,end=None,season_id=None):
 expr='gameTypeId=2 and seasonId='+(season_id or NHL_SEASON_ID)
 if start:expr+=f' and gameDate>="{start}" and gameDate<="{end}"'
 url='https://api.nhle.com/stats/rest/en/'+kind+'/'+name+'?'+urllib.parse.urlencode({'isAggregate':'true','isGame':'true','start':0,'limit':-1,'cayenneExp':expr})
 data=get(url);rows=data.get('data',[])
 if data.get('total')!=len(rows):raise ValueError('Incomplete NHL report '+kind+'/'+name)
 ids=[str(r['playerId']) for r in rows]
 if len(ids)!=len(set(ids)):raise ValueError('Multiple NHL rows per player require explicit aggregation')
 return rows
def date_window(period,schedules):
 """Reject a boundary day containing games on both sides of the cutoff."""
 start=dt.datetime.fromisoformat(period['start']);end=dt.datetime.fromisoformat(period['end'])
 first=start.date();last=end.date()
 for boundary,is_start in [(start,True),(end,False)]:
  date=boundary.date().isoformat();data=schedules[date]
  day=next((d for d in data.get('gameWeek',[]) if d.get('date')==date),None)
  if day is None:raise ValueError('NHL schedule date missing: '+date)
  games=[g for g in day.get('games',[]) if g.get('gameType')==2]
  times=[dt.datetime.fromisoformat(g['startTimeUTC'].replace('Z','+00:00')) for g in games]
  included=[t>=boundary if is_start else t<=boundary for t in times]
  if included and any(included) and not all(included):raise ValueError('Split NHL game day at Fantrax boundary: '+date)
  if included and not any(included):
   if is_start:first+=dt.timedelta(days=1)
   else:last-=dt.timedelta(days=1)
 if first>last:raise ValueError('Empty calendar window')
 return first.isoformat(),last.isoformat()
def confirmed_identities(current,historical):
 """Use verified historic identities, preserving confirmed current mappings."""
 identities={pid:p for pid,p in historical.items() if p.get('status')=='confirmed' and p.get('nhlId')}
 for pid,p in current.items():
  if p.get('status')=='confirmed' and p.get('nhlId'):identities[pid]=p
 return identities
def resolve_id(pid,position,directory,identities,season_rows):
 identity=identities.get(pid,{})
 if identity.get('status')=='confirmed' and identity.get('nhlId'):return str(identity['nhlId']),'existing_confirmed_id'
 if pid in HISTORICAL_NHL_IDS:return HISTORICAL_NHL_IDS[pid],'unique_name_across_nhl_seasons'
 names={key(n) for n in [directory[pid].get('name'),*directory[pid].get('aliases',[]),*REVIEWED_ALIASES.get(pid,[])] if n}
 kind='goalie' if position=='G' else 'skater'
 matches={str(r['playerId']) for r in season_rows[kind] if key(r.get('skaterFullName') or r.get('goalieFullName')) in names}
 return (next(iter(matches)),'unique_official_season_name') if len(matches)==1 else (None,'unresolved')
def official_scores(data,allow_partial=False):
 if data.get('matchups')==[]:return {}
 official={}
 for matchup in data.get('matchups',[]):
  for side in ['away','home']:
   team=matchup[side];tid=team['teamId'];points=float(team['score']);categories={};values={}
   for category in matchup.get('categories',[]):
    code=category['shortName'];categories[code]=categories.get(code,0)+float(category.get(side,{}).get('points',0));values[code]=values.get(code,0)+float(category.get(side,{}).get('value',0))
   if tid in official and official[tid]['points']!=points:raise ValueError('Inconsistent official team scores')
   official[tid]={'points':points,'categoryPoints':categories,'categoryValues':values}
 if (not allow_partial and len(official)!=16) or not 1<=len(official)<=16:raise ValueError('Incomplete Fantrax team scores')
 return official
def calculate(period,archive,directory,identities,season_rows,raw,official):
 n=period['number'];indexed={job:{str(r['playerId']):r for r in rows} for job,rows in raw.items()};configs={}
 for group in archive['scoring']['settings']:
  group_kind='goalie' if group.get('group',{}).get('code')=='HOCKEY_GOALIE' else 'skater'
  for config in group.get('configs',[]):
   category=config.get('scoringCategory',{}).get('shortName');pos=config.get('position',{}).get('shortName');points=config.get('points')
   if category and pos and points is not None:configs[(group_kind,category,pos)]=float(points)
 teams={tid:{'teamId':tid,'team':team['name'],'official':official[tid]['points'],'officialCategoryPoints':official[tid]['categoryPoints'],'officialCategoryValues':official[tid].get('categoryValues',{}),'calculatedCategoryPoints':{},'calculated':0,'unresolved':[],'players':[]} for tid,team in archive['teams'].items() if tid in official}
 for pid,spans in archive['lineups'].items():
  span=next((s for s in spans if s[0]<=n<=s[1]),None)
  if not span or span[3]!='ACTIVE':continue
  _,_,tid,status,pos=span
  if tid not in teams:continue
  name=directory[pid]['name'];kind='goalie' if pos=='G' else 'skater';summary=indexed[(kind,'summary')]
  nhl_id,evidence=resolve_id(pid,pos,directory,identities,season_rows)
  player={'fantraxId':pid,'name':name,'position':pos,'nhlId':nhl_id,'identityEvidence':evidence,'stats':{},'categoryPoints':{},'points':None}
  if not nhl_id:player['error']='NHL identity not confirmed'
  else:
   categories=['W','GA','SV','SHO','G','A'] if kind=='goalie' else ['G','A','SOG','Hit','Blk','Tk','FOW']
   no_games=nhl_id not in summary;player['gamesPlayed']=0 if no_games else summary[nhl_id].get('gamesPlayed')
   for category in categories:
    weight=configs.get((kind,category,pos),configs.get((kind,category,'Default'),0))
    if no_games:value=0
    elif kind=='goalie' or category in ['G','A','SOG']:value=number(summary.get(nhl_id),category)
    elif category=='FOW':value=number(indexed[('skater','faceoffwins')].get(nhl_id),category)
    else:value=number(indexed[('skater','realtime')].get(nhl_id),category)
    if value is None and weight==0:value=0
    player['stats'][category]=value
    if value is not None:player['categoryPoints'][category]=round(value*weight,4)
   if all(v is not None for v in player['stats'].values()):player['points']=round(sum(player['categoryPoints'].values()),4)
   else:player['error']='NHL statistical category missing'
  team=teams[tid];team['players'].append(player)
  if player['points'] is None:team['unresolved'].append(pid)
  else:
   team['calculated']+=player['points']
   for c,v in player['categoryPoints'].items():team['calculatedCategoryPoints'][c]=team['calculatedCategoryPoints'].get(c,0)+v
 for team in teams.values():
  team['calculated']=round(team['calculated'],4);team['difference']=round(team['calculated']-team['official'],4) if not team['unresolved'] else None
  team['categoryDifferences']={c:round(team['calculatedCategoryPoints'].get(c,0)-team['officialCategoryPoints'].get(c,0),4) for c in team['calculatedCategoryPoints'].keys()|team['officialCategoryPoints'].keys() if abs(team['calculatedCategoryPoints'].get(c,0)-team['officialCategoryPoints'].get(c,0))>=0.005}
  team['validated']=not team['unresolved'] and abs(team['difference'])<0.005 and not team['categoryDifferences']
 return list(teams.values())
def main(season='2025-26',completed_only=False):
 global NHL_SEASON_ID
 year=int(season[:4]);NHL_SEASON_ID=str(year)+str(year+1)
 report={'status':'pending','season':season,'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'scope':'Read-only season audit of starting-lineup contributions, not official individual records or a career ranking.'}
 try:
  archive=json.loads((ROOT/('data/ownership/'+season+'.json')).read_text());
  report['archivedPeriods']=len(archive['periods']);report['excludedOpenPeriods']=[]
  if completed_only:
   now=dt.datetime.now(dt.timezone.utc);report['excludedOpenPeriods']=[p['number'] for p in archive['periods'] if dt.datetime.fromisoformat(p['end'])>now];archive['periods']=[p for p in archive['periods'] if dt.datetime.fromisoformat(p['end'])<=now]
  directory=json.loads((ROOT/'data/ownership/players.json').read_text())['players'];identities=confirmed_identities(json.loads((ROOT/'data/player-identity-map.json').read_text())['players'],json.loads((ROOT/'data/historical-player-identities.json').read_text()).get('players',{}))
  with cf.ThreadPoolExecutor(max_workers=4) as pool:
   names=list(pool.map(lambda kind:(kind,nhl_report(kind,'summary')),['skater','goalie']));season_rows=dict(names)
   dates=sorted({p[k][:10] for p in archive['periods'] for k in ['start','end']})
   schedules=dict(pool.map(lambda date:(date,get('https://api-web.nhle.com/v1/schedule/'+date)),dates))
  report['periods']=[];info=get('https://www.fantrax.com/fxea/general/getLeagueInfo?leagueId='+archive['leagueId']+'&excludePlayerInfo=true');first_playoff=info.get('playoffs',{}).get('firstPlayoffPeriod')
  def audit_period(period):
   n=period['number'];result={'period':n,'phase':'playoffs' if first_playoff and n>=first_playoff else 'regular','start':period['start'],'end':period['end']}
   try:
    if not period['available']:raise ValueError('Roster archive missing')
    start,end=date_window(period,schedules);result['nhlDateStart']=start;result['nhlDateEnd']=end
    raw={job:nhl_report(*job,start,end) for job in REPORTS}
    scores=get('https://www.fantrax.com/fxea/general/getMatchupScores?leagueId='+archive['leagueId']+'&period='+str(n))
    if scores.get('period')!=n:raise ValueError('Wrong Fantrax scoring period')
    official=official_scores(scores,allow_partial=result['phase']=='playoffs');result['competingTeams']=len(official);result['notInMatchups']=[tid for tid in archive['teams'] if tid not in official]
    result['teams']=calculate(period,archive,directory,identities,season_rows,raw,official);result['validatedTeams']=sum(t['validated'] for t in result['teams']);result['status']='not_scheduled' if not official else 'validated' if result['validatedTeams']==result['competingTeams'] else 'needs_review'
   except Exception as error:result['status']='blocked';result['error']=type(error).__name__+': '+str(error)
   print('AUDIT_PERIOD',json.dumps({k:v for k,v in result.items() if k!='teams'},ensure_ascii=False),flush=True)
   return result
  with cf.ThreadPoolExecutor(max_workers=3) as pool:report['periods']=sorted(pool.map(audit_period,archive['periods']),key=lambda p:p['period'])
  report['totalPeriods']=len(report['periods']);report['checkedPeriods']=sum('teams' in p for p in report['periods']);report['validatedPeriods']=sum(p['status']=='validated' for p in report['periods']);report['validatedTeamPeriods']=sum(p.get('validatedTeams',0) for p in report['periods']);report['teamPeriods']=sum(p.get('competingTeams',16 if p['phase']=='regular' else 0) for p in report['periods']);report['status']='validated_season' if report['checkedPeriods']==report['totalPeriods'] and report['validatedTeamPeriods']==report['teamPeriods'] else 'needs_review'
  report['remaining']=[{'period':p['period'],'team':t['team'],'difference':t['difference'],'unresolved':t['unresolved'],'categories':t['categoryDifferences']} for p in report['periods'] for t in p.get('teams',[]) if not t['validated']]
 except Exception as error:report['status']='blocked';report['error']=type(error).__name__+': '+str(error)
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print('AUDIT_SUMMARY',json.dumps({k:v for k,v in report.items() if k not in ['periods','remaining']},ensure_ascii=False),flush=True)
 for row in report.get('remaining',[]):print('AUDIT_REMAINING',json.dumps(row,ensure_ascii=False),flush=True)
 return report
if __name__=='__main__':main()
