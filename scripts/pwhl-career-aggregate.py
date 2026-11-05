#!/usr/bin/env python3
"""Build unpublished PWHL career fantasy standings from validated season aggregates.

Only seasons whose aggregate exists are included. Never label a partial season
as complete. Identity is based on HockeyTech player_id, not display name.
"""
import argparse,json
from pathlib import Path
from collections import defaultdict
from decimal import Decimal

SOURCES={"2024":("season-aggregate-2024.json",72),
         "2024-25":("season-aggregate-2024-25.json",90),
         "2025-26":("season-aggregate-sample.json",120)}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",default="research/pwhl")
    p.add_argument("--output",default="research/pwhl/career-standings.json")
    args=p.parse_args()
    root=Path(args.root)
    totals=defaultdict(lambda:{"gp":0,"fpts":Decimal("0"),"seasons":[]})
    coverage={}
    for season,(filename,expected) in SOURCES.items():
        path=root/filename
        if not path.exists():
            coverage[season]={"status":"not_imported","expected_games":expected}
            continue
        report=json.loads(path.read_text(encoding="utf-8"))
        loaded=report.get("games_loaded",0)
        coverage[season]={"status":"complete" if loaded==expected and not report.get("incomplete_player_games") else "partial",
                          "imported_games":loaded,"expected_games":expected}
        if coverage[season]["status"]!="complete":
            continue
        for player in report.get("standings",[]):
            key=(player["type"],str(player["player_id"]))
            row=totals[key]
            row["name"]=player["name"]
            row["gp"]+=int(player["gp"])
            row["fpts"]+=Decimal(str(player["fpts"]))
            row["seasons"].append({"season":season,"gp":int(player["gp"]),"fpts":player["fpts"],"fp_gp":player["fp_gp"]})
    standings=[]
    for (role,pid),row in totals.items():
        standings.append({"type":role,"player_id":pid,"name":row["name"],"gp":row["gp"],
                          "fpts":str(row["fpts"].quantize(Decimal("0.01"))),
                          "fp_gp":str((row["fpts"]/row["gp"]).quantize(Decimal("0.01"))),
                          "seasons":row["seasons"]})
    standings.sort(key=lambda r:(r["type"],-Decimal(r["fpts"]),r["name"]))
    output={"scope":"Only complete imported seasons. Not yet reconciled to official published totals.",
            "coverage":coverage,"players":len(standings),"standings":standings}
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"coverage":coverage,"players":len(standings)},ensure_ascii=False))
if __name__=="__main__":main()
