"""Compute provisional BHL starter FPTS from public NHL game data (no Fantrax login)."""
import datetime as dt
import json
import os
import time
import urllib.request
from collections import defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("America/Toronto")
API = "https://api-web.nhle.com/v1"

def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "BHL-Stats/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=22) as response:
                return json.load(response)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt * 2)

def as_number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0

def faceoff_wins(plays):
    wins = defaultdict(int)
    for play in plays:
        if play.get("typeDescKey") == "faceoff":
            player = (play.get("details") or {}).get("winningPlayerId")
            if player:
                wins[str(player)] += 1
    return wins

def game_points(box, wins):
    result = defaultdict(float)
    stats = box.get("playerByGameStats") or {}
    for side in ("awayTeam", "homeTeam"):
        team = stats.get(side) or {}
        for position in ("forwards", "defense"):
            for p in team.get(position) or []:
                pid = str(p.get("playerId"))
                result[pid] += (3 * as_number(p.get("goals")) +
                    2.5 * as_number(p.get("assists")) +
                    0.3 * as_number(p.get("sog")) +
                    0.1 * as_number(p.get("takeaways")) +
                    0.1 * as_number(p.get("hits")) +
                    0.2 * as_number(p.get("blockedShots")) +
                    0.05 * wins.get(pid, 0))
        for p in team.get("goalies") or []:
            pid = str(p.get("playerId"))
            shots = str(p.get("saveShotsAgainst") or "0/0").split("/")
            saves = as_number(shots[0]) if shots else 0
            if not saves:
                saves = as_number(p.get("saves"))
            shutout = int(as_number(p.get("goalsAgainst")) == 0 and saves > 0 and p.get("decision") == "W")
            result[pid] += (4 * (p.get("decision") == "W") -
                as_number(p.get("goalsAgainst")) +
                2.5 * as_number(p.get("assists")) +
                3 * as_number(p.get("goals")) +
                0.2 * saves + 4 * shutout)
    return result

def main():
    snapshot = json.loads((ROOT / "data/fantrax.json").read_text())
    identities = json.loads((ROOT / "data/player-identity-map.json").read_text()).get("players", {})
    period = int(snapshot["rosterPeriod"])
    if period != int(snapshot["scoringPeriod"]):
        raise RuntimeError("Roster and scoring periods differ: refuse to mix alignments")
    start = dt.datetime.fromisoformat(snapshot["periodDates"]["startDate"]).astimezone(TZ).date()
    today = dt.datetime.now(TZ).date()
    if today < start or (today - start).days > 10:
        raise RuntimeError("Period dates are stale or inconsistent")
    active = defaultdict(list)
    unresolved = []
    for team in snapshot["teams"]:
        for player in team["players"]:
            if player.get("status") != "ACTIVE":
                continue
            identity = identities.get(player["id"]) or {}
            nhl_id = identity.get("nhlId")
            if not nhl_id:
                unresolved.append({"team": team["name"], "player": player["name"]})
                continue
            group = "goalie" if player.get("position") == "G" else ("defense" if player.get("position") == "D" else "forward")
            active[str(nhl_id)].append((team["name"], player["id"], player["name"], group))
    # Use game dates in Montreal; never include future games or unfinished boxscores.
    totals = defaultdict(lambda: {"forward": 0.0, "defense": 0.0, "goalie": 0.0})
    players = defaultdict(float)
    seen = set()
    checked = 0
    date = start
    while date <= today:
        schedule = get(f"{API}/score/{date.isoformat()}")
        for game in schedule.get("games") or []:
            game_id = game.get("id")
            if not game_id or game_id in seen or game.get("gameState") not in ("OFF", "FINAL"):
                continue
            seen.add(game_id)
            box = get(f"{API}/gamecenter/{game_id}/boxscore")
            play = get(f"{API}/gamecenter/{game_id}/play-by-play")
            points = game_points(box, faceoff_wins(play.get("plays") or []))
            for nhl_id, fpts in points.items():
                for team_name, fantrax_id, player_name, group in active.get(nhl_id, []):
                    totals[team_name][group] += fpts
                    players[(team_name, fantrax_id, player_name, group)] += fpts
            checked += 1
        date += dt.timedelta(days=1)
    # A new period may have no completed games yet; publish zero provisional FPTS.
    output = {
        "source": "NHL public boxscores and play-by-play; provisional BHL calculation",
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "period": period, "startDate": start.isoformat(), "throughDate": today.isoformat(),
        "gamesChecked": checked, "unresolved": unresolved,
        "teams": {team: {group: round(value + 1e-8, 2) for group, value in groups.items()} for team, groups in totals.items()},
        "players": [{"team": team, "id": pid, "name": name, "positionGroup": group, "fpts": round(value + 1e-8, 2)}
                    for (team, pid, name, group), value in players.items()]
    }
    target = ROOT / "data/production/current-period.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Computed period {period}: {checked} completed NHL games, {len(players)} BHL starters, {len(unresolved)} unresolved IDs")

if __name__ == "__main__":
    main()
