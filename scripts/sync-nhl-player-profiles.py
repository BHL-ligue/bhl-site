"""Publish official NHL profile data on the same origin as the BHL site.
Historical Fantrax IDs are retained; ambiguous NHL names are never guessed.
"""
import concurrent.futures as cf
import datetime as dt
import json
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SEASON="20262027"
WEIGHTS={"G":3,"A":2.5,"SOG":.3,"Hit":.1,"Blk":.2,"Tk":.1,"FOW":.05}
GOALIE_WEIGHTS={"W":4,"GA":-1,"SV":.2,"SHO":4,"G":3,"A":2.5}
def norm(value):
 return "".join(c for c in unicodedata.normalize("NFKD",str(value or "")).lower() if c.isalnum() and not unicodedata.combining(c))
def get(url,attempts=3,timeout=20):
 for attempt in range(attempts):
  try:
   req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"BHL-Official-Profiles/1.0"})
   with urllib.request.urlopen(req,timeout=timeout) as response:return json.load(response)
  except (OSError,ValueError):
   if attempt==attempts-1:raise
   time.sleep(.5*(attempt+1))
def read(path,default):
 try:return json.loads((ROOT/path).read_text())
 except (OSError,ValueError):return default
def write(path,value):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,separators=(",",":"))+"\n")
ALIASES={
 "Pat Maroon":"Patrick Maroon","Christopher Tanev":"Chris Tanev","Zach Sanford":"Zachary Sanford","Daniel Vladar":"Dan Vladar","Sam Montembeault":"Samuel Montembeault","Mikhail S. Vorobyov":"Mikhail Vorobyev","Joe Veleno":"Joseph Veleno","Alexander Nylander":"Alex Nylander","Max Lajoie":"Maxime Lajoie","Mikey Eyssimont":"Michael Eyssimont","Benoit-Olivier Groulx":"Bo Groulx","Phillip Tomasino":"Philip Tomasino","Zachary Jones":"Zac Jones","Nicolas Daws":"Nico Daws","Georgi Merkulov":"Georgii Merkulov","Anton Silayev":"Anton Silaev","Yegor Surin":"Egor Surin","Benjamin Kindel":"Ben Kindel"
}
def identity(name,required_seasons=(),position_group=""):
 canonical=ALIASES.get(name,name)
 query=urllib.parse.urlencode({"culture":"en-us","limit":100,"q":canonical})
 data=get("https://search.d3.nhle.com/api/v1/search/player?"+query,attempts=1,timeout=5)
 rows=data if isinstance(data,list) else data.get("data",[])
 matches={}
 for row in rows:
  label=row.get("name") or row.get("fullName") or row.get("playerName") or ""
  if isinstance(label,dict):label=label.get("default","")
  pid=row.get("playerId") or row.get("id")
  if norm(label) in (norm(name),norm(canonical)) and str(pid).isdigit():matches[int(pid)]=label
 verified=[]
 for pid in matches:
  profile=get(f"https://api-web.nhle.com/v1/player/{pid}/landing",attempts=1,timeout=5)
  label=" ".join(filter(None,[profile.get("firstName",{}).get("default"),profile.get("lastName",{}).get("default")]))
  if norm(label) not in (norm(name),norm(canonical)):continue
  position=profile.get("position") or profile.get("positionCode") or ""
  group="goalie" if position=="G" else "defense" if position=="D" else "forward"
  if position_group and group!=position_group:continue
  played={str(x.get("season")) for x in profile.get("seasonTotals",[]) if str(x.get("leagueAbbrev")).upper()=="NHL" and x.get("gameTypeId")==2 and (x.get("gamesPlayed") or 0)>0}
  if required_seasons and not set(required_seasons).issubset(played):continue
  verified.append({"nhlId":pid,"nhlName":label,"nhlTeam":profile.get("currentTeamAbbrev") or "","position":position,"status":"confirmed","verifiedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"verification":"Official NHL name, position and BHL seasons with NHL games"})
 if len(verified)!=1:return None,"ambiguous" if len(verified)>1 else "not_found_or_season_mismatch"
 return verified[0],None
def build_identities():
 current=read("data/player-identity-map.json",{}).get("players",{})
 archived=read("data/ownership/players.json",{}).get("players",{})
 previous=read("data/historical-player-identities.json",{}).get("players",{})
 result={};pending={}
 for fid,p in {**archived,**{k:v for k,v in current.items() if v.get("status")!="confirmed"}}.items():
  if current.get(fid,{}).get("status")=="confirmed":continue
  name=p.get("name") or p.get("fantraxName")
  if not name or p.get("status") not in ("confirmed","unresolved","candidate",None):continue
  base={"fantraxName":name,"aliases":p.get("aliases",[]),"status":"unresolved","onCurrentRoster":False}
  if previous.get(fid,{}).get("status")=="confirmed":result[fid]={**base,**previous[fid]};continue
  result[fid]=base;pending.setdefault(name,[]).append(fid)
 audit=[]
 constraints={}
 for row in read("data/production/scorers.json",{}).get("rows",[]):
  if not row.get("gp"):continue
  constraint=constraints.setdefault(str(row.get("id")),{"seasons":set(),"groups":set()})
  year=int(row["season"][:4]);constraint["seasons"].add(str(year)+str(year+1));constraint["groups"].add(row.get("positionGroup"))
 tasks=[(fid,name) for name,ids in pending.items() for fid in ids]
 def lookup(task):
  fid,name=task;constraint=constraints.get(fid,{});groups=constraint.get("groups",set())
  try:return fid,name,*identity(name,constraint.get("seasons",()),next(iter(groups)) if len(groups)==1 else "")
  except (OSError,ValueError,KeyError,TypeError) as error:return fid,name,None,"lookup_error: "+str(error)[:180]
 with cf.ThreadPoolExecutor(max_workers=8) as pool:
  for fid,name,entry,reason in pool.map(lookup,tasks):
   if entry:result[fid].update(entry)
   else:audit.append({"id":fid,"name":name,"reason":reason})
 write("data/historical-player-identities.json",{"source":"Official NHL exact-name search and player landing; archived BHL Fantrax IDs","updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"players":result})
 write("data/player-profile-audit.json",{"updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"addedIdentities":len(result),"confirmed":sum(p.get("status")=="confirmed" for p in result.values()),"unresolved":audit})
 print("Historical profile identities:",len(result),"unresolved:",len(audit),flush=True)
def report(group,kind):
 rows=[];start=0
 while True:
  query=urllib.parse.urlencode({"cayenneExp":f"seasonId={SEASON} and gameTypeId=2","isAggregate":"true","isGame":"false","start":start,"limit":100,"sort":json.dumps([{"property":"playerId","direction":"ASC"}])})
  data=get(f"https://api.nhle.com/stats/rest/en/{group}/{kind}?{query}")
  batch=data.get("data",[]);rows.extend(batch);start+=len(batch)
  if not batch or start>=int(data.get("total",start)):break
  if start>4000:raise RuntimeError("Unexpected NHL pagination")
 result={}
 for row in rows:
  pid=str(row.get("playerId") or "")
  if not pid:continue
  if pid in result:
   if result[pid]==row:continue
   raise RuntimeError(f"Conflicting NHL season aggregate: {group}/{kind} {pid}")
  result[pid]=row
 return result
def number(row,*keys):
 for key in keys:
  value=row.get(key)
  if value is not None:
   try:return float(value)
   except (TypeError,ValueError):pass
 return None
def average(row,gp,*keys):
 value=number(row,*keys)
 if value is None or not gp:return "N/D"
 seconds=round(value/gp);return f"{seconds//60}:{seconds%60:02d}"
def fantasy(values,weights):
 return round(sum(values[k]*w for k,w in weights.items()),4) if all(values.get(k) is not None for k in weights) else None
def build_stats():
 reports={}
 tasks=[("skater",k) for k in ("summary","realtime","faceoffwins","timeonice","powerplay","penaltykill")]+[("goalie","summary"),("goalie","scoring")]
 def fetch(task):
  try:return task,report(*task),None
  except (OSError,ValueError,RuntimeError) as error:return task,None,str(error)
 errors={}
 with cf.ThreadPoolExecutor(max_workers=4) as pool:
  for task,data,error in pool.map(fetch,tasks):
   if data is not None:reports[task]=data
   else:errors["/".join(task)]=error
 print("Report diagnostics:",json.dumps(errors),flush=True)
 for required in [("skater","summary"),("goalie","summary")]:
  if required not in reports:raise RuntimeError("Official report unavailable: "+"/".join(required))
 if len(reports["skater","summary"])<400 or len(reports["goalie","summary"])<20:raise RuntimeError("Incomplete NHL league summaries")
 players={}
 for pid,s in reports["skater","summary"].items():
  gp=number(s,"gamesPlayed") or 0
  if not gp:continue
  r=reports.get(("skater","realtime"),{}).get(pid,{})
  f=reports.get(("skater","faceoffwins"),{}).get(pid,{})
  values={"G":number(s,"goals"),"A":number(s,"assists"),"SOG":number(s,"shots","shotsOnGoal"),"Hit":number(r,"hits"),"Blk":number(r,"blockedShotAttempts","blockedShots"),"Tk":number(r,"takeaways"),"FOW":number(f,"faceoffWins","faceoffsWon","faceoffsWonTotal","totalFaceoffWins","totalFaceoffsWon")}
  if values["FOW"] is None:values["FOW"]=number(s,"faceoffWins","faceoffsWon","faceoffsWonTotal","totalFaceoffsWon")
  fpts=fantasy(values,WEIGHTS)
  usage={label:average(reports.get(("skater",kind),{}).get(pid,{}),gp,*fields) for label,kind,fields in [("TOI","timeonice",["timeOnIce","totalTimeOnIce"]),("TOIPP","powerplay",["ppTimeOnIce","timeOnIce"]),("TOIPK","penaltykill",["shTimeOnIce","timeOnIce"])]}
  players[pid]={"name":s.get("skaterFullName") or s.get("playerName"),"goalie":False,"nhlTeam":s.get("teamAbbrevs") or s.get("teamAbbrev") or "","stats":{**values,"GP":int(gp),"FPts":fpts,"FP/G":round(fpts/gp,4) if fpts is not None else None},"usage":usage,"missing":[k for k,v in values.items() if v is None]}
 for pid,s in reports["goalie","summary"].items():
  gp=number(s,"gamesPlayed") or 0
  if not gp:continue
  scoring=reports.get(("goalie","scoring"),{}).get(pid,{})
  values={"W":number(s,"wins"),"GA":number(s,"goalsAgainst"),"SV":number(s,"saves"),"SHO":number(s,"shutouts"),"G":number(s,"goals"),"A":number(s,"assists")}
  for k,field in [("G","goals"),("A","assists")]:
   if values[k] is None:values[k]=number(scoring,field)
   if values[k] is None and ("goalie","scoring") in reports and pid not in reports["goalie","scoring"]:values[k]=0
  fpts=fantasy(values,GOALIE_WEIGHTS)
  players[pid]={"name":s.get("goalieFullName") or s.get("playerName"),"goalie":True,"nhlTeam":s.get("teamAbbrevs") or s.get("teamAbbrev") or "","stats":{**values,"GP":int(gp),"FPts":fpts,"FP/G":round(fpts/gp,4) if fpts is not None else None},"missing":[k for k,v in values.items() if v is None],"usage":{"TOI":"N/D","TOIPP":"N/D","TOIPK":"N/D"}}
 write("data/nhl-profile-stats.json",{"season":SEASON,"gameType":2,"updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"Official NHL REST season reports; BHL scoring weights; no Fantrax totals","players":players,"reportErrors":errors})
 print("Official season profiles:",len(players),"partial:",sum(bool(p["missing"]) for p in players.values()),flush=True)
if __name__=="__main__":
 build_stats()
 build_identities()
