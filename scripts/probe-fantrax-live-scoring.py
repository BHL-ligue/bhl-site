"""Read-only probe: inspect publicly accessible Fantrax Live Scoring HTML.
Never uses login cookies, tokens, or modifies league data.
"""
import json,re,urllib.request,urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[1]
league='ukw6z6r2lgjl09qn'
matchup='qtetgxu8lgjl09t1_u4g5a6btlgjl09sf'
url=f'https://www.fantrax.com/fantasy/league/{league}/livescoring;period=1?mobileMatchupView=true&matchupId={matchup}&teamId=ALL&layout=STANDARD&mainView=MATCHUP&mobileView=MATCHUPS'
req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'})
report={'season':'2023-24','period':1,'matchupId':matchup,'source':'Public Live Scoring page, unauthenticated','status':'diagnostic_only'}
try:
 with urllib.request.urlopen(req,timeout=30) as response:
  html=response.read(1500000).decode('utf-8','replace')
  report['httpStatus']=response.status
  report['finalUrl']=response.geturl()
  report['contentType']=response.headers.get('Content-Type')
  report['htmlBytes']=len(html)
  report['pageTitle']=(re.search(r'<title[^>]*>(.*?)</title>',html,re.I|re.S) or [None,None])[1]
  report['mentionsMinnesota']=bool(re.search('Minnesota',html,re.I))
  report['mentionsQuebec']=bool(re.search('Qu[eé]bec',html,re.I))
  report['mentionsLiveScoring']=bool(re.search('livescoring',html,re.I))
  report['scriptSources']=list(dict.fromkeys(re.findall(r'<script[^>]+src=["\\\']([^"\\\']+)',html,re.I)))[:30]
  report['possibleApiPaths']=list(dict.fromkeys(re.findall(r'[/\\\w.-]*(?:getLiveScoring|getMatchup|liveScoring|livescoring)[/\\\w?=&.-]*',html,re.I)))[:30]
  report['hasEmbedded51Hits']=bool(re.search(r'(?i)(?:hits?|\\\"Hit\\\").{0,70}51',html))
except Exception as error:
 report['error']=type(error).__name__+': '+str(error)
out=root/'data/production/fantrax-live-scoring-access-2023-24-p1.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('LIVE_SCORING_ACCESS',json.dumps(report,ensure_ascii=False),flush=True)
