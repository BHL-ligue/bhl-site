"""Probe public Fantrax historical player profiles for unresolved BHL identities.
Read-only diagnostics; never infer identity from a position alone.
"""
import json,urllib.request,urllib.parse,urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[1]
index=json.loads((root/'data/ownership/index.json').read_text())
diag=json.loads((root/'data/production/diagnostics.json').read_text())
ids=sorted({i for row in diag['mismatches'] for i in row.get('unresolved',[])})
existing=json.loads((root/'data/ownership/players.json').read_text())['players']
leagues={x['season']:x['leagueId'] for x in index['seasons']}
report={'status':'diagnostic_only','ids':ids,'probes':[],'identityCandidates':{},'knownNames':{i:existing.get(i,{}).get('name') for i in ids}}
def request(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=25) as res:
  raw=res.read(250000)
  return res.status,res.headers.get('Content-Type',''),raw
def walk(node,id,path='root',depth=0):
 if depth>9:return []
 hits=[]
 if isinstance(node,dict):
  names={k:v for k,v in node.items() if isinstance(v,str) and ('name' in k.lower() or k.lower() in ('first','last','player'))}
  if str(node.get('fantraxId',node.get('playerId',node.get('id',''))))==id and names:
   hits.append({'path':path,'names':names})
  if id in node and isinstance(node[id],dict):
   names={k:v for k,v in node[id].items() if isinstance(v,str) and ('name' in k.lower() or k.lower() in ('first','last'))}
   if names:hits.append({'path':path+'.'+id,'names':names})
  for k,v in node.items():hits+=walk(v,id,path+'.'+str(k),depth+1)
 elif isinstance(node,list):
  for i,v in enumerate(node):hits+=walk(v,id,path+'['+str(i)+']',depth+1)
 return hits
# Test one representative unresolved ID first, and only expand methods that return player data.
methods=['getPlayerInfo','getPlayerDetails','getPlayerStats','getPlayerProfile']
for method in methods:
 for season in ('2018-19','2019-20'):
  league=leagues[season]
  params={'leagueId':league,'playerId':'003hb'}
  url='https://www.fantrax.com/fxea/general/'+method+'?'+urllib.parse.urlencode(params)
  probe={'method':method,'season':season,'id':'003hb'}
  try:
   status,ctype,raw=request(url)
   probe.update({'httpStatus':status,'contentType':ctype,'bytes':len(raw)})
   try:
    payload=json.loads(raw)
    probe['keys']=list(payload)[:20] if isinstance(payload,dict) else []
    probe['matches']=walk(payload,'003hb')
    probe['sample']=str(payload)[:350] if not probe['matches'] else None
   except ValueError:probe['sample']=raw[:180].decode('utf-8','replace')
  except Exception as exc:probe['error']=str(exc)[:200]
  report['probes'].append(probe)
# Fantrax archived roster endpoint: names may be embedded in roster response, even when current directory drops them.
for season in ('2018-19','2019-20'):
 league=leagues[season]
 for period in (1,8):
  params={'leagueId':league,'period':period}
  url='https://www.fantrax.com/fxea/general/getTeamRosters?'+urllib.parse.urlencode(params)
  probe={'method':'getTeamRosters','season':season,'period':period}
  try:
   status,ctype,raw=request(url);probe.update({'httpStatus':status,'bytes':len(raw)})
   payload=json.loads(raw)
   probe['keys']=list(payload)[:20] if isinstance(payload,dict) else []
   probe['matches']={i:walk(payload,i)[:3] for i in ids if walk(payload,i)}
   for i,hits in probe['matches'].items():report['identityCandidates'].setdefault(i,[]).extend({'season':season,'period':period,**h} for h in hits)
  except Exception as exc:probe['error']=str(exc)[:200]
  report['probes'].append(probe)
out=root/'data/production/fantrax-historical-player-profiles.json'
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('HISTORICAL_PROFILE_PROBES',json.dumps({'candidateIds':list(report['identityCandidates']),'probes':len(report['probes']),'successful':sum('httpStatus' in p for p in report['probes'])},ensure_ascii=False))
