"""Join validated per-game ice-time aggregates to the existing fantasy bank."""
import json
from pathlib import Path

def main():
 path=Path('data/pwhl-fantasy-preview.json');data=json.loads(path.read_text());ice=json.loads(Path('data/pwhl-ice-time.json').read_text());official=json.loads(Path('data/pwhl-official-ice-time.json').read_text())
 for player in data['standings']:
  bio=ice['players'].get(str(player['id']),{})
  time_rows=[]
  for season in player['s']:
   t=bio.get('seasons',{}).get(season['y']);
   if t:
    t['gp']=season['g'];t['toi_avg_seconds']=t['toi_seconds']/t['gp'] if t['toi_games']==t['gp'] and t['gp'] else None
    for stat in ['pp','pk']:t[stat+'_avg_seconds']=t[stat+'_seconds']/t['gp'] if t['special_games']==t['gp'] and t['gp'] else None
   season['timeCoverage']=t
   for key,source in [('pp_toi','pp_avg_seconds'),('pk_toi','pk_avg_seconds'),('toi','toi_avg_seconds')]:season['st'][key]=t.get(source) if t else None
   pub=official['seasons'].get(season['y'],{}).get(str(player['id']));
   if pub and pub['gp']==season['g'] and pub['toi_avg_seconds'] is not None:
    season['st']['toi']=pub['toi_avg_seconds'];season['officialTOI']=pub
   if t:time_rows.append(t)
  complete=len(time_rows)==len(player['s'])
  for key,seconds_key,games_key in [('toi','toi_seconds','toi_games'),('pp_toi','pp_seconds','special_games'),('pk_toi','pk_seconds','special_games')]:
   expected=sum(t['gp'] for t in time_rows);covered=sum(t[games_key] for t in time_rows)
   player['st'][key]=sum(t[seconds_key] for t in time_rows)/expected if complete and expected and covered==expected else None
  pub_rows=[s.get('officialTOI') for s in player['s']]
  if all(pub_rows):
   total=sum((p['toi_total_seconds'] if p['toi_total_seconds'] is not None and abs(p['toi_total_seconds']/p['gp']-p['toi_avg_seconds'])<1.1 else p['toi_avg_seconds']*p['gp']) for p in pub_rows if p['gp'])
   gp=sum(p['gp'] for p in pub_rows);player['st']['toi']=total/gp if gp else None
  player['timeCoverage']={'expected_games':sum(t['gp'] for t in time_rows),'toi_games':sum(t['toi_games'] for t in time_rows),'special_games':sum(t['special_games'] for t in time_rows)}
 data['iceTime']={'source':'Official PWHL published TOI/GP; HockeyTech shifts for PP/PK research','method':ice['method'],'games_loaded':ice['games_loaded'],'games_expected':ice['games_expected'],'note':'All averages are seconds per game; absent/incomplete data stays null. PP/PK research reconstruction cannot yet cover complete seasons and remains null; TOI uses published season average where available, otherwise complete shift totals. Fantasy points are unchanged.'}
 path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 print('Joined',len(data['standings']),'players. Complete TOI:',sum(p['st'].get('toi') is not None for p in data['standings']),'complete PP/PK:',sum(p['st'].get('pp_toi') is not None for p in data['standings']))
if __name__=='__main__':main()
