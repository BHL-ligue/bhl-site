#!/usr/bin/env python3
"""Experimental PWHL fantasy scoring: only explicit numeric stats are scored.

Run: python scripts/pwhl-fantasy-scoring.py
The sample below is synthetic, not a PWHL player's real performance.
"""
from decimal import Decimal
from typing import Mapping

# Draft only. All weights are subject to the league's approval.
SKATER_WEIGHTS = {
    "goals": Decimal("3"),
    "assists": Decimal("2.5"),
    "shots": Decimal("0.3"),
}
GOALIE_WEIGHTS = {
    "wins": Decimal("4"),
    "goals_against": Decimal("-1"),
    "saves": Decimal("0.2"),
    "shutouts": Decimal("4"),
}

def score(stats: Mapping[str, object], weights: Mapping[str, Decimal]):
    missing = [name for name in weights if name not in stats or stats[name] is None]
    if missing:
        return {"status": "incomplete", "missing": missing, "fpts": None}
    try:
        points = sum((Decimal(str(stats[name])) * weight for name, weight in weights.items()), Decimal(0))
    except (ValueError, ArithmeticError, TypeError):
        return {"status": "invalid", "fpts": None}
    return {"status": "complete", "fpts": str(points.quantize(Decimal("0.01")))}

def demo():
    assert score({"goals": 1, "assists": 2, "shots": 4}, SKATER_WEIGHTS)["fpts"] == "9.20"
    assert score({"wins": 1, "goals_against": 2, "saves": 30, "shutouts": 0}, GOALIE_WEIGHTS)["fpts"] == "8.00"
    assert score({"goals": 1, "assists": 2}, SKATER_WEIGHTS)["status"] == "incomplete"
    print("Synthetic scoring tests passed. No actual PWHL stats imported.")
if __name__ == "__main__":
    demo()
