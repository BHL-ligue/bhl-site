#!/usr/bin/env python3
"""Research-only PWHL per-game fantasy scoring; no production publication."""
import json,urllib.request,urllib.parse,datetime,pathlib
from decimal import Decimal
URL="https://lscluster.hockeytech.com/feed/index.php"
SKATER={"goals":3,"assists":2.5,"shots_on":0.3,"hits":0.1,"shots_blocked_by_player":0.2,"faceoff_wins":0.05}
GOALIE={"win":4,"goals_against":-1,"saves":0.2,"shutout":4,"goals":3,"assists":2.5}
def main():
    game_id=215
    q=urllib.parse.urlencode(dict(feed="gc",tab="gamesummary",game_id=game_id,key="446521baf8c38984",client_code="pwhl",site_id=0,lang="en"))
    with urllib.request.urlopen(URL+"?"+q,timeout=30) as response:
        gs=json.load(response)["GC"]["Gamesummary"]
    result={"game_id":game_id,"date":gs.get("meta",{}).get("date_played"),"season_id":gs.get("meta",{}).get("season_id"),"skaters":[],"goalies":[]}
    # Skaters: use per-game lineup fields verified in the API.
    for side in ("home_team_lineup","visitor_team_lineup"):
        for p in gs.get(side,{}).get("players",[]):
            missing=[k for k in SKATER if p.get(k) in (None,"")]
            fpts=None if missing else str(sum((Decimal(str(p[k]))*Decimal(str(w)) for k,w in SKATER.items()),Decimal(0)).quantize(Decimal("0.01")))
            result["skaters"].append({"id":p.get("player_id"),"name":str(p.get("first_name",""))+" "+str(p.get("last_name","")),"side":side,"stats":{k:p.get(k) for k in SKATER},"fpts":fpts,"missing":missing})
    # The goalie summary may contain multiple stints for the same player.
    # Combine stints; obtain goalie goals/assists from the roster lineup.
    for side in ("home","visitor"):
        roster={str(p.get("player_id")):p for p in gs.get(side+"_team_lineup",{}).get("goalies",[])}
        merged={}
        for p in gs.get("goalies",{}).get(side,[]):
            pid=str(p.get("player_id"))
            if pid not in merged:
                merged[pid]={"player_id":pid,"first_name":p.get("first_name"),"last_name":p.get("last_name"),
                             "win":"0","shutout":"0","saves":"0","goals_against":"0"}
            target=merged[pid]
            for k in ("saves","goals_against"):
                target[k]=str(Decimal(target[k])+Decimal(str(p.get(k) or 0)))
            for k in ("win","shutout"):
                target[k]=str(max(Decimal(target[k]),Decimal(str(p.get(k) or 0))))
        for pid,p in merged.items():
            lineup=roster.get(pid,{})
            for k in ("goals","assists"):
                p[k]=lineup.get(k)
            missing=[k for k in GOALIE if p.get(k) in (None,"")]
            fpts=None if missing else str(sum((Decimal(str(p[k]))*Decimal(str(w)) for k,w in GOALIE.items()),Decimal(0)).quantize(Decimal("0.01")))
            result["goalies"].append({"id":pid,"name":str(p.get("first_name",""))+" "+str(p.get("last_name","")),"side":side,"stats":{k:p.get(k) for k in GOALIE},"fpts":fpts,"missing":missing})
    for role in ("skaters","goalies"):
        result[role].sort(key=lambda p:(p["fpts"] is None,-float(p["fpts"] or 0)))
    result["summary"]={role:{"total":len(result[role]),"scored":sum(p["fpts"] is not None for p in result[role])} for role in ("skaters","goalies")}
    path=pathlib.Path("research/pwhl/game-fpts-sample.json")
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"summary":result["summary"],"top_skaters":result["skaters"][:3],"top_goalies":result["goalies"][:3]},ensure_ascii=False))
if __name__=="__main__":main()
