#!/usr/bin/env python3
"""Build unpublished, per-game PWHL fantasy data from the verified HockeyTech game summary.

Run: python scripts/pwhl-game-fantasy.py --game-id 215 --output research/pwhl/sample-game-fpts.json
Missing statistics are not treated as zero. The output is research data, not live BHL production.
"""
import argparse
import datetime as dt
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from importlib.machinery import SourceFileLoader

probe=SourceFileLoader("pwhl_probe",str(Path(__file__).with_name("pwhl-api-probe.py"))).load_module()
SKATER={"goals":"3","assists":"2.5","shots_on":"0.3","hits":"0.1","shots_blocked_by_player":"0.2","faceoff_wins":"0.05"}
GOALIE={"win":"4","goals_against":"-1","saves":"0.2","shutout":"4","goals":"3","assists":"2.5"}

def calculate(row,weights):
    missing=[key for key in weights if row.get(key) is None or row.get(key)==""]
    if missing:return {"fpts":None,"missing":missing}
    try:
        score=sum((Decimal(str(row[key]))*Decimal(weight) for key,weight in weights.items()),Decimal("0"))
    except (InvalidOperation,TypeError,ValueError):
        return {"fpts":None,"missing":["invalid numeric field"]}
    return {"fpts":str(score.quantize(Decimal("0.01"))),"missing":[]}

def normalize(row,position,side):
    weights=SKATER if position=="skater" else GOALIE
    return {"player_id":str(row.get("player_id") or ""),"name":(" ".join(str(row.get(k) or "") for k in ("first_name","last_name"))).strip(),
            "position":row.get("position_str") or row.get("position"),"type":position,"side":side,
            "stats":{k:row.get(k) for k in weights},**calculate(row,weights)}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--game-id",type=int,default=215)
    p.add_argument("--output",default="research/pwhl/sample-game-fpts.json")
    args=p.parse_args()
    payload=probe.request("gc",tab="gamesummary",game_id=args.game_id)
    summary=payload.get("GC",{}).get("Gamesummary",{})
    if not summary or str(summary.get("meta",{}).get("id"))!=str(args.game_id):
        raise RuntimeError("No matching game summary: refusing to publish misleading data")
    meta=summary["meta"]
    results=[]
    for side in ("home","visitor"):
        lineup=summary.get(side+"_team_lineup",{})
        for row in lineup.get("players",[]):results.append(normalize(row,"skater",side))
        # Goalies in the game summary have an explicit win/shutout and saves.
        # Use these rows, not roster-only entries.
        for row in summary.get("goalies",{}).get(side,[]):results.append(normalize(row,"goalie",side))
    report={"source":"PWHL HockeyTech game summary","generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
            "game_id":str(args.game_id),"season_id":meta.get("season_id"),"date":meta.get("date_played"),
            "experimental_weights":{"skaters":SKATER,"goalies":GOALIE},
            "player_count":len(results),"scored_count":sum(x["fpts"] is not None for x in results),
            "players":sorted(results,key=lambda x:(x["fpts"] is None,-float(x["fpts"] or 0),x["name"]))}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Game {args.game_id}: {report['scored_count']}/{report['player_count']} players scored. Output: {out}")
if __name__=="__main__":main()
