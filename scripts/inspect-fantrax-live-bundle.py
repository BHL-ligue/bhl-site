"""Read-only inspection of Fantrax public JavaScript bundle for Live Scoring endpoint names."""
import json,re,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base='https://www.fantrax.com/fantasy/league/ukw6z6r2lgjl09qn/'
bundle='https://www.fantrax.com/main-C4DPXOYQ.js'
report={'source':bundle,'status':'diagnostic_only','keywords':{},'endpointCandidates':[]}
try:
 req=urllib.request.Request(bundle,headers={'User-Agent':'Mozilla/5.0','Accept':'application/javascript,*/*'})
 with urllib.request.urlopen(req,timeout=60) as response:
  content=response.read(18000000).decode('utf-8','replace')
  report['httpStatus']=response.status
  report['bytesInspected']=len(content)
  for term in ['getLiveScoring','liveScoring','livescoring','getMatchupScores','getMatchup','matchupId','fxea/']:
   positions=[m.start() for m in re.finditer(re.escape(term),content,re.I)]
   report['keywords'][term]={'occurrences':len(positions),'contexts':[content[max(0,p-110):p+180] for p in positions[:8]]}
  report['endpointCandidates']=sorted(set(re.findall(r'[/a-zA-Z0-9_-]*(?:getLiveScoring|getMatchupScores|getMatchupDetails|getMatchup|liveScoring)[a-zA-Z0-9_/-]*',content,re.I)))[:80]
except Exception as e: report['error']=type(e).__name__+': '+str(e)
out=root/'data/production/fantrax-live-scoring-bundle-analysis.json'
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('BUNDLE_ANALYSIS',json.dumps({'httpStatus':report.get('httpStatus'),'bytesInspected':report.get('bytesInspected'),'keywordCounts':{k:v['occurrences'] for k,v in report['keywords'].items()},'endpointCandidates':report['endpointCandidates'],'error':report.get('error')},ensure_ascii=False),flush=True)
