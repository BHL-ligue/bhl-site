#!/usr/bin/env python3
"""Read-only PWHL HockeyTech API smoke test. Run: python scripts/pwhl-api-probe.py

No fantasy points are inferred from absent fields. Reports are written locally
and should not be published to the main BHL website.
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import urllib.parse
import urllib.request

BASE="https://lscluster.hockeytech.com/feed/index.php"
COMMON={"key":"446521baf8c38984","client_code":"pwhl","site_id":"0","lang":"en"}
def request(feed,view=None,**kwargs):
    params=dict(COMMON,feed=feed,callback="angular.callbacks._0",**kwargs)
    if view:params["view"]=view
    url=BASE+"?"+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={"User-Agent":"BHL-PWHL-Research/0.1 (read-only)","Accept":"application/json,text/javascript,*/*"})
    with urllib.request.urlopen(req,timeout=25) as response:
        body=response.read(8_000_000).decode("utf-8-sig")
    match=re.match(r"^\s*[\w.$]+\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$",body)
    if match:body=match.group(1)
    return json.loads(body)
def shape(obj):
    if isinstance(obj,list):return {"type":"array","count":len(obj),"sample":shape(obj[0]) if obj else None}
    if isinstance(obj,dict):return {"type":"object","keys":list(obj)[:35],"sample":{k:shape(v) for k,v in list(obj.items())[:6]}}
    return type(obj).__name__
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="pwhl-api-probe-report.json")
    parser.add_argument("--season-id",type=int,default=8,help="HockeyTech season id, confirm from seasons response")
    parser.add_argument("--game-id",type=int,default=215,help="Sample game id, confirm from schedule")
    args=parser.parse_args()
    tests=[
      ("seasons",dict(feed="modulekit",view="seasons")),
      ("schedule",dict(feed="statviewfeed",view="schedule",season=args.season_id,team=-1,month=-1,location="homeaway",league_id=1,conference_id=-1,division_id=-1)),
      ("game_summary",dict(feed="gc",tab="gamesummary",game_id=args.game_id)),
      ("play_by_play",dict(feed="statviewfeed",view="gameCenterPlayByPlay",game_id=args.game_id,league_id=1)),
      ("shifts",dict(feed="modulekit",view="gameshifts",game_id=args.game_id)),
      ("player_stats",dict(feed="statviewfeed",view="players",season=args.season_id,team=-1,position="skaters",page=1)),
    ]
    report={"testedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"HockeyTech PWHL","seasonId":args.season_id,"gameId":args.game_id,"tests":{}}
    for name,params in tests:
        try:
            result=request(**params)
            report["tests"][name]={"ok":True,"shape":shape(result)}
            print(name,"OK",json.dumps(report["tests"][name]["shape"],ensure_ascii=False)[:350])
        except Exception as exc:
            report["tests"][name]={"ok":False,"error":str(exc)[:400]}
            print(name,"FAILED",str(exc)[:180])
    pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Report:",args.output)
if __name__=="__main__":main()
