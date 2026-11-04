"""Build transparent BHL starter-contribution standings from archived lineups.
Does not adjust individual points to force a match with official team totals.
"""
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
   selected=[p for p in periods if p['phase']==phase];teams=[t for p in selected for t in p.get('teams',[])]
   coverage.append({'season':season,'phase':phase,'periods':len(selected),'checkedPeriods':sum('teams' in p for p in selected),'comparisons':len(teams),'matchingComparisons':sum(t['validated'] for t in teams),'unresolvedStarts':sum(len(t['unresolved']) for t in teams),'blockedPeriods':[p['period'] for p in selected if 'teams' not in p]})
  for period in periods:
   phase=period['phase']
   for team in period.get('teams',[]):
    for player in team['players']:
     pid=player['fantraxId'];k=(season,phase,pid,team['team']);row=rows.setdefault(k,{'season':season,'phase':phase,'id':pid,'name':directory[pid].get('name'),'team':team['team'],'kind':'goalie' if player['position']=='G' else 'skater','fpts':0,'goals':0,'assists':0,'gp':0,'starts':0,'missingStarts':0,'reviewStarts':0})
     row['starts']+=1
     if player['points'] is None:row['missingStarts']+=1;continue
     row['fpts']+=player['points'];row['goals']+=player['stats'].get('G',0);row['assists']+=player['stats'].get('A',0);row['gp']+=player.get('gamesPlayed',0) or 0
     if not team['validated']:row['reviewStarts']+=1
 for row in rows.values():row['fpts']=round(row['fpts'],4)
 return list(rows.values()),coverage

def main():
 out=ROOT/'data/production';(out/'audits').mkdir(parents=True,exist_ok=True)
 manifest=json.loads((ROOT/'data/ownership/index.json').read_text());directory=json.loads((ROOT/'data/ownership/players.json').read_text())['players'];reports=[]
 for season in sorted(s['season'] for s in manifest['seasons']):
  audit.OUT=out/'audits'/f'{season}.json'
  report=audit.main(season,completed_only=True);reports.append(report)
 rows,coverage=aggregate(reports,directory)
 result={'schemaVersion':1,'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'status':'reconstructed','metric':'FPTS produced while ACTIVE for a BHL team, using the historical position and season scoring settings','completedPeriodsOnly':True,'careerRankingOfficial':False,'seasons':sorted((r['season'] for r in reports),reverse=True),'coverage':coverage,'rows':rows,'unresolvedIds':sorted({r['id'] for r in rows if r['missingStarts']})}
 (out/'scorers.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
 summary={'seasons':len(reports),'records':len(rows),'periods':sum(c['checkedPeriods'] for c in coverage),'matchingTeamPeriods':sum(c['matchingComparisons'] for c in coverage),'teamPeriods':sum(c['comparisons'] for c in coverage),'unresolvedIds':len(result['unresolvedIds']),'blockedPeriods':sum(len(c['blockedPeriods']) for c in coverage)}
 (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print('SCORERS_SUMMARY',json.dumps(summary),flush=True)
if __name__=='__main__':main()
