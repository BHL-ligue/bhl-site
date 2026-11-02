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

def fetch_roster_stats(team_id, period):
    """Read-only Fantrax site endpoint; failures leave the public roster intact."""
    payload = {
        "msgs": [{"method": "getTeamRosterInfo", "data": {
            "leagueId": LEAGUE, "reload": "1", "period": str(period),
            "teamId": team_id, "statsType": "2"
        }}],
        "uiv": 3, "refUrl": (
            f"https://www.fantrax.com/fantasy/league/{LEAGUE}/team/roster;"
            f"reload=1;period={period};teamId={team_id}"
        ), "dt": 0, "at": 0, "av": "0.0", "tz": "UTC", "v": "186.1.9"
    }
    cookie = os.environ.get("FANTRAX_COOKIE", "").strip()
    if not cookie:
        raise ValueError("FANTRAX_COOKIE secret not configured")
    request = urllib.request.Request(
        f"https://www.fantrax.com/fxpa/req?leagueId={LEAGUE}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json",
                 "Content-Type": "application/json",
                 "Origin": "https://www.fantrax.com",
                 "Referer": f"https://www.fantrax.com/fantasy/league/{LEAGUE}/team/roster",
                 "Cookie": cookie},
        method="POST"
    )
    with urllib.request.urlopen(request, timeout=18) as response:
        data = json.load(response)
    error = data.get("pageError") or {}
    if error.get("code"):
        raise ValueError("Fantrax " + str(error.get("code")) + ": " + str(error.get("text", ""))[:160])
    responses = data.get("responses") or []
    if not responses:
        raise ValueError("Fantrax returned no roster responses")
    return (responses[0].get("data") or {}).get("tables") or []


def parse_roster_stats(tables):
    """Only trust identifiable Fantrax player IDs and explicitly labeled columns."""
    import re
    result = {}
    for table in tables:
        columns = ((table.get("header") or {}).get("cells") or [])
        def label(col):
            return re.sub(r"<[^>]*>", "", str(
                col.get("name") or col.get("shortName") or col.get("label") or
                col.get("displayName") or col.get("key") or "")).strip().upper()
        labels = [label(c) for c in columns]
        for row in table.get("rows") or []:
            scorer = row.get("scorer") or {}
            player_id = scorer.get("scorerId")
            if not player_id:
                continue
            cells = row.get("cells") or []
            values = {}
            for i, cell in enumerate(cells):
                if i >= len(labels):
                    break
                key = labels[i]
                raw = cell.get("content") if isinstance(cell, dict) else None
                try:
                    value = float(str(raw).replace(",", "").strip())
                except (TypeError, ValueError):
                    continue
                if key in ("FPTS", "FP", "FANTASY POINTS", "FANTASY POINTS TOTAL"):
                    values["fpts"] = value
                elif key in ("FP/G", "FPTS/G", "FPTS PER GAME", "FANTASY POINTS PER GAME", "FPTSPERGAME"):
                    values["fpg"] = value
                elif key in ("GP", "PJ", "GAMES PLAYED"):
                    values["gp"] = int(value)
            # Eligibility comes from the actual scorer, not the roster slot.
            pos = re.findall(r"(?<![A-Z])(LW|RW|C|D|G)(?![A-Z])",
                             re.sub(r"<[^>]*>", " ", str(scorer.get("posShortNames") or "")).upper())
            if pos:
                values["eligiblePositions"] = list(dict.fromkeys(pos))
            if values:
                result[str(player_id)] = values
    return result


def playoff_percent(row):
    """Extract a Fantrax playoff probability if its API exposes one."""
    aliases = {"playoffprobability", "playoffpercentage", "playoffodds",
               "playoffchance", "playoffpercent", "playoffpct",
               "playoffspercentage", "playoffqualificationpercentage",
               "playoffqualificationpct", "pctplayoffs", "playoffprob"}
    for key, value in row.items():
        if key.lower().replace("_", "").replace("-", "") not in aliases:
            continue
        if value is None:
            continue
        try:
            number = float(str(value).strip().replace("%", ""))
        except ValueError:
            continue
        if 0 <= number <= 100:
            return number if number > 1 or "%" in str(value) else number * 100
    return None


def period_at(periods, now):
    for period in periods:
        start = dt.datetime.fromisoformat(period["startDate"])
        end = dt.datetime.fromisoformat(period["endDate"])
        if start <= now <= end:
            return period["number"]
    raise ValueError("No period covers the current date; previous snapshot retained")

def build_snapshot(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    info = fetch("getLeagueInfo")

    player_info = info.get("playerInfo", {})
    print("PLAYER INFO TYPE:", type(player_info).__name__)
    print("PLAYER INFO COUNT:", len(player_info) if isinstance(player_info, (dict, list)) else 0)
    if isinstance(player_info, dict):
        sample = next((v for v in player_info.values() if isinstance(v, dict)), {})
    elif isinstance(player_info, list):
        sample = next((v for v in player_info if isinstance(v, dict)), {})
    else:
        sample = {}
    print("PLAYER INFO FIELDS:", sorted(sample.keys()))

    roster_period = period_at(info["rosterPeriods"], now)
    scoring_period = period_at(info["scoringPeriods"], now)
    # Fantrax's period timestamps can switch at 19:00 Montreal time.
    # For the BHL Monday-Sunday roster view, use the new week's roster
    # as soon as Monday begins locally, if the next period starts that day.
    from zoneinfo import ZoneInfo
    local_today = now.astimezone(ZoneInfo("America/Toronto")).date()
    if local_today.weekday() == 0 and now.astimezone(ZoneInfo("America/Toronto")).hour >= 1:
        following = next((p for p in info["rosterPeriods"] if p["number"] == roster_period + 1), None)
        if following and dt.datetime.fromisoformat(following["startDate"]).astimezone(ZoneInfo("America/Toronto")).date() == local_today:
            roster_period = following["number"]
    rosters = fetch("getTeamRosters", period=roster_period)
    standings = fetch("getStandings")
    # On Mondays, Fantrax's API can still consider the previous scoring
    # period active until 19:00. Show the new week's scores immediately.
    from zoneinfo import ZoneInfo
    today_montreal = now.astimezone(ZoneInfo("America/Toronto")).date()
    if today_montreal.weekday() == 0 and now.astimezone(ZoneInfo("America/Toronto")).hour >= 1:
        following = next((p for p in info["scoringPeriods"] if p["number"] == scoring_period + 1), None)
        if following and dt.datetime.fromisoformat(following["startDate"]).astimezone(ZoneInfo("America/Toronto")).date() == today_montreal:
            scoring_period = following["number"]
    scores = fetch("getMatchupScores", period=scoring_period)
    # Public API capability audit: only field names/counts, never raw private data.
    # Optional requests must never interrupt the primary roster/schedule sync.
    def describe_shape(value):
        if isinstance(value, dict):
            return {"type": "object", "fields": sorted(value.keys())[:60],
                    "collectionSizes": {str(k): len(v) for k, v in value.items()
                                        if isinstance(v, (dict, list))}}
        if isinstance(value, list):
            example = next((x for x in value if isinstance(x, dict)), {})
            return {"type": "array", "count": len(value),
                    "itemFields": sorted(example.keys())[:60]}
        return {"type": type(value).__name__}
    for audit_method in ("getDraftPicks", "getDraftResults"):
        try:
            print("PUBLIC API AUDIT", audit_method,
                  json.dumps(describe_shape(fetch(audit_method)), ensure_ascii=False))
        except Exception as error:
            print("PUBLIC API AUDIT", audit_method, "unavailable:",
                  type(error).__name__)

    print("Fantrax getStandings fields:", sorted(standings[0].keys()) if standings else [])
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
    next_period = next((p for p in info["scoringPeriods"] if p["number"] == scoring_period + 1), None)
    upcoming = None
    if next_period:
        try:
            upcoming_scores = fetch("getMatchupScores", period=next_period["number"])
            if upcoming_scores.get("matchups"):
                upcoming = {"period": next_period["number"], "periodDates": next_period,
                            "matchups": upcoming_scores["matchups"]}
        except Exception as error:
            print("Upcoming period unavailable:", error)
    # Retain the three latest completed head-to-head results for each club.
    # A period can contain several games for the same club.
    previous_results = []
    for previous in sorted((p for p in info["scoringPeriods"] if p["number"] < scoring_period), key=lambda p: p["number"], reverse=True):
        if len(previous_results) >= 48:
            break
        try:
            old_scores = fetch("getMatchupScores", period=previous["number"])
            for m in reversed(old_scores.get("matchups", [])):
                away, home = m.get("away", {}), m.get("home", {})
                if away.get("score") is None or home.get("score") is None:
                    continue
                previous_results.append({"period": previous["number"],
                    "away": {k: away[k] for k in ("teamId", "teamName", "score") if k in away},
                    "home": {k: home[k] for k in ("teamId", "teamName", "score") if k in home}})
        except Exception as error:
            print("Previous results unavailable:", previous["number"], error)
    # Cap the size while keeping up to three results per team.
    results_by_team = {}
    selected_results = []
    for m in previous_results:
        ids = (m["away"].get("teamId"), m["home"].get("teamId"))
        if any(team_id and results_by_team.get(team_id, 0) < 3 for team_id in ids):
            selected_results.append(m)
            for team_id in ids:
                if team_id:
                    results_by_team[team_id] = results_by_team.get(team_id, 0) + 1
    previous_results = selected_results
    # Season-long schedule, including future fixtures when Fantrax exposes them.
    # Each period is independent; a failed future request must not block updates.
    season_schedule = []
    for period in info["scoringPeriods"]:
        number = period["number"]
        try:
            period_scores = scores if number == scoring_period else fetch("getMatchupScores", period=number)
            season_schedule.append({
                "period": number,
                "startDate": period["startDate"],
                "endDate": period["endDate"],
                "matchups": [{
                    "away": {k: m["away"][k] for k in ("teamId", "teamName", "score", "gamesPlayed") if k in m["away"]},
                    "home": {k: m["home"][k] for k in ("teamId", "teamName", "score", "gamesPlayed") if k in m["home"]}
                } for m in period_scores.get("matchups", [])]
            })
        except Exception as error:
            print("Schedule period unavailable:", number, error)
    player_info = fetch("getPlayerIds")
    if not isinstance(player_info, dict) or not player_info:
        raise ValueError("Missing player names")
    # League-wide player eligibility is available from the public API.
    # Keep the roster slot separate: a player may qualify at several positions.
    league_player_info = info.get("playerInfo") or {}
    def official_eligible(player_id):
        import re
        details = league_player_info.get(player_id, {}) if isinstance(league_player_info, dict) else {}
        raw = details.get("eligiblePos", []) if isinstance(details, dict) else []
        if isinstance(raw, str):
            found = re.findall(r"(?<![A-Z])(LW|RW|C|D|G)(?![A-Z])", raw.upper())
        elif isinstance(raw, (list, tuple)):
            found = []
            for entry in raw:
                if isinstance(entry, str):
                    found.extend(re.findall(r"(?<![A-Z])(LW|RW|C|D|G)(?![A-Z])", entry.upper()))
        else:
            found = []
        return list(dict.fromkeys(found))

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
            # Roster slot and eligible positions are distinct Fantrax concepts.
            # Publish only positions explicitly supplied by Fantrax; never infer them.
            raw_eligible = (item.get("eligiblePositions") or item.get("positions") or
                            player.get("eligiblePositions") or player.get("positions") or
                            player.get("position") or [])
            if isinstance(raw_eligible, str):
                import re
                eligible = re.findall(r"(?<![A-Z])(LW|RW|C|D|G)(?![A-Z])", raw_eligible.upper())
            elif isinstance(raw_eligible, list):
                eligible = [str(v).upper() for v in raw_eligible if isinstance(v, str) and str(v).upper() in ("C", "LW", "RW", "D", "G")]
            else:
                eligible = []
            official_positions = official_eligible(item["id"])
            if official_positions:
                eligible = official_positions
            slot = item.get("position", "")
            if not official_positions and slot in ("C", "LW", "RW", "D", "G") and slot not in eligible:
                eligible.insert(0, slot)
            players.append({"id": item["id"], "name": name, "position": slot,
                            "eligiblePositions": list(dict.fromkeys(eligible)),
                            "status": item.get("status", "")})
        teams.append({"id": team_id, "name": roster["teamName"], "players": players})
    # Experimental automatic stats from the same roster screen the DG sees.
    # Never publish raw Fantrax responses or private profile/owner information.
    live_stats = {}
    stats_diagnostics = {"teamsAttempted": 0, "teamsWithData": 0, "errors": {}}
    for team in teams:
        if not os.environ.get("FANTRAX_COOKIE", "").strip():
            stats_diagnostics["errors"]["FANTRAX_COOKIE secret not configured"] = 1
            break
        stats_diagnostics["teamsAttempted"] += 1
        try:
            extracted = parse_roster_stats(fetch_roster_stats(team["id"], roster_period))
            if extracted:
                stats_diagnostics["teamsWithData"] += 1
            live_stats.update(extracted)
            for player in team["players"]:
                values = extracted.get(player["id"], {})
                if values.get("eligiblePositions"):
                    player["eligiblePositions"] = values["eligiblePositions"]
            print(f"Roster stats {team['name']}: {len(extracted)} players parsed")
        except Exception as error:
            category = type(error).__name__ + ": " + str(error)[:160]
            stats_diagnostics["errors"][category] = stats_diagnostics["errors"].get(category, 0) + 1
            print(f"Roster stats unavailable for {team['name']}: {category}")
    live_stats = {pid: row for pid, row in live_stats.items()
                  if any(k in row for k in ("gp", "fpg", "fpts"))}
    # Whitelist published fields: never publish owner/contact/profile data.
    return {
        "leagueId": LEAGUE, "leagueName": info["leagueName"],
        "season": info.get("seasonYear"), "updatedAt": now.isoformat(),
        "rosterPeriod": roster_period, "scoringPeriod": scoring_period,
        "periodDates": next(p for p in info["scoringPeriods"] if p["number"] == scoring_period),
        "teams": teams,
        "playerStats": live_stats,
        "playerStatsSync": {"status": "ok" if live_stats else "unavailable",
                            "playerCount": len(live_stats), **stats_diagnostics},
        "upcoming": upcoming,
        "recentResults": previous_results,
        "schedule": season_schedule,
        "standings": [{
            **{k: row[k] for k in (
                "teamId", "teamName", "rank", "points", "totalPointsFor",
                "winPercentage", "gamesBack", "wins", "losses", "ties",
                "totalPointsAgainst", "fantasyPointsAgainst", "pointsAgainst",
                "playoffProbability", "playoffPercentage", "playoffOdds",
                "playoffChance", "playoffPercent", "totalPoints",
            ) if k in row and isinstance(row[k], (int, float, str, type(None)))},
            **({"totalPointsAgainst": round(against_by_team[row["teamId"]], 2)} if row.get("teamId") in against_by_team and not any(k in row for k in ("totalPointsAgainst", "fantasyPointsAgainst", "pointsAgainst")) else {}),
            **({"playoffPercentage": playoff_percent(row)} if playoff_percent(row) is not None else {}),
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
