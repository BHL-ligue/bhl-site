"""Daily NHL skater per-60 rates and league-wide percentiles (GP >= 1)."""
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

DEST=Path(__file__).resolve().parents[1]/"data/nhl-advanced-stats.json"
SEASON="20262027"
METRICS={"FPTS60":"FPTS/60","PTS60":"PTS/60","G60":"B/60","A60":"A/60",
         "SOG60":"TIRS/60","HIT60":"HITS/60","BLK60":"BLOCS/60","TK60":"TK/60"}
def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"BHL-NHL-Advanced/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=40) as response:return json.load(response)
def report(kind):
    out=[];start=0
    while True:
        params=urllib.parse.urlencode({"cayenneExp":f"seasonId={SEASON} and gameTypeId=2",
            "isAggregate":"true","isGame":"false","start":start,"limit":100})
        data=get(f"https://api.nhle.com/stats/rest/en/skater/{kind}?{params}")
        batch=data.get("data",[])
        if not batch:break
        out.extend(batch);start+=len(batch)
        if start>=int(data.get("total",start)):break
        if start>3000:raise RuntimeError(f"Excessive pagination in {kind}")
    return out
def number(row,*keys):
    for key in keys:
        value=row.get(key)
        if value is not None:
            try:return float(value)
            except (ValueError,TypeError):pass
    return None
def by_id(rows):
    result={}
    for row in rows:
        pid=row.get("playerId")
        if pid is None:continue
        key=str(pid)
        # Aggregate endpoints can include multiple team lines; prefer
        # a season-total row if available rather than summing duplicates.
        if key not in result or (number(row,"gamesPlayed") or 0)>(number(result[key],"gamesPlayed") or 0):
            result[key]=row
    return result
def main():
    summary=by_id(report("summary"))
    realtime=by_id(report("realtime"))
    faceoffs=by_id(report("faceoffwins"))
    toi=by_id(report("timeonice"))
    players={}
    missing_faceoff=0
    for pid,s in summary.items():
        gp=number(s,"gamesPlayed")
        t=toi.get(pid,{})
        seconds=number(t,"timeOnIce","totalTimeOnIce")
        if not gp or gp<1 or seconds is None or seconds<=0:continue
        r=realtime.get(pid,{})
        f=faceoffs.get(pid,{})
        goals=number(s,"goals");assists=number(s,"assists")
        shots=number(s,"shots","shotsOnGoal")
        hits=number(r,"hits");blocks=number(r,"blockedShotAttempts","blockedShots")
        takes=number(r,"takeaways")
        wins=number(f,"faceoffWins","faceoffsWon","faceoffsWonTotal")
        if wins is None:
            wins=number(s,"faceoffWins","faceoffsWon","faceoffsWonTotal")
        has_faceoff_data=wins is not None
        if wins is None:
            missing_faceoff+=1
            wins=0
        values={"PTS60":goals+assists if goals is not None and assists is not None else None,
                "G60":goals,"A60":assists,"SOG60":shots,"HIT60":hits,"BLK60":blocks,"TK60":takes}
        components=[(goals,3),(assists,2.5),(shots,.3),(hits,.1),(blocks,.2),(takes,.1),(wins,.05)]
        values["FPTS60"]=sum(x*w for x,w in components) if all(x is not None for x,w in components) else None
        rates={key:round(v*3600/seconds,3) if v is not None else None for key,v in values.items()}
        players[pid]={"gp":int(gp),"toiSeconds":seconds,"rates":rates,
                      "faceoffWinsAvailable":has_faceoff_data}
    if len(players)<200:raise RuntimeError(f"Only {len(players)} skaters with time on ice; preserving existing data")
    if not any(p["rates"]["FPTS60"] is not None for p in players.values()):
        raise RuntimeError("No FPTS/60 values; preserving existing data")
    for key in METRICS:
        population=sorted(p["rates"][key] for p in players.values() if p["rates"][key] is not None)
        if not population:continue
        import bisect
        for p in players.values():
            value=p["rates"][key]
            p.setdefault("percentiles",{})[key]=round(100*(bisect.bisect_left(population,value)+bisect.bisect_right(population,value))/(2*len(population)),1) if value is not None else None
    output={"season":SEASON,"updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
            "population":len(players),"minimumGames":1,"metrics":METRICS,"players":players,
            "missingFaceoffWinsCount":missing_faceoff,"fpts60Provisional":missing_faceoff>0,
            "source":"NHL official skater summary, realtime, faceoffwins and timeonice reports"}
    DEST.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(f"Published {len(players)} skaters, {sum(p['rates']['FPTS60'] is not None for p in players.values())} complete fantasy rates")
if __name__=="__main__":main()
