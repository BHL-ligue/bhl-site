#!/usr/bin/env python3
"""Generate the public unlisted PWHL preview dataset from research game reports.
Run against the research branch checkout; only aggregated stats are published.
"""
import json,sys
from pathlib import Path
from collections import defaultdict
from decimal import Decimal
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(".")
out=Path(sys.argv[2]) if len(sys.argv)>2 else Path("data/pwhl-fantasy-preview.json")
seasons={"2024":72,"2024-25":90,"2025-26":120}
fields={"skaters":["goals","assists","shots_on","hits","shots_blocked_by_player","faceoff_wins"],"goalies":["win","shutout","saves","goals_against","goals","assists"]}
by_player=defaultdict(lambda:defaultdict(lambda:{"g":0,"f":Decimal(0),"stats":defaultdict(int)}))
seen=set()
coverage={}
for season,expected in seasons.items():
    folder=root/"research/pwhl/batch"/season
    files=sorted(folder.glob("*.json"))
    if len(files)!=expected:raise SystemExit(f"{season}: expected {expected} game files; found {len(files)}")
    coverage[season]={"status":"complete","imported_games":len(files),"expected_games":expected}
    for path in files:
        data=json.loads(path.read_text(encoding="utf-8"))
        game=str(data["game_id"])
        if (season,game) in seen:raise SystemExit("duplicate game "+game)
        seen.add((season,game))
        for role in ("skaters","goalies"):
            for p in data[role]:
                if p["fpts"] is None:raise SystemExit(f"incomplete {path} {p['name']}")
                key=(role,str(p["id"]),p["name"])
                item=by_player[key][season]
                item["g"]+=1
                item["f"]+=Decimal(str(p["fpts"]))
                for stat in fields[role]:
                    value=p["stats"].get(stat)
                    if value is None:raise SystemExit(f"missing {stat} in {path}")
                    item["stats"][stat]+=int(value)
standings=[]
for (role,pid,name),seas in by_player.items():
    total={"g":0,"f":Decimal(0),"stats":defaultdict(int)}
    entries=[]
    for season,entry in sorted(seas.items()):
        g=entry["g"];f=entry["f"]
        entries.append({"y":season,"g":g,"f":float(f),"a":float((f/g).quantize(Decimal(".01"))),"st":dict(entry["stats"])})
        total["g"]+=g;total["f"]+=f
        for k,v in entry["stats"].items():total["stats"][k]+=v
    g=total["g"];f=total["f"]
    standings.append({"id":pid,"n":name,"t":role,"g":g,"f":float(f),"a":float((f/g).quantize(Decimal(".01"))),"st":dict(total["stats"]),"s":entries})
standings.sort(key=lambda p:(p["t"],-p["f"],p["n"]))
payload={"scope":"Unlisted BHL PWHL research preview; not independently reconciled with official totals.","coverage":coverage,"standings":standings}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print(f"Wrote {len(standings)} players, {len(seen)} games to {out}")
