#!/usr/bin/env python3
"""Unpublished PWHL season game index. Fetches schedule only, no scoring yet."""
import json,urllib.parse,urllib.request,pathlib,datetime,re
SEASONS={"2024":1,"2024-25":5,"2025-26":8,"2026-27":11}
def main():
    report={"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"seasons":{}}
    for label,season in SEASONS.items():
        params=dict(callback="angular.callbacks._0",feed="statviewfeed",view="schedule",season=season,team=-1,month=-1,location="homeaway",league_id=1,conference_id=-1,division_id=-1,key="446521baf8c38984",client_code="pwhl",site_id=0,lang="en")
        url="https://lscluster.hockeytech.com/feed/index.php?"+urllib.parse.urlencode(params)
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"BHL-PWHL-Research/0.3"}),timeout=30) as response: raw=response.read().decode("utf-8-sig")
            match=re.match(r"^\s*[\w.$]+\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$",raw)
            data=json.loads(match.group(1) if match else raw)
            rows=[item.get("row",{}) for section in data for block in section.get("sections",[]) for item in block.get("data",[])]
            ids=sorted({str(row.get("game_id")) for row in rows if row.get("game_id")})
            report["seasons"][label]={"season_id":season,"count":len(ids),"game_ids":ids}
        except Exception as exc:report["seasons"][label]={"season_id":season,"error":str(exc)[:250]}
    output=pathlib.Path("research/pwhl/season-game-index.json")
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    print({k:{"count":v.get("count"),"error":v.get("error")} for k,v in report["seasons"].items()})
if __name__=="__main__":main()
