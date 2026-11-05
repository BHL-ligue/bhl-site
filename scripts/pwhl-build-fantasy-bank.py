"""Build reproducible weekly fantasy input from imported PWHL game summaries.
Usage: python scripts/pwhl-build-fantasy-bank.py --source ../pwhl-data/research/pwhl
"""
import argparse,json,datetime as dt
from pathlib import Path
from decimal import Decimal
WEIGHTS={'skaters':{'goals':'3','assists':'2.5','shots_on':'.3','hits':'.1','shots_blocked_by_player':'.2','faceoff_wins':'.05'},'goalies':{'win':'4','goals_against':'-1','saves':'.2','shutout':'4','goals':'3','assists':'2.5'}}
def build(root):
    players={};seasons={};seen=set();performances=0
    index=json.loads((root/'season-game-index.json').read_text())['seasons']
    for season in ['2024','2024-25','2025-26']:
        expected=set(map(str,index[season]['game_ids']));loaded=set();weeks={}
        for path in sorted((root/'batch'/season).glob('*.json')):
            game=json.loads(path.read_text());gid=str(game['game_id'])
            if gid not in expected:raise ValueError('Unexpected game '+gid)
            if (season,gid) in seen:raise ValueError('Duplicate game '+gid)
            seen.add((season,gid));loaded.add(gid)
            date=dt.date.fromisoformat(game['date'][:10]);monday=date-dt.timedelta(days=date.weekday());week=monday.isoformat()
            weeks.setdefault(week,{'start':week,'end':(monday+dt.timedelta(days=6)).isoformat(),'games':0,'players':{}})['games']+=1
            for role,weights in WEIGHTS.items():
                ids=set()
                for row in game[role]:
                    pid=str(row['id']);key=role+':'+pid
                    if pid in ids:raise ValueError('Duplicate player-game '+gid+' '+pid)
                    ids.add(pid)
                    stats=row['stats']
                    if any(stats.get(k) in (None,'') for k in weights):raise ValueError('Incomplete stats '+gid+' '+pid)
                    units=int(sum(Decimal(str(stats[k]))*Decimal(w) for k,w in weights.items())*100)
                    if Decimal(str(row['fpts']))*100!=units:raise ValueError('Score mismatch '+gid+' '+pid)
                    players[key]={'id':key,'name':row['name'],'role':role}
                    item=weeks[week]['players'].setdefault(key,{'gp':0,'units':0})
                    item['gp']+=1;item['units']+=units;performances+=1
        if expected!=loaded:raise ValueError(f'Incomplete season {season}: {len(loaded)}/{len(expected)}')
        seasons[season]={'games':len(loaded),'weeks':list(sorted(weeks.values(),key=lambda w:w['start']))}
    return {'schemaVersion':1,'scoringVersion':'bhl-pwhl-draft-1','status':'experimental','source':'Imported PWHL HockeyTech game summaries; not independently reconciled to official season totals','weights':WEIGHTS,'performances':performances,'players':list(players.values()),'seasons':seasons}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',default='data/pwhl-fantasy-bank.json');a=p.parse_args()
    data=build(Path(a.source));out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'players':len(data['players']),'performances':data['performances'],'games':{s:v['games'] for s,v in data['seasons'].items()}}))
