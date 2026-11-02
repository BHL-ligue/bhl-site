"""Resolve unambiguous Fantrax player IDs against NHL's public player search.
Never overwrite a confirmed identity and never guess on ambiguous results.
"""
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data/player-identity-map.json"

def normalized(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(c for c in text.lower() if c.isalnum() and not unicodedata.combining(c))

def search(name):
    url = "https://search.d3.nhle.com/api/v1/search/player?" + urllib.parse.urlencode({
        "culture": "en-us", "limit": "25", "q": name
    })
    req = urllib.request.Request(url, headers={"User-Agent": "BHL-NHL-Identity/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=12) as response:
        data = json.load(response)
    return data if isinstance(data, list) else data.get("data", []) if isinstance(data, dict) else []

def main():
    directory = json.loads(PATH.read_text(encoding="utf-8"))
    resolved = 0
    errors = 0
    for fid, entry in directory["players"].items():
        if entry.get("status") == "confirmed" and entry.get("nhlId"):
            continue
        name = entry.get("fantraxName")
        if not name:
            continue
        try:
            results = search(name)
            matches = []
            for row in results:
                label = row.get("name") or row.get("fullName") or row.get("playerName") or ""
                if isinstance(label, dict):
                    label = label.get("default", "")
                nhl_id = row.get("playerId") or row.get("id")
                if normalized(label) == normalized(name) and str(nhl_id).isdigit():
                    matches.append((int(nhl_id), label))
            matches = list({x[0]: x for x in matches}.values())
            if len(matches) != 1:
                continue
            nhl_id, label = matches[0]
            # A single exact-name match is only a candidate. Validate the NHL landing
            # identity and, where known, the current NHL team to avoid homonyms.
            url = f"https://api-web.nhle.com/v1/player/{nhl_id}/landing"
            req = urllib.request.Request(url, headers={"User-Agent": "BHL-NHL-Identity/1.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                profile = json.load(response)
            full = " ".join(filter(None, [profile.get("firstName", {}).get("default"), profile.get("lastName", {}).get("default")]))
            if normalized(full) != normalized(name):
                continue
            expected = str(entry.get("nhlTeam") or "").upper()
            actual = str(profile.get("currentTeamAbbrev") or "").upper()
            if expected and actual and expected != actual:
                continue
            entry.update(nhlId=nhl_id, nhlName=full, status="confirmed")
            resolved += 1
        except (ValueError, OSError, KeyError, TypeError):
            errors += 1
    if resolved:
        temporary = PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(directory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, PATH)
    print(f"Confirmed {resolved} NHL identities; {errors} lookup errors")

if __name__ == "__main__":
    main()
