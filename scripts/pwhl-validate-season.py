#!/usr/bin/env python3
"""Validate research PWHL fantasy season completeness before declaring success."""
import json
from pathlib import Path
from decimal import Decimal

ROOT=Path("research/pwhl")
INDEX=json.loads((ROOT/"season-game-index.json").read_text(encoding="utf-8"))
AGG=json.loads((ROOT/"season-aggregate-sample.json").read_text(encoding="utf-8"))
SEASON="2025-26"
ids=set(map(str,INDEX["seasons"][SEASON]["game_ids"]))
files=list((ROOT/"batch"/SEASON).glob("*.json"))
loaded={}
errors=[]
for path in files:
    try:
        r=json.loads(path.read_text(encoding="utf-8"))
        gid=str(r["game_id"])
        if gid not in ids:errors.append(f"Unknown game {gid}")
        if gid in loaded:errors.append(f"Duplicate game {gid}")
        if str(r.get("season_id"))!=str(INDEX["seasons"][SEASON]["season_id"]):
            errors.append(f"Season mismatch {gid}")
        for role in ("skaters","goalies"):
            if any(x.get("fpts") is None for x in r.get(role,[])):
                errors.append(f"Incomplete fantasy points {gid}/{role}")
        loaded[gid]=r
    except Exception as exc:errors.append(f"{path.name}: {exc}")
aggregate_games=AGG.get("games_loaded",0)
if aggregate_games!=len(loaded):errors.append(f"Aggregate has {aggregate_games} games but {len(loaded)} reports exist")
count=sum(len(r.get(role,[])) for r in loaded.values() for role in ("skaters","goalies"))
if AGG.get("scored_player_games")!=count:errors.append("Aggregate player-game count differs from reports")
for p in AGG.get("standings",[]):
    if p["gp"]<=0 or abs(Decimal(p["fpts"])/p["gp"]-Decimal(p["fp_gp"]))>Decimal("0.006"):
        errors.append("FP/GP arithmetic mismatch for "+p["name"])
manifest_errors={}
for path in sorted(ROOT.glob("batch-manifest-"+SEASON+"-*.json")):
    m=json.loads(path.read_text(encoding="utf-8"))
    if m.get("skipped"):manifest_errors[path.name]=m["skipped"]
report={"season":SEASON,"scheduled_games":len(ids),"imported_games":len(loaded),
        "missing_game_ids":sorted(ids-set(loaded),key=int),
        "scored_player_games":count,"unique_players":len(AGG.get("standings",[])),
        "complete_schedule":len(loaded)==len(ids) and not errors and not manifest_errors,
        "errors":errors,"skipped_by_batch":manifest_errors,
        "note":"A complete import is not equivalent to official-stat reconciliation or API licensing."}
(ROOT/"season-validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k not in ("missing_game_ids","skipped_by_batch")},ensure_ascii=False))
if errors:raise SystemExit(1)
