"""Resolve missing historical Fantrax IDs against Fantrax's public NHL player directory.
Diagnostic only: never auto-assign an NHL identity based on a loose match.
"""
import json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
directory=json.loads((root/'data/ownership/players.json').read_text())['players']
diag=json.loads((root/'data/production/diagnostics.json').read_text())
ids=sorted({pid for m in diag['mismatches'] for pid in m.get('unresolved',[])})
url='https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL'
report={'source':url,'status':'diagnostic_only','ids':ids,'matches':{},'unmatched':[]}
try:
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as response: payload=json.load(response)
 report['responseType']=type(payload).__name__
 report['responseKeys']=list(payload)[:25] if isinstance(payload,dict) else []
 def walk(node,path='root',depth=0):
  if depth>12:return
  if isinstance(node,dict):
   for k,v in node.items():
    if str(k) in ids:
     report['matches'].setdefault(str(k),[]).append({'path':path+'.'+str(k),'value':v})
    if isinstance(v,dict) and any(str(v.get(field,'')) in ids for field in ('id','playerId','scorerId','fantraxId')):
     fid=next(str(v[field]) for field in ('id','playerId','scorerId','fantraxId') if str(v.get(field,'')) in ids)
     report['matches'].setdefault(fid,[]).append({'path':path+'.'+str(k),'value':v})
    walk(v,path+'.'+str(k),depth+1)
  elif isinstance(node,list):
   for i,v in enumerate(node):walk(v,path+'['+str(i)+']',depth+1)
 walk(payload)
except Exception as e:report['error']=type(e).__name__+': '+str(e)
report['unmatched']=[x for x in ids if x not in report['matches']]
report['existingNames']={x:directory.get(x,{}).get('name') for x in ids}
out=root/'data/production/fantrax-missing-player-identities.json'
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('IDENTITY_LOOKUP',json.dumps({'matched':len(report['matches']),'unmatched':len(report['unmatched']),'error':report.get('error'),'responseType':report.get('responseType')},ensure_ascii=False),flush=True)
