"""Compare unresolved BHL starter residuals with NHL player period stats.
Evidence only: a match does not prove identity; existing team discrepancies may distort residuals.
"""
import collections,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import importlib.util
spec=importlib.util.spec_from_file_location('audit',ROOT/'scripts/audit-bhl-production.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
diag=json.loads((ROOT/'data/production/diagnostics.json').read_text())
missing=sorted({pid for m in diag['mismatches'] for pid in m.get('unresolved',[])})
result={'status':'hypotheses_only','method':'official Fantrax category totals minus known starter category points; compare to NHL per-period stats','candidates':{},'errors':[]}
for season in ('2018-19','2019-20'):
 try:
  audit.OUT=ROOT/'data/production'/f'temporary-audit-{season}.json'
  report=audit.main(season,completed_only=True)
  for p in report.get('periods',[]):
   if not p.get('teams'):continue
   unresolved_teams=[t for t in p['teams'] if len(t.get('unresolved',[]))==1 and t['unresolved'][0] in missing]
   if not unresolved_teams or p['period']>4:continue
   start,end=p['nhlDateStart'],p['nhlDateEnd']
   year=int(season[:4]);sid=f'{year}{year+1}'
   raw={job:audit.nhl_report(*job,start,end,season_id=sid) for job in audit.REPORTS}
   by_kind={k:{str(x['playerId']):x for x in rows} for k,rows in raw.items()}
   for t in unresolved_teams:
    pid=t['unresolved'][0]
    player=next(x for x in t['players'] if x['fantraxId']==pid)
    kind='goalie' if player['position']=='G' else 'skater'
    observed={k:round(v-t['calculatedCategoryPoints'].get(k,0),4) for k,v in t['officialCategoryPoints'].items()}
    # Rank only by categories with measurable residual; category scoring weights vary by position.
    known=[x for x in t['players'] if x['points'] is not None]
    scores=[]
    for nhl_id,row in by_kind[(kind,'summary')].items():
     name=row.get('skaterFullName') or row.get('goalieFullName')
     # compare G,A and shots where scoring weights can be inferred from existing starters of same position
     diffs=[]
     for category in ('G','A','SOG') if kind=='skater' else ('W','SV','GA'):
      examples=[x for x in known if x['position']==player['position'] and x['stats'].get(category) not in (None,0)]
      if not examples:continue
      weight=examples[0]['categoryPoints'].get(category,0)/examples[0]['stats'][category]
      value=audit.number(row,category)
      if value is None or category not in observed:continue
      diffs.append(abs(observed[category]-value*weight))
     if len(diffs)>=2:scores.append({'nhlId':nhl_id,'name':name,'error':round(sum(diffs),3),'categories':len(diffs)})
    scores.sort(key=lambda x:(x['error'],-x['categories']))
    result['candidates'].setdefault(pid,[]).append({'season':season,'period':p['period'],'team':t['team'],'position':player['position'],'residual':observed,'top':scores[:8]})
 except Exception as exc:result['errors'].append({'season':season,'error':str(exc)})
out=ROOT/'data/production/fantrax-missing-player-stat-candidates.json'
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('STAT_CANDIDATES',json.dumps({'players':len(result['candidates']),'samples':sum(len(v) for v in result['candidates'].values()),'errors':result['errors']},ensure_ascii=False),flush=True)
