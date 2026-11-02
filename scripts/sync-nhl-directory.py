"""Build a public NHL player directory from the 32 official current team rosters.
This complements the BHL Fantrax identity map; it never changes confirmed mappings.
"""
import datetime as dt
import json
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"data/nhl-player-directory.json"
TEAMS="ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH".split()

def get(url):
    request=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"BHL-Official-NHL-Directory/1.0"})
    with urllib.request.urlopen(request,timeout=18) as response:
        return json.load(response)

def name(value):
    return value.get("default","") if isinstance(value,dict) else str(value or "")

def main():
    players={}
    succeeded=[]
    for team in TEAMS:
        try:
            roster=get(f"https://api-web.nhle.com/v1/roster/{team}/current")
            for group in ("forwards","defensemen","goalies"):
                for p in roster.get(group,[]):
                    pid=p.get("id")
                    if not isinstance(pid,int) or pid<=0: continue
                    first=name(p.get("firstName"))
                    last=name(p.get("lastName"))
                    players[str(pid)]={"name":f"{first} {last}".strip(),"team":team,"position":p.get("positionCode","")}
            succeeded.append(team)
        except (OSError,ValueError,KeyError) as error:
            print(f"{team}: {error}")
    # Never publish a partial directory if a team endpoint fails.
    if len(succeeded)!=len(TEAMS):
        raise RuntimeError(f"Only {len(succeeded)}/{len(TEAMS)} NHL team rosters fetched; previous directory preserved")
    if len(players)<400:
        raise RuntimeError(f"Only {len(players)} players; previous directory preserved")
    output={"source":"NHL official team rosters","updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"teamCount":len(succeeded),"playerCount":len(players),"players":players}
    DEST.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(f"Published {len(players)} official NHL players from {len(succeeded)} teams")

if __name__=="__main__":
    main()
