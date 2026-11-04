"""Diagnostic en lecture seule des catégories HIT des matchups Fantrax 2023-24.
Ne modifie jamais les points des joueurs ni les résultats officiels.
"""
import json
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
archive=json.loads((ROOT/'data/ownership/2023-24.json').read_text())
def fetch(period):
    url=f"https://www.fantrax.com/fxea/general/getMatchupScores?leagueId={archive['leagueId']}&period={period}"
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=45) as response:
        return json.load(response)

rows=[]
for period in archive['periods']:
    n=period['number']
    try:
        data=fetch(n)
        for matchup in data.get('matchups',[]):
            for side in ('home','away'):
                team=matchup.get(side,{})
                for category in matchup.get('categories',[]):
                    if category.get('shortName')!='Hit':
                        continue
                    entry=category.get(side,{})
                    value=entry.get('value')
                    points=entry.get('points')
                    if value is None or points is None:
                        continue
                    discrepancy=round(float(points)-float(value)*0.1,4)
                    rows.append({'period':n,'teamId':team.get('teamId'),
                                 'team':archive['teams'].get(team.get('teamId'),{}).get('name'),
                                 'hitCountFromMatchupScores':value,
                                 'hitFptsFromMatchupScores':points,
                                 'pointsMinusHitsTimesWeight':discrepancy,
                                 'internallyConsistent':abs(discrepancy)<0.005})
    except Exception as error:
        rows.append({'period':n,'error':type(error).__name__+': '+str(error)})

out=ROOT/'data/production/fantrax-hit-source-check-2023-24.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'season':'2023-24','category':'Hit',
    'pointsPerHit':0.1,'source':'Fantrax getMatchupScores',
    'status':'diagnostic_only','rows':rows},ensure_ascii=False,indent=2)+'\n')
print('FANTRAX_HIT_SOURCE_SUMMARY',json.dumps({
    'rows':len(rows),
    'inconsistent':sum(r.get('internallyConsistent') is False for r in rows),
    'errors':sum('error' in r for r in rows),
    'minnesotaPeriod1':[r for r in rows if r.get('period')==1 and r.get('team')=='Minnesota North Stars']
},ensure_ascii=False),flush=True)
