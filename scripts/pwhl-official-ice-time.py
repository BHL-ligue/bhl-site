"""Import published PWHL season TOI/GP (independent from shift reconstruction)."""
import urllib.request,urllib.parse,json,concurrent.futures,datetime,re
from pathlib import Path
from importlib.machinery import SourceFileLoader
ice=SourceFileLoader('ice',str(Path(__file__).with_name('pwhl-ice-time.py'))).load_module()
def get(task):
 season,sid,first=task
 params=dict(feed='statviewfeed',view='players',season=sid,team='all',position='skaters',statsType='standard',first=first,limit=100,sort='points',league_id=1,division=-1,rookies=0,rosterstatus='undefined',key='446521baf8c38984',client_code='pwhl',site_id=0,lang='en',callback='angular.callbacks._0')
 with urllib.request.urlopen('https://lscluster.hockeytech.com/feed/index.php?'+urllib.parse.urlencode(params),timeout=30) as r:body=r.read().decode('utf-8-sig')
 m=re.match(r'^\s*[\w.$]+\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$',body);data=json.loads(m.group(1) if m else body)
 return season,[row['row'] for group in data for section in group.get('sections',[]) for row in section.get('data',[])]
def main():
 tasks=[(s,sid,first) for s,sid in [('2024',1),('2024-25',5),('2025-26',8)] for first in [0,100,200]];out={'source':'Official PWHL HockeyTech published TOI/GP season totals','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seasons':{}}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for season,rows in pool.map(get,tasks):
   for p in rows:
    avg=ice.seconds(p.get('ice_time_per_game_avg'));total=ice.seconds(p.get('ice_time_minutes_seconds'));gp=int(p['games_played']);pid=str(p['player_id']);existing=out['seasons'].setdefault(season,{})
    if pid in existing:raise ValueError('Duplicate player in official totals')
    existing[pid]={'gp':gp,'toi_avg_seconds':avg,'toi_total_seconds':total,'name':p['name']}
 Path('data/pwhl-official-ice-time.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n');print({s:len(p) for s,p in out['seasons'].items()},flush=True)
if __name__=='__main__':main()
