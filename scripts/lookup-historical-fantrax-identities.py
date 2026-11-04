"""Look for missing historical player identities in original BHL Fantrax league archives."""
import json,urllib.request,urllib.parse
from pathlib import Path
root=Path(__file__).resolve().parents[1]
index=json.loads((root/'data/ownership/index.json').read_text())
diagnostics=json.loads((root/'data/production/diagnostics.json').read_text())
missing=sorted({pid for row in diagnostics['mismatches'] for pid in row.get('unresolved',[])})
report={'status':'diagnostic_only','missingIds':missing,'sources':[],'matches':{},'unmatched':[]}
def get(endpoint,league):
 url='https://www.fantrax.com/fxea/general/'+endpoint+'?'+urllib.parse.urlencode({'leagueId':league})
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=70) as r:return json.load(r)
def walk(node,path,season,source,depth=0):
 if depth>13:return
 if isinstance(node,dict):
  ids={str(node.get(k,'')) for k in ('fantraxId','playerId','id','scorerId')}
  found=ids.intersection(missing)
  for fid in found:
   report['matches'].setdefault(fid,[]).append({'season':season,'source':source,'path':path,'record':{k:v for k,v in node.items() if isinstance(v,(str,int,float,bool,type(None)))}})
  for k,v in node.items():
   if k in missing:
    report['matches'].setdefault(k,[]).append({'season':season,'source':source,'path':path+'.'+k,'record':v if isinstance(v,(str,int,float)) else {q:w for q,w in v.items() if isinstance(w,(str,int,float,bool,type(None)))} if isinstance(v,dict) else str(type(v))})
   walk(v,path+'.'+str(k),season,source,depth+1)
 elif isinstance(node,list):
  for i,v in enumerate(node):walk(v,path+'['+str(i)+']',season,source,depth+1)
for season in ('2018-19','2019-20','2022-23','2024-25'):
 league=next(x['leagueId'] for x in index['seasons'] if x['season']==season)
 for endpoint in ('getLeagueInfo','getDraftResults'):
  source={'season':season,'endpoint':endpoint}
  try:
   payload=get(endpoint,league)
   source['responseType']=type(payload).__name__
   source['keys']=list(payload)[:25] if isinstance(payload,dict) else []
   walk(payload,'root',season,endpoint)
  except Exception as e:source['error']=str(e)
  report['sources'].append(source)
report['unmatched']=[fid for fid in missing if fid not in report['matches']]
out=root/'data/production/fantrax-historical-identity-lookup.json'
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('HISTORICAL_IDENTITY_LOOKUP',json.dumps({'matched':len(report['matches']),'unmatched':len(report['unmatched']),'errors':[s for s in report['sources'] if 'error' in s]},ensure_ascii=False),flush=True)
