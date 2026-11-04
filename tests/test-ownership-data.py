"""Validate every compact interval against the archive's available periods."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data/ownership'
manifest=json.loads((DATA/'index.json').read_text())
players=json.loads((DATA/'players.json').read_text())['players']
assert len(manifest['seasons'])==len({s['season'] for s in manifest['seasons']})
for entry in manifest['seasons']:
 archive=json.loads((DATA/entry['file']).read_text())
 assert archive['season']==entry['season']
 periods={p['number']:p for p in archive['periods']}
 assert len(periods)==len(archive['periods'])==entry['periods']
 assert sorted(n for n,p in periods.items() if not p['available'])==archive['missingPeriods']==entry['missingPeriods']
 assert sum(p['available'] for p in periods.values())==entry['availablePeriods']
 assert len(archive['ownership'])==entry['players']
 for pid,spans in archive['ownership'].items():
  assert pid in players and players[pid]['status'] in ['confirmed','unresolved'],pid
  assert bool(players[pid]['name'])==(players[pid]['status']=='confirmed'),pid
  used=set()
  for start,end,team in spans:
   assert start<=end and team in archive['teams']
   for period in range(start,end+1):
    assert period in periods and periods[period]['available'] and period not in used,(entry['season'],pid,period)
    used.add(period)
 for pid,spans in archive.get('lineups',{}).items():
  for start,end,team,status,position in spans:
   assert team in archive['teams'] and status in ['ACTIVE','RESERVE','MINORS','INJURED_RESERVE']
   assert position
   for period in range(start,end+1):
    assert any(a<=period<=b and t==team for a,b,t in archive['ownership'][pid])
print('Validated',len(manifest['seasons']),'seasons,',sum(s['availablePeriods'] for s in manifest['seasons']),'periods and',len(players),'player identities.')
