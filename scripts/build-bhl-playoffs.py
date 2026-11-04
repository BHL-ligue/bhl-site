"""Archive official Fantrax playoff matchups; never infer cancelled rounds."""
import concurrent.futures as cf
import datetime as dt
import json
from pathlib import Path
import urllib.request
ROOT=Path(__file__).resolve().parents[1]
CHAMPIONS={2019:('Minnesota North Stars','MIN'),2021:('Nashville Predators','NSH'),2022:('Montréal Canadiens','MTL'),2023:('Hartford Whalers','HAR'),2024:('Anaheim Mighty Ducks','ANA'),2025:('Detroit Red Wings','DET'),2026:('Ottawa Senators','OTT')}
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'BHL-Archives/1.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=45) as r:return json.load(r)
def build(path):
 a=json.loads(path.read_text());season=a['season'];year=int(season[:4])+1
 if year>2026:return None
 champion=CHAMPIONS.get(year)
 item={'season':season,'leagueId':a['leagueId'],'champion':champion[0] if champion else None,'banner':f'banners/Banner{champion[1]}{year}.png' if champion else None,'cancelled':year==2020,'rounds':[]}
 try:
  base='https://www.fantrax.com/fxea/general/'
  info=get(base+'getLeagueInfo?leagueId='+a['leagueId']+'&excludePlayerInfo=true')
  first=info.get('playoffs',{}).get('firstPlayoffPeriod')
  if not first:raise ValueError('Première période de séries indisponible')
  for index in range(2 if year==2020 else 3):
   period=first+index
   raw=get(base+'getMatchupScores?leagueId='+a['leagueId']+'&period='+str(period))
   if raw.get('period')!=period:raise ValueError('Mauvaise période')
   matches=[];seen=set()
   for m in raw.get('matchups',[]):
    sides=[m['away'],m['home']];key=tuple(sorted(s['teamId'] for s in sides))
    if key in seen:continue
    seen.add(key)
    teams=[{'id':s['teamId'],'name':a['teams'].get(s['teamId'],{}).get('name',s.get('teamName','Équipe inconnue')),'score':float(s['score'])} for s in sides]
    winner=None if (year==2020 and index==1) or teams[0]['score']==teams[1]['score'] else max(teams,key=lambda t:t['score'])['id']
    matches.append({'teams':teams,'winner':winner})
   expected=[4,2,1][index]
   if len(matches)!=expected:raise ValueError(f'Nombre inattendu de duels : {len(matches)} au lieu de {expected}')
   dates=next((p for p in a['periods'] if p['number']==period),{})
   item['rounds'].append({'number':index+1,'period':period,'start':dates.get('start'),'end':dates.get('end'),'interrupted':year==2020 and index==1,'matches':matches})
  if champion:
   final=item['rounds'][-1]['matches'][0]
   winning=next((t for t in final['teams'] if t['id']==final['winner']),None)
   if not winning or winning['name'].replace('Montréal Maroons','Montréal Canadiens')!=champion[0]:raise ValueError('La finale Fantrax ne correspond pas à la bannière BHL')
  item['status']='available'
 except Exception as e:
  item['status']='partial' if item['rounds'] else 'unavailable';item['error']=str(e)
 return item
if __name__=='__main__':
 with cf.ThreadPoolExecutor(max_workers=4) as pool:seasons=[s for s in pool.map(build,sorted((ROOT/'data/ownership').glob('20??-??.json'))) if s]
 out={'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':'Pointages officiels des affrontements Fantrax; bannières de champions BHL. Saison 2019-20 : arrêt en deuxième ronde confirmé par la ligue.','seasons':sorted(seasons,key=lambda s:s['season'],reverse=True)}
 dest=ROOT/'data/playoffs.json'
 if dest.exists():
  previous={s['season']:s for s in json.loads(dest.read_text())['seasons']}
  for i,s in enumerate(out['seasons']):
   old=previous.get(s['season'])
   if s['status']!='available' and old and old.get('status')=='available':out['seasons'][i]=old
 dest.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 print([(s['season'],s['status'],len(s['rounds'])) for s in out['seasons']])
