"""Generate BHL weekly stars using official NHL regular-season reports.
No fabricated stats: a period is published only when every required NHL report succeeds.
"""
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
WEIGHTS={"goals":3,"assists":2.5,"shots":.3,"hits":.1,"blockedShotAttempts":.2,"takeaways":.1,"faceoffWins":.05}
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"BHL-weekly-stars/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=35) as response:return json.load(response)
def report(kind,report_name,season,start,end):
    expression=f'gameDate>="{start}" and gameDate<="{end} 23:59:59" and gameTypeId=2'
    base=f"https://api.nhle.com/stats/rest/en/{kind}/{report_name}"
    rows=[];offset=0
    while True:
        query=urllib.parse.urlencode({"cayenneExp":expression,"isAggregate":"true","isGame":"true","start":offset,"limit":500})
        result=fetch(base+"?"+query)
        batch=result.get("data",[])
        rows.extend(batch)
        if not batch or len(rows)>=int(result.get("total",len(rows))):break
        offset+=len(batch)
        if offset>3000:raise RuntimeError("NHL report pagination exceeded")
    return {str(row["playerId"]):row for row in rows if row.get("playerId")}
def number(row,*names):
    for name in names:
        value=row.get(name)
        if value is not None:
            try:return float(value)
            except (ValueError,TypeError):pass
    return None
def score(skater,rt,fo):
    keys=[number(skater,"goals"),number(skater,"assists"),number(skater,"shots","shotsOnGoal"),
          number(rt,"hits"),number(rt,"blockedShotAttempts","blockedShots"),
          number(rt,"takeaways"),number(fo,"faceoffWins","faceoffsWon")]
    if any(v is None for v in keys):return None
    return round(sum(v*w for v,w in zip(keys,[3,2.5,.3,.1,.2,.1,.05])),2)
def goalie_score(row):
    values=[number(row,"wins"),number(row,"goalsAgainst"),number(row,"saves"),number(row,"shutouts")]
    if any(v is None for v in values):return None
    return round(sum(v*w for v,w in zip(values,[4,-1,.2,4])),2)
def date_only(s):return dt.datetime.fromisoformat(s).date()
def main():
    fantrax=json.loads((DATA/"fantrax.json").read_text())
    identities=json.loads((DATA/"player-identity-map.json").read_text()).get("players",{})
    period_list=fantrax.get("schedule",[])
    if not period_list:raise RuntimeError("No Fantrax scoring schedule")
    season=f"{fantrax['season']}{fantrax['season']+1}"
    owners={}
    for team in fantrax["teams"]:
        for p in team["players"]:
            ident=identities.get(str(p["id"]).replace("*",""),{})
            nhl=ident.get("nhlId")
            if ident.get("status")=="confirmed" and nhl:
                owners[str(nhl)]={"id":str(p["id"]).replace("*",""),"name":p["name"],
                    "team":team["name"],"position":p.get("position",""),
                    "eligible":p.get("eligiblePositions") or [p.get("position","")]}
    output=[]
    # NHL reports have calendar-date boundaries, while Fantrax periods use
    # a local timezone offset. Convert to the NHL's Eastern date.
    for period in period_list:
        start=date_only(period["startDate"])
        end=date_only(period["endDate"])
        # Keep the opening date: Fantrax periods begin before NHL evening games.
        first=start.isoformat()
        last=end.isoformat()
        if first>dt.datetime.now(dt.timezone.utc).date().isoformat():continue
        try:
            sk=report("skater","summary",season,first,last)
            rt=report("skater","realtime",season,first,last)
            fo=report("skater","faceoffwins",season,first,last)
            go=report("goalie","summary",season,first,last)
        except (OSError,ValueError,KeyError) as exc:
            print(f"Period {period['period']}: skipped due to NHL data error: {exc}")
            continue
        candidates=[]
        for nhl,owner in owners.items():
            is_goalie=owner["position"]=="G"
            main_row=(go if is_goalie else sk).get(nhl)
            if not main_row:continue
            gp=number(main_row,"gamesPlayed")
            if not gp or gp<1:continue
            pts=goalie_score(main_row) if is_goalie else score(main_row,rt.get(nhl,{}),fo.get(nhl,{}))
            if pts is None:continue
            candidates.append({**owner,"nhlId":int(nhl),"gp":int(gp),"fpts":pts,"fpg":round(pts/gp,2)})
        # Rank per position with normalized FPTS + FP/G (60/40).
        # A minimum of two games applies to skaters; one for goalies.
        def eligible(pos):
            return [p for p in candidates if pos in p["eligible"] and p["gp"]>=(1 if pos=="G" else 2)]
        pools={pos:eligible(pos) for pos in ("LW","C","RW","D","G")}
        ranked={}
        for pos,pool in pools.items():
            max_pts=max((p["fpts"] for p in pool),default=0)
            max_rate=max((p["fpg"] for p in pool),default=0)
            ranked[pos]=sorted(pool,key=lambda p:(.6*p["fpts"]/max_pts if max_pts>0 else 0)+(.4*p["fpg"]/max_rate if max_rate>0 else 0),reverse=True)
        chosen=[];used=set()
        for pos in ("LW","C","RW","D","D","G"):
            p=next((p for p in ranked[pos] if p["nhlId"] not in used),None)
            if p:
                used.add(p["nhlId"]);chosen.append({**p,"slot":pos})
        output.append({"period":period["period"],"start":first,"end":last,"players":chosen,
                       "candidates":len(candidates),"complete":last<dt.datetime.now(dt.timezone.utc).date().isoformat()})
    if not output:raise RuntimeError("No weekly periods with complete official NHL reports")
    dest=DATA/"bhl-weekly-stars.json"
    dest.write_text(json.dumps({"updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
        "source":"NHL official statistics; current BHL roster ownership",
        "scoring":"60% normalized weekly FPTS + 40% normalized weekly FP/G",
        "periods":output},ensure_ascii=False,separators=(",",":"))+"\n")
    print(f"Published {len(output)} weekly periods")
if __name__=="__main__":main()
