#!/usr/bin/env python3
"""Aggregate PWHL game-level FPTS reports. Research only, never public BHL."""
import argparse
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

def aggregate(paths):
    games=set()
    player_games=set()
    totals=defaultdict(lambda:{"fpts":Decimal("0"),"gp":0})
    incomplete=[]
    for path in paths:
        data=json.loads(Path(path).read_text(encoding="utf-8"))
        season=str(data.get("season_id") or "")
        game=str(data.get("game_id") or "")
        if not season or not game:
            raise ValueError(f"Missing season or game ID: {path}")
        if (season,game) in games:
            raise ValueError(f"Repeated game report: {season}/{game}")
        games.add((season,game))
        for role in ("skaters","goalies"):
            for player in data.get(role,[]):
                pid=str(player.get("id") or "")
                if not pid:
                    raise ValueError(f"Missing player ID in {path}")
                key=(season,game,role,pid)
                if key in player_games:
                    raise ValueError(f"Duplicate player/game record: {key}")
                player_games.add(key)
                fpts=player.get("fpts")
                if fpts is None:
                    incomplete.append({"season_id":season,"game_id":game,"player_id":pid,"role":role,"missing":player.get("missing",[])})
                    continue
                k=(season,role,pid)
                totals[k]["fpts"]+=Decimal(str(fpts))
                totals[k]["gp"]+=1
                totals[k]["name"]=player.get("name","")
    standings=[]
    for (season,role,pid),t in totals.items():
        standings.append({"season_id":season,"type":role,"player_id":pid,"name":t["name"],
                          "gp":t["gp"],"fpts":str(t["fpts"].quantize(Decimal("0.01"))),
                          "fp_gp":str((t["fpts"]/t["gp"]).quantize(Decimal("0.01")))})
    standings.sort(key=lambda p:(p["season_id"],p["type"],-Decimal(p["fpts"]),p["name"]))
    return {"scope":"Only imported completed games, NOT complete-season standings",
            "games_loaded":len(games),"scored_player_games":sum(t["gp"] for t in totals.values()),
            "incomplete_player_games":incomplete,"standings":standings}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("reports",nargs="+")
    parser.add_argument("--output",default="research/pwhl/season-aggregate-sample.json")
    args=parser.parse_args()
    result=aggregate(args.reports)
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"games_loaded":result["games_loaded"],"scored_player_games":result["scored_player_games"],"incomplete":len(result["incomplete_player_games"]),"players":len(result["standings"])}))
if __name__=="__main__":
    main()
