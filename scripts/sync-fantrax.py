"""Fetch a complete public Fantrax snapshot; retain previous data on failure."""
import datetime as dt
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

LEAGUE = "32q8rjpomo2tig1z"

def fetch(method, **params):
    query = urllib.parse.urlencode(({"sport": "NHL", **params} if method == "getPlayerIds" else {"leagueId": LEAGUE, **params}))
    request = urllib.request.Request(
        "https://www.fantrax.com/fxea/general/" + method + "?" + query,
        headers={"User-Agent": "BHL-Sync/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        result = json.load(response)
    if not isinstance(result, (dict, list)) or (isinstance(result, dict) and ("error" in result or "errors" in result)):
        raise ValueError("Invalid Fantrax response: " + method)
    return result

def period_at(periods, now):
    for period in periods:
        start = dt.datetime.fromisoformat(period["startDate"])
        end = dt.datetime.fromisoformat(period["endDate"])
        if start <= now <= end:
            return period["number"]
    raise ValueError("No period covers the current date; previous snapshot retained")

def build_snapshot(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    info = fetch("getLeagueInfo", excludePlayerInfo="true")
    roster_period = period_at(info["rosterPeriods"], now)
    scoring_period = period_at(info["scoringPeriods"], now)
    rosters = fetch("getTeamRosters", period=roster_period)
    standings = fetch("getStandings")
    scores = fetch("getMatchupScores", period=scoring_period)
    if len(rosters.get("rosters", {})) != 16 or len(standings) != 16:
        raise ValueError("Expected 16 teams")
    if rosters.get("period") != roster_period or scores.get("period") != scoring_period:
        raise ValueError("Fantrax returned an unexpected period")
    # Rebuild fantasy points against from the opponent's scores in each period.
    # The public getStandings endpoint omits this column.
    against_by_team = {team_id: 0.0 for team_id in rosters["rosters"]}
    try:
        for period in info["scoringPeriods"]:
            period_no = period["number"]
            if period_no > scoring_period:
                continue
            period_scores = scores if period_no == scoring_period else fetch("getMatchupScores", period=period_no)
            for matchup in period_scores.get("matchups", []):
                away, home = matchup["away"], matchup["home"]
                if away.get("teamId") in against_by_team and home.get("score") is not None:
                    against_by_team[away["teamId"]] += float(home["score"])
                if home.get("teamId") in against_by_team and away.get("score") is not None:
                    against_by_team[home["teamId"]] += float(away["score"])
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Historical opponent scores unavailable: {error}")
        against_by_team = {}
    player_info = fetch("getPlayerIds")
    if not isinstance(player_info, dict) or not player_info:
        raise ValueError("Missing player names")
    teams = []
    for team_id, roster in rosters["rosters"].items():
        players = []
        for item in roster["rosterItems"]:
            player = player_info.get(item["id"], {})
            name = player.get("name") or player.get("playerName")
            if not name:
                raise ValueError("Missing player name: " + item["id"])
            if ", " in name:
                last, first = name.split(", ", 1)
                name = first + " " + last
            players.append({"id": item["id"], "name": name, "position": item.get("position", ""), "status": item.get("status", "")})
        teams.append({"id": team_id, "name": roster["teamName"], "players": players})
    # Whitelist published fields: never publish owner/contact/profile data.
    return {
        "leagueId": LEAGUE, "leagueName": info["leagueName"],
        "season": info.get("seasonYear"), "updatedAt": now.isoformat(),
        "rosterPeriod": roster_period, "scoringPeriod": scoring_period,
        "periodDates": next(p for p in info["scoringPeriods"] if p["number"] == scoring_period),
        "teams": teams,
        "standings": [{
            **{k: row[k] for k in (
                "teamId", "teamName", "rank", "points", "totalPointsFor",
                "winPercentage", "gamesBack", "wins", "losses", "ties",
                "totalPointsAgainst", "fantasyPointsAgainst", "pointsAgainst",
                "playoffProbability", "playoffPercentage", "playoffOdds",
                "playoffChance", "playoffPercent", "totalPoints",
            ) if k in row and isinstance(row[k], (int, float, str, type(None)))},
            **({"totalPointsAgainst": round(against_by_team[row["teamId"]], 2)} if row.get("teamId") in against_by_team and not any(k in row for k in ("totalPointsAgainst", "fantasyPointsAgainst", "pointsAgainst")) else {}),
        } for row in standings],
        "matchups": [{"away": {k: m["away"][k] for k in ("teamId", "teamName", "score", "gamesPlayed") if k in m["away"]},
                      "home": {k: m["home"][k] for k in ("teamId", "teamName", "score", "gamesPlayed") if k in m["home"]}}
                     for m in scores["matchups"]],
    }

if __name__ == "__main__":
    snapshot = build_snapshot()
    path = Path(__file__).resolve().parents[1] / "data" / "fantrax.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)
    print(f"Updated {len(snapshot['teams'])} teams; roster period {snapshot['rosterPeriod']}, scoring period {snapshot['scoringPeriod']}")
