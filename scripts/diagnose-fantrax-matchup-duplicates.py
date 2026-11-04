"""Fast, read-only check of repeated Fantrax matchup HIT entries."""
import collections
import json
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('check-fantrax-hit-source.py')),run_name='__main__')
out=Path(__file__).resolve().parents[1]/'data/production/fantrax-hit-source-check-2023-24.json'
report=json.loads(out.read_text())
groups=collections.defaultdict(list)
for row in report['rows']:
    if row.get('teamId'):
        groups[(row['period'],row['teamId'])].append(row)
duplicates=[]
for (period,tid),items in sorted(groups.items()):
    if len(items)<2:
        continue
    values=sorted({(float(x['hitCountFromMatchupScores']),float(x['hitFptsFromMatchupScores'])) for x in items})
    duplicates.append({'period':period,'teamId':tid,'team':items[0]['team'],'appearances':len(items),'distinctHitValues':values,'conflictingValues':len(values)>1})
report['duplicateAnalysis']={'uniqueTeamPeriods':len(groups),'repeatedTeamPeriods':len(duplicates),'conflictingRepeatedTeamPeriods':sum(x['conflictingValues'] for x in duplicates),'minnesotaPeriod1':[x for x in duplicates if x['period']==1 and x['team']=='Minnesota North Stars'],'examples':duplicates[:20]}
report['liveScoringComparison']={'minnesotaPeriod1VisibleHits':51,'minnesotaPeriod1VisibleHitFpts':5.1,'evidence':'Fantrax live-scoring screenshots supplied by league commissioner','note':'The live-scoring display and getMatchupScores response are distinct sources; do not treat as equivalent without validation.'}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('DUPLICATE_ANALYSIS',json.dumps(report['duplicateAnalysis'],ensure_ascii=False),flush=True)
