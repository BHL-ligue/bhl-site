"""Read-only targeted inspection of the public Fantrax live-scoring bundle."""
import json,re,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
url='https://www.fantrax.com/main-C4DPXOYQ.js'
req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
report={'source':url,'status':'diagnostic_only'}
try:
 with urllib.request.urlopen(req,timeout=60) as response: js=response.read(18000000).decode('utf-8','replace')
 terms=['getLiveScoringStats','getScoresSummaryData','getFantasyLeagueInfo']
 report['occurrences']={}
 for term in terms:
  matches=list(re.finditer(re.escape(term),js,re.I))
  report['occurrences'][term]=[{'offset':m.start(),'before':js[max(0,m.start()-450):m.start()],'after':js[m.end():m.end()+650]} for m in matches[:12]]
 # Exclude arbitrary tokens or credentials; only search publicly named API paths.
 report['apiRouteCandidates']=sorted(set(re.findall(r'[/][a-zA-Z0-9/_-]{0,90}(?:getLiveScoringStats|liveScoringStats)[a-zA-Z0-9/_-]*',js,re.I)))[:30]
 report['bytesInspected']=len(js)
except Exception as error: report['error']=type(error).__name__+': '+str(error)
out=root/'data/production/fantrax-live-scoring-method-context.json'
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('METHOD_CONTEXT_SUMMARY',json.dumps({'bytes':report.get('bytesInspected'),'occurrences':{k:len(v) for k,v in report.get('occurrences',{}).items()},'routes':report.get('apiRouteCandidates'),'error':report.get('error')}),flush=True)
