"""PWHL ice time reconstructed from official HockeyTech shifts.
PP/PK are derived from on-ice skater counts, adjusted for pulled goalies.
Only complete player-season coverage is exposed as a season average.
"""
import argparse,json,urllib.request,urllib.parse,re,concurrent.futures,datetime
from pathlib import Path

def seconds(v):
 if not isinstance(v,str) or not re.fullmatch(r'\d+:\d{2}',v):return None
 m,s=map(int,v.split(':'));return 60*m+s if s<60 else None

def merge(ranges):
 out=[]
 for a,b in sorted(ranges):
  if out and a<=out[-1][1]:out[-1][1]=max(b,out[-1][1])
  else:out.append([a,b])
 return out

def calculate(shifts,game):
 roster={side:{str(p['id']):role for role in ['skaters','goalies'] for p in game[role] if str(p['side']).startswith(side)} for side in ['home','visitor']}
 result={pid:{'toi':0,'pp':0,'pk':0,'unknown':0,'role':role,'has_shifts':False} for side in roster.values() for pid,role in side.items()};periods={}
 for side in ['home','visitor']:
  for player in shifts.get(side,[]):
   pid=str(player['player_id'])
   if pid not in roster[side]:continue
   per={}
   for shift in player.get('shifts',[]):
    length=seconds(shift.get('length'));a=seconds(shift.get('start_time'));b=seconds(shift.get('end_time'))
    if length==0:continue
    if a is None or b is None or length is None or abs(a-b)!=length:raise ValueError('Invalid shift clock')
    per.setdefault(str(shift['period']),[]).append([min(a,b),max(a,b)])
   for period,ranges in per.items():
    for a,b in merge(ranges):
     if b>1200:raise ValueError('Unexpected period duration')
     periods.setdefault(period,[]).append((a,b,side,pid));result[pid]['toi']+=b-a;result[pid]['has_shifts']=True
 for intervals in periods.values():
  events={}
  for a,b,side,pid in intervals:
   events.setdefault(a,[]).append((1,side,pid));events.setdefault(b,[]).append((-1,side,pid))
  active={'home':set(),'visitor':set()};times=sorted(events)
  for i,t in enumerate(times[:-1]):
   for action,side,pid in events[t]:
    if action==1:active[side].add(pid)
    else:active[side].discard(pid)
   duration=times[i+1]-t
   skaters={side:sum(roster[side][pid]=='skaters' for pid in active[side]) for side in active}
   goalies={side:sum(roster[side][pid]=='goalies' for pid in active[side]) for side in active}
   strength={side:skaters[side]-(1 if goalies[side]==0 else 0) for side in active}
   valid=all(3<=strength[side]<=5 and goalies[side]<=1 for side in active)
   for side in active:
    other='visitor' if side=='home' else 'home'
    for pid in active[side]:
     if not valid:result[pid]['unknown']+=duration
     elif strength[side]>strength[other]:result[pid]['pp']+=duration
     elif strength[side]<strength[other]:result[pid]['pk']+=duration
 for r in result.values():
  if r['pp']+r['pk']>r['toi']:raise ValueError('Special-team time exceeds total')
 return result

def fetch_one(task):
 season,path,cache=task;game=json.loads(path.read_text());out=cache/(str(game['game_id'])+'.json')
 if out.exists():return season,game,json.loads(out.read_text())
 params=dict(feed='modulekit',view='gameshifts',game_id=game['game_id'],key='446521baf8c38984',client_code='pwhl',site_id=0,lang='en')
 with urllib.request.urlopen(urllib.request.Request('https://lscluster.hockeytech.com/feed/index.php?'+urllib.parse.urlencode(params),headers={'User-Agent':'BHL-PWHL-Research/0.5'}),timeout=30) as response:x=json.load(response)['SiteKit']
 if str(x['Parameters']['game_id'])!=str(game['game_id']):raise ValueError('Game identity mismatch')
 rows=calculate(x.get('Gameshifts',{}),game);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(rows));return season,game,rows

def main():
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--cache',default='research/toi-cache');p.add_argument('--output',default='data/pwhl-ice-time.json');args=p.parse_args();root=Path(args.source);cache=Path(args.cache)
 tasks=[(season,path,cache/season) for season in ['2024','2024-25','2025-26'] for path in sorted((root/'batch'/season).glob('*.json'))]
 players={};errors=[];count=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(fetch_one,t):t for t in tasks}
  for future in concurrent.futures.as_completed(futures):
   task=futures[future]
   try:
    season,game,rows=future.result();count+=1
    for role in ['skaters','goalies']:
     for p in game[role]:
      pid=str(p['id']);s=players.setdefault(pid,{'name':p['name'],'role':role,'seasons':{}})['seasons'].setdefault(season,{'gp':0,'toi_seconds':0,'pp_seconds':0,'pk_seconds':0,'toi_games':0,'special_games':0,'unknown_seconds':0});r=rows.get(pid,{})
      s['gp']+=1
      if r.get('has_shifts'):
       s['toi_games']+=1;s['toi_seconds']+=r['toi'];s['unknown_seconds']+=r['unknown']
       if r['unknown']==0:s['special_games']+=1;s['pp_seconds']+=r['pp'];s['pk_seconds']+=r['pk']
   except Exception as e:errors.append({'season':task[0],'file':task[1].name,'error':str(e)})
   if (count+len(errors))%40==0:print('Processed',count,'errors',len(errors),flush=True)
 expected={}
 for season,path,_ in tasks:
  game=json.loads(path.read_text())
  for role in ['skaters','goalies']:
   for p in game[role]:
    key=(str(p['id']),season);expected[key]=expected.get(key,0)+1
 for pid,row in players.items():
  for season,s in row['seasons'].items():
   s['gp']=expected[(pid,season)]
   s['toi_avg_seconds']=s['toi_seconds']/s['gp'] if s['toi_games']==s['gp'] else None
   for stat in ['pp','pk']:s[stat+'_avg_seconds']=s[stat+'_seconds']/s['gp'] if s['special_games']==s['gp'] else None
 out={'source':'Official PWHL HockeyTech gameshifts','method':'TOI from merged shift intervals. PP/PK reconstructed from simultaneous skater counts minus extra attacker when goalie absent. Incoherent intervals are excluded; no full-season average unless every player-game is covered.','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'games_loaded':count,'games_expected':len(tasks),'errors':errors,'players':players}
 Path(args.output).write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'loaded':count,'errors':len(errors),'players':len(players),'full_toi_seasons':sum(s['toi_avg_seconds'] is not None for r in players.values() for s in r['seasons'].values()),'full_special_seasons':sum(s['pp_avg_seconds'] is not None for r in players.values() for s in r['seasons'].values())}),flush=True)
if __name__=='__main__':main()
