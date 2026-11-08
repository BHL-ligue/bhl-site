"""Publish a fast, validated GitHub snapshot of the public BHL Google Sheets data."""
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://script.google.com/macros/s/AKfycbyhz6nFb1gR_JiNF6VLl_8q-nUjo7OkbB9hNqSzZVdc4n_hZhUKQ3aTu3YqGTJCrjARiQ/exec"
DEST = ROOT / "data/teams-snapshot.json"

def load(sheet):
    callback = "bhlSnapshot"
    url = API + "?" + urllib.parse.urlencode({"sheet": sheet, "callback": callback})
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 BHL snapshot sync"})
    with urllib.request.urlopen(req, timeout=45) as response:
        body = response.read().decode("utf-8-sig").strip()
    match = re.fullmatch(r"\s*" + callback + r"\s*\(\s*(.*)\s*\)\s*;?\s*", body, re.S)
    if not match:
        raise ValueError(f"Unexpected Google Sheets JSONP format for {sheet}")
    data = json.loads(match.group(1))
    if not isinstance(data, dict) or data.get("ok") is not True:
        raise ValueError(f"Google Sheets returned an error for {sheet}")
    return data

def main():
    teams = load("TEAMS")
    forbes = load("FORBES")
    roster = teams.get("teams")
    if not isinstance(roster, dict) or len([x for x in roster.values() if isinstance(x, dict) and not x.get("error")]) < 16:
        raise ValueError("Incomplete TEAMS response; retaining last good snapshot")
    if not isinstance(forbes.get("data", {}).get("rows"), list):
        raise ValueError("Missing FORBES rows")
    payload = {"updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "TEAMS": teams, "FORBES": forbes}
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Published validated BHL team snapshot")

if __name__ == "__main__":
    main()
