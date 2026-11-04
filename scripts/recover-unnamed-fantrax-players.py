"""Recover deleted/retired Fantrax names from the original historical stats tables.
Only exact scorerId records may confirm a name. Numeric BHL statistics are unchanged.
"""
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LEAGUES={"2018-19":"vwa89uoajhz15dxv","2019-20":"2uolurhgjv9p9ryl","2020-21":"x84a2ac9kb7zbs0w","2021-22":"o981oceokoydzrkt","2023-24":"ukw6z6r2lgjl09qn"}
def post(league,data):
 body=json.dumps({"msgs":[{"method":"getPlayerStats","data":{"leagueId":league,"view":"STATS","statusOrTeamFilter":"ALL","positionOrGroup":"HOCKEY_SKATING","pageNumber":"1","maxResultsPerPage":"10000","miscDisplayType":"1",**data}}]}).encode()
 req=urllib.request.Request("https://www.fantrax.com/fxpa/req?"+urllib.parse.urlencode({"leagueId":league}),data=body,headers={"Content-Type":"application/json","User-Agent":"BHL-Archive-Identity/1.0",**({"Cookie":os.environ["FANTRAX_COOKIE"].strip()} if os.environ.get("FANTRAX_COOKIE","").strip() else {})})
 with urllib.request.urlopen(req,timeout=40) as response:raw=json.load(response)
 responses=raw.get("responses") or []
 result=responses[0].get("data",{}) if responses else {}
 if not isinstance(result.get("statsTable"),list):raise ValueError("No historical stats table: "+str(raw)[:300])
 return result
def rows_for(season,league,group):
 data=post(league,{"positionOrGroup":group})
 wanted=season+" Reg Season - YTD"
 displayed=data.get("displayedSeasonOrProjection",{})
 if displayed.get("name")!=wanted:
  choice=next((p for p in data.get("seasonOrProjections",[]) if p.get("name")==wanted),None)
  if not choice:raise ValueError("Historical season not available: "+wanted)
  data=post(league,{"positionOrGroup":group,"seasonOrProjection":choice["code"]})
 if data.get("displayedSeasonOrProjection",{}).get("name")!=wanted:raise ValueError("Wrong stats season")
 code=data["displayedSeasonOrProjection"]["code"]
 yield data,code
 pages=int(data.get("paginatedResultSet",{}).get("totalNumPages") or 1)
 if pages>100:raise ValueError("Excessive pagination")
 for page in range(2,pages+1):
  data=post(league,{"positionOrGroup":group,"seasonOrProjection":code,"pageNumber":str(page)})
  if data.get("displayedSeasonOrProjection",{}).get("code")!=code:raise ValueError("Wrong season during pagination")
  yield data,code
def main():
 path=ROOT/"data/ownership/players.json";directory=json.loads(path.read_text());missing={pid for pid,p in directory["players"].items() if not p.get("name")}
 report={"updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"requestedIds":sorted(missing),"matches":{},"sources":[],"unresolved":[]}
 found={}
 print("Authenticated Fantrax session configured:",bool(os.environ.get("FANTRAX_COOKIE","").strip()),flush=True)
 for season,league in LEAGUES.items():
  if not missing-found.keys():break
  for group in ("HOCKEY_SKATING","POS_201"):
   source={"season":season,"leagueId":league,"positionGroup":group,"rows":0}
   try:
    for data,code in rows_for(season,league,group):
     source["seasonCode"]=code;source["rows"]+=len(data["statsTable"])
     for row in data["statsTable"]:
      scorer=row.get("scorer") or {};pid=str(scorer.get("scorerId") or "").replace("*","")
      name=str(scorer.get("name") or "").strip()
      if pid not in missing or not name:continue
      if "<" in name or ">" in name:raise ValueError("Unexpected name markup")
      if "," in name:
       last,first=name.split(",",1);name=first.strip()+" "+last.strip()
      if pid in found and found[pid]!=name:raise ValueError("Conflicting names for "+pid)
      found[pid]=name;report["matches"][pid]={"name":name,"rawName":scorer["name"],"season":season,"leagueId":league,"seasonCode":code,"position":scorer.get("posShortNames"),"source":"Fantrax getPlayerStats exact scorerId"}
   except Exception as error:source["error"]=str(error)
   report["sources"].append(source)
   print("IDENTITY_SOURCE",json.dumps(source),flush=True)
 for pid,name in found.items():
  directory["players"][pid].update(name=name,status="confirmed")
  directory["players"][pid]["identitySource"]=report["matches"][pid]
 directory["unresolvedIds"]=sorted(pid for pid,p in directory["players"].items() if not p.get("name"))
 report["unresolved"]=directory["unresolvedIds"]
 path.write_text(json.dumps(directory,ensure_ascii=False,separators=(",",":"))+"\n")
 scorers_path=ROOT/"data/production/scorers.json";scorers=json.loads(scorers_path.read_text())
 for row in scorers["rows"]:
  if not row.get("name") and row["id"] in found:row["name"]=found[row["id"]]
 scorers_path.write_text(json.dumps(scorers,ensure_ascii=False,separators=(",",":"))+"\n")
 (ROOT/"data/ownership/identity-recovery.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 print("IDENTITY_RECOVERY",json.dumps({"recovered":len(found),"unresolved":report["unresolved"],"names":found},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
