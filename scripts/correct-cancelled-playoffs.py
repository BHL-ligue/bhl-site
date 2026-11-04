"""Remove the unused 2019-20 third round from published production archives."""
import collections
import datetime as dt
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def correct(root=ROOT):
 out=root/'data/production'
 starts=json.loads((out/'starts.json').read_text());scorers=json.loads((out/'scorers.json').read_text())
 cancelled=[r for r in starts['rows'] if r['season']=='2019-20' and r['phase']=='playoffs' and r['period']>23]
 if not cancelled:return 0
 assert all(not any(r.get(k,0) for k in ['fpts','gp','goals','assists']) for r in cancelled),'Unexpected production in cancelled round'
 removed=collections.Counter();review=collections.Counter()
 def key(r):return (r['id'],r['team'],'goalie' if r.get('position')=='G' else 'defense' if r.get('position')=='D' else 'forward')
 for r in cancelled:
  removed[key(r)]+=1
  if r.get('review'):review[key(r)]+=1
 for r in scorers['rows']:
  if r['season']!='2019-20' or r['phase']!='playoffs':continue
  k=(r['id'],r['team'],r['positionGroup']);r['starts']-=removed.pop(k,0);r['reviewStarts']-=review[k]
  assert r['starts']>=0 and r['reviewStarts']>=0
 assert not removed,'Cancelled lineup missing from scorer aggregate'
 starts['rows']=[r for r in starts['rows'] if not (r['season']=='2019-20' and r['phase']=='playoffs' and r['period']>23)]
 scorers['rows']=[r for r in scorers['rows'] if r['starts']>0]
 coverage=next(c for c in scorers['coverage'] if c['season']=='2019-20' and c['phase']=='playoffs')
 teams=len({(r['period'],r['team']) for r in cancelled});periods=len({r['period'] for r in cancelled})
 for field in ['periods','checkedPeriods']:coverage[field]-=periods
 for field in ['comparisons','matchingComparisons']:coverage[field]-=teams
 assert coverage['periods']==2
 totals=collections.Counter()
 for r in scorers['rows']:
  if r['season']=='2019-20' and r['phase']=='playoffs':totals[(r['id'],r['team'])]+=r['starts']
 assert max(totals.values())<=2
 scorers['updatedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
 for filename,data in [('starts.json',starts),('scorers.json',scorers)]:
  (out/filename).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 summary=json.loads((out/'summary.json').read_text());summary['records']=len(scorers['rows']);summary['periods']=sum(c['checkedPeriods'] for c in scorers['coverage']);summary['teamPeriods']=sum(c['comparisons'] for c in scorers['coverage']);summary['matchingTeamPeriods']=sum(c['matchingComparisons'] for c in scorers['coverage']);(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 return len(cancelled)
if __name__=='__main__':print('Cancelled third-round selections removed:',correct())
