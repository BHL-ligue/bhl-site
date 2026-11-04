"""Investigate historical HIT discrepancies without changing scoring totals.

Usage: python scripts/analyze-hit-discrepancies.py
"""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "data/production/diagnostics.json"
data = json.loads(source.read_text(encoding="utf-8"))
records = [r for r in data["mismatches"] if r["season"] == "2023-24"]
hit = [r for r in records if abs(r["categoryDifferences"].get("Hit", 0)) >= .005]
only_hit = [r for r in hit if set(r["categoryDifferences"]) == {"Hit"}]
by_team = collections.defaultdict(lambda: {"periods": 0, "positive": 0, "negative": 0, "hitFptsDifference": 0.0})
for r in hit:
    item = by_team[r["team"]]
    item["periods"] += 1
    delta = r["categoryDifferences"]["Hit"]
    item["positive" if delta > 0 else "negative"] += 1
    item["hitFptsDifference"] += delta
for item in by_team.values():
    item["hitFptsDifference"] = round(item["hitFptsDifference"], 2)
report = {
    "season": "2023-24",
    "status": "hypothesis_not_verified",
    "source": "data/production/diagnostics.json",
    "comparisonsWithDiscrepancy": len(records),
    "comparisonsWithHitDiscrepancy": len(hit),
    "hitOnlyDiscrepancies": len(only_hit),
    "positiveHitDiscrepancies": sum(r["categoryDifferences"]["Hit"] > 0 for r in hit),
    "negativeHitDiscrepancies": sum(r["categoryDifferences"]["Hit"] < 0 for r in hit),
    "byTeam": dict(sorted(by_team.items())),
    "sampleHitOnly": [
        {"period": r["period"], "team": r["team"], "fantraxFpts": r["official"],
         "reconstructedFpts": r["calculated"], "hitFptsDifference": r["categoryDifferences"]["Hit"]}
        for r in sorted(only_hit, key=lambda x: (-abs(x["categoryDifferences"]["Hit"]), x["period"]))[:25]
    ],
    "nextValidation": "Compare original Fantrax individual HIT counts with NHL historical game-by-game counts for the same starting players and scoring periods. Do not alter points until corroborated."
}
output = ROOT / "data/production/hit-investigation-2023-24.json"
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k not in ("byTeam", "sampleHitOnly")}, ensure_ascii=False, indent=2))
print("Wrote", output)
