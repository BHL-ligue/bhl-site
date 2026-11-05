import json,concurrent.futures,sys
from pathlib import Path
import urllib.request,urllib.parse,re
class Feed:
 def request(self,feed,view,**params):
  query=urllib.parse.urlencode(dict(feed=feed,view=view,key="446521baf8c38984",client_code="pwhl",site_id=0,lang="en",callback="angular.callbacks._0",**params))
  with urllib.request.urlopen("https://lscluster.hockeytech.com/feed/index.php?"+query,timeout=25) as r:body=r.read().decode("utf-8-sig")
  match=re.match(r"^\s*[\w.$]+\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$",body)
  return json.loads(match.group(1) if match else body)
p=Feed()
def get(args):
 season,tid=args
 try:
  x=p.request('modulekit','roster',season_id=season,team_id=tid)['SiteKit']['Roster'];return season,tid,[r for r in x if isinstance(r,dict) and r.get('player_id')]
 except Exception as e:raise RuntimeError(f'Roster {args} unavailable') from e
# Archive membership is labeled by its season, never presented as a current roster.
tasks=[(s,t['id']) for s in [1,5,8] for t in p.request('modulekit','teamsbyseason',season_id=8)['SiteKit']['Teamsbyseason'] if s==8 or t['id'] not in ['8','9']]
rows=list(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(get,tasks));profiles={}
for season,tid,roster in sorted(rows):
 for r in roster:
  pid=str(r['player_id']);profiles[pid]={'id':pid,'name':r.get('name') or (r.get('first_name','')+' '+r.get('last_name','')),'photo':r.get('player_image'),'position':r.get('position'),'birthdate':r.get('birthdate'),'height':r.get('height'),'shoots':r.get('shoots'),'birthplace':r.get('birthplace'),'country':r.get('birthcntry'),'team':r.get('team_name'),'teamSeason':{1:'2024',5:'2024-25',8:'2025-26'}[season],'source':'PWHL / HockeyTech roster','sourceSeasonId':season}
Path('data/pwhl-player-profiles.json').write_text(json.dumps({'source':'Official PWHL HockeyTech roster feed','profiles':profiles},ensure_ascii=False,separators=(',',':'))+'\n');print('PROFILES',len(profiles),flush=True)
