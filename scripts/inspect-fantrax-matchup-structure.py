"""Inspect the structure of Fantrax's matchup API for one known mismatch.
Read-only; redact no credentials because the request uses the public archive.
"""
import json, urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive=json.loads((root/'data/ownership/2023-24.json').read_text())
url='https://www.fantrax.com/fxea/general/getMatchupScores?leagueId='+archive['leagueId']+'&period=1'
req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
with urllib.request.urlopen(req,timeout=45) as response: data=json.load(response)
tid=next(k for k,v in archive['teams'].items() if v['name']=='Minnesota North Stars')
samples=[]
for i,m in enumerate(data.get('matchups',[])):
 for side in ('home','away'):
  if m.get(side,{}).get('teamId')!=tid:continue
  categories=[{'code':c.get('shortName'),'side':c.get(side)} for c in m.get('categories',[])]
  samples.append({'matchupIndex':i,'matchupKeys':list(m),'side':side,
                  'teamPayload':m[side],'categories':categories})
out=root/'data/production/fantrax-matchup-structure-2023-24-p1.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'season':'2023-24','period':1,'team':'Minnesota North Stars',
 'responseKeys':list(data),'matchupCount':len(data.get('matchups',[])),
 'samples':samples,'status':'diagnostic_only',
 'knownScreenshotHitCount':51,'apiHitCount':34,
 'warning':'Do not replace historical player statistics based solely on this comparison'},ensure_ascii=False,indent=2)+'\n')
print('MATCHUP_STRUCTURE',json.dumps({'responseKeys':list(data),'matchupCount':len(data.get('matchups',[])),'minnesotaAppearances':len(samples),'matchupKeys':[s['matchupKeys'] for s in samples]},ensure_ascii=False),flush=True)
