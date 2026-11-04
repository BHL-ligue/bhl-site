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
# Player-level evidence from the audited starting lineups, when available.
audit_path = ROOT / "data/production/audits/2023-24.json"
if audit_path.exists():
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    selected = {(x["period"], x["team"]) for x in report["sampleHitOnly"]}
    evidence = []
    for period in audit.get("periods", []):
        for team in period.get("teams", []):
            if (period["period"], team["team"]) not in selected:
                continue
            players = []
            for player in team.get("players", []):
                value = player.get("stats", {}).get("Hit")
                if value is None:
                    continue
                players.append({
                    "name": player["name"],
                    "fantraxId": player["fantraxId"],
                    "nhlId": player.get("nhlId"),
                    "position": player.get("position"),
                    "reconstructedHits": value,
                    "reconstructedHitFpts": player.get("categoryPoints", {}).get("Hit", 0),
                })
            players.sort(key=lambda p: -p["reconstructedHits"])
            evidence.append({
                "period": period["period"], "team": team["team"],
                "start": period.get("start"), "end": period.get("end"),
                "officialTeamHitFpts": team.get("officialCategoryPoints", {}).get("Hit"),
                "reconstructedTeamHitFpts": team.get("calculatedCategoryPoints", {}).get("Hit"),
                "players": players,
            })
    evidence.sort(key=lambda x: (x["period"], x["team"]))
    evidence_path = ROOT / "data/production/hit-player-evidence-2023-24.json"
    evidence_path.write_text(json.dumps({
        "status": "reconstructed_player_hits_not_verified_against_original_fantrax_player_counts",
        "season": "2023-24", "examples": evidence,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Wrote", evidence_path, "examples:", len(evidence))
print("Wrote", output)

# Reconciliation worksheet: actionable per-player samples for checking against
# Fantrax's ORIGINAL period HIT totals (not NHL's subsequently updated totals).
# Never infer an individual Fantrax count from a team-wide discrepancy.
if audit_path.exists():
    rows = []
    for example in evidence:
        for player in example["players"]:
            rows.append({
                "season": "2023-24",
                "period": example["period"],
                "team": example["team"],
                "periodStart": example["start"],
                "periodEnd": example["end"],
                "fantraxId": player["fantraxId"],
                "nhlId": player["nhlId"],
                "player": player["name"],
                "nhlReconstructedHits": player["reconstructedHits"],
                "fantraxOriginalHits": None,
                "individualHitDifference": None,
                "teamFantraxHitFpts": example["officialTeamHitFpts"],
                "teamReconstructedHitFpts": example["reconstructedTeamHitFpts"],
                "verification": "pending_original_fantrax_player_hits"
            })
    import csv
    worksheet = ROOT / "data/production/hit-reconciliation-2023-24.csv"
    if rows:
        with worksheet.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
    print("Wrote reconciliation worksheet", worksheet, "players:", len(rows))
