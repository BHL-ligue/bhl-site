"""Build transparent BHL starter-contribution standings from archived lineups.
Does not adjust individual points to force a match with official team totals.
"""
import concurrent.futures as cf
import collections
import datetime as dt
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bhl_audit',ROOT/'scripts/audit-bhl-production.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
def aggregate(reports,directory):
 rows={};coverage=[]
 for report in reports:
  season=report['season'];periods=report.get('periods',[])
  for phase in ['regular','playoffs']:
   selected=[p for p in periods if p['phase']==phase and p.get('status')!='not_scheduled'];teams=[t for p in selected for t in p.get('teams',[])]
   coverage.append({'season':season,'phase':phase,'periods':len(selected),'checkedPeriods':sum('teams' in p for p in selected),'comparisons':len(teams),'matchingComparisons':sum(t['validated'] for t in teams),'unresolvedStarts':sum(len(t['unresolved']) for t in teams),'blockedPeriods':[p['period'] for p in selected if 'teams' not in p]})
  for period in periods:
   phase=period['phase']
   for team in period.get('teams',[]):
    for player in team['players']:
     pid=player['fantraxId'];position_group='goalie' if player['position']=='G' else 'defense' if player['position']=='D' else 'forward';k=(season,phase,pid,team['team'],position_group);row=rows.setdefault(k,{'season':season,'phase':phase,'id':pid,'name':directory[pid].get('name'),'team':team['team'],'kind':'goalie' if player['position']=='G' else 'skater','positionGroup':position_group,'fpts':0,'goals':0,'assists':0,'gp':0,'starts':0,'missingStarts':0,'reviewStarts':0})
     row['starts']+=1
     if player['points'] is None:row['missingStarts']+=1;continue
     row['fpts']+=player['points'];row['goals']+=player['stats'].get('G',0);row['assists']+=player['stats'].get('A',0);row['gp']+=player.get('gamesPlayed',0) or 0
     if not team['validated']:row['reviewStarts']+=1
 for row in rows.values():row['fpts']=round(row['fpts'],4)
 return list(rows.values()),coverage

def diagnostics(reports):
 """Aggregate team-period discrepancies without silently adjusting player scores."""
 seasons=[]
 categories=collections.Counter()
 examples=[]
 for report in reports:
  season=report['season'];teams=[(p,t) for p in report.get('periods',[]) for t in p.get('teams',[])]
  mismatches=[(p,t) for p,t in teams if not t['validated']]
  missing=sum(1 for _,t in mismatches if t.get('unresolved'))
  numeric=sum(1 for _,t in mismatches if t.get('difference') is not None and abs(t['difference'])>=0.005)
  category_only=sum(1 for _,t in mismatches if t.get('difference') is not None and abs(t['difference'])<0.005 and t.get('categoryDifferences'))
  for p,t in mismatches:
   for code,value in t.get('categoryDifferences',{}).items():
    categories[code]+=1
   examples.append({'season':season,'phase':p['phase'],'period':p['period'],'team':t['team'],'official':t['official'],'calculated':t['calculated'],'difference':t.get('difference'),'unresolved':t.get('unresolved',[]),'categoryDifferences':t.get('categoryDifferences',{}),'reason':'unresolved_player' if t.get('unresolved') else 'score_difference' if t.get('difference') is not None and abs(t['difference'])>=0.005 else 'category_only'})
  seasons.append({'season':season,'compared':len(teams),'matching':len(teams)-len(mismatches),'mismatches':len(mismatches),'unresolvedPlayerPeriods':missing,'scoreDifferencePeriods':numeric,'categoryOnlyPeriods':category_only})
 examples.sort(key=lambda x:(x['reason']!='unresolved_player',-abs(x['difference'] or 0),x['season'],x['period']))
 return {'schemaVersion':1,'status':'diagnostic_only','seasons':seasons,'categoryFrequency':dict(categories.most_common()),'mismatches':examples}

def main():
 out=ROOT/'data/production';(out/'audits').mkdir(parents=True,exist_ok=True)
 manifest=json.loads((ROOT/'data/ownership/index.json').read_text());directory=json.loads((ROOT/'data/ownership/players.json').read_text())['players'];reports=[]
 # A retired/injured player may have no games in one season. Resolve a name
 # only if it maps to a single NHL ID across the entire archived range.
 seasons=sorted(s['season'] for s in manifest['seasons']);lookups=[]
 def get_names(job):
  season,kind=job;year=int(season[:4]);return kind,audit.nhl_report(kind,'summary',season_id=str(year)+str(year+1))
 with cf.ThreadPoolExecutor(max_workers=4) as pool:lookups=list(pool.map(get_names,[(s,k) for s in seasons for k in ['skater','goalie']]))
 role={}
 for season in seasons:
  archive=json.loads((ROOT/('data/ownership/'+season+'.json')).read_text())
  for pid,spans in archive['lineups'].items():
   if spans:role.setdefault(pid,spans[0][4])
 for pid,player in directory.items():
  names={audit.key(n) for n in [player.get('name'),*player.get('aliases',[]),*audit.REVIEWED_ALIASES.get(pid,[])] if n};kind='goalie' if role.get(pid)=='G' else 'skater'
  matches=[r for k,rows in lookups if k==kind for r in rows if audit.key(r.get('goalieFullName') or r.get('skaterFullName')) in names]
  ids={str(r['playerId']) for r in matches}
  if len(ids)>1 and kind=='skater':
   matches=[r for r in matches if (r.get('positionCode')=='D')==(role.get(pid)=='D')];ids={str(r['playerId']) for r in matches}
  if len(ids)==1:audit.HISTORICAL_NHL_IDS[pid]=next(iter(ids))
 print('CROSS_SEASON_IDENTITIES',len(audit.HISTORICAL_NHL_IDS),flush=True)
 for season in seasons:
  audit.OUT=out/'audits'/f'{season}.json'
  report=audit.main(season,completed_only=True);reports.append(report)
 rows,coverage=aggregate(reports,directory)
 report_diagnostics=diagnostics(reports)
 (out/'diagnostics.json').write_text(json.dumps(report_diagnostics,ensure_ascii=False,indent=2)+'\n')
 result={'schemaVersion':1,'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'status':'reconstructed','metric':'FPTS produced while ACTIVE for a BHL team, using the historical position and season scoring settings','completedPeriodsOnly':True,'careerRankingOfficial':False,'seasons':sorted((r['season'] for r in reports),reverse=True),'coverage':coverage,'rows':rows,'unresolvedIds':sorted({r['id'] for r in rows if r['missingStarts']})}
 (out/'scorers.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
 summary={'seasons':len(reports),'records':len(rows),'periods':sum(c['checkedPeriods'] for c in coverage),'matchingTeamPeriods':sum(c['matchingComparisons'] for c in coverage),'teamPeriods':sum(c['comparisons'] for c in coverage),'unresolvedIds':len(result['unresolvedIds']),'blockedPeriods':sum(len(c['blockedPeriods']) for c in coverage),'diagnosticMismatches':len(report_diagnostics['mismatches'])}
 (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print('SCORERS_SUMMARY',json.dumps(summary),flush=True)
if __name__=='__main__':main()
