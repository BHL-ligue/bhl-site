"""NHL advanced stats: current season and rolling three-season totals/per-60 percentiles."""
import bisect
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

DEST=Path(__file__).resolve().parents[1]/"data/nhl-advanced-stats.json"
SEASONS=["20242025","20252026","20262027"]
METRICS={"FPTS":"FPTS","PTS":"PTS","G":"B","A":"A","SOG":"TIRS","HIT":"HITS","BLK":"BLOCS","TK":"TK"}
WEIGHTS={"G":3,"A":2.5,"SOG":.3,"HIT":.1,"BLK":.2,"TK":.1,"FOW":.05}

def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"BHL-NHL-Advanced/2.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=45) as response:
        return json.load(response)

def report(kind,season):
    out=[];start=0
    while True:
        params=urllib.parse.urlencode({"cayenneExp":f"seasonId={season} and gameTypeId=2",
            "isAggregate":"true","isGame":"false","start":start,"limit":100})
        data=get(f"https://api.nhle.com/stats/rest/en/skater/{kind}?{params}")
        batch=data.get("data",[])
        if not batch:break
        out.extend(batch);start+=len(batch)
        if start>=int(data.get("total",start)):break
        if start>3000:raise RuntimeError(f"Excessive pagination: {kind} {season}")
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
        if key not in result or (number(row,"gamesPlayed") or 0)>(number(result[key],"gamesPlayed") or 0):
            result[key]=row
    return result

def realtime_fallback(season,pid):
    """Try the same official report with an explicit player filter.

    The league-wide aggregate report sometimes omits rows that the
    player-profile endpoint can return individually.
    """
    params=urllib.parse.urlencode({"cayenneExp":f"seasonId={season} and gameTypeId=2 and playerId={pid}",
        "isAggregate":"true","isGame":"false","start":0,"limit":100})
    try:
        data=get(f"https://api.nhle.com/stats/rest/en/skater/realtime?{params}")
        rows=data.get("data",[])
        return by_id(rows).get(str(pid),{})
    except (OSError,ValueError,KeyError) as exc:
        print(f"Realtime fallback unavailable for {season} / {pid}: {exc}")
        return {}

def one_season(season):
    summary=by_id(report("summary",season))
    realtime=by_id(report("realtime",season))
    faceoffs=by_id(report("faceoffwins",season))
    toi=by_id(report("timeonice",season))
    players={}
    missing_realtime=[]
    for pid,s in summary.items():
        gp=number(s,"gamesPlayed") or 0
        seconds=number(toi.get(pid,{}),"timeOnIce","totalTimeOnIce")
        if gp<1 or seconds is None or seconds<=0:continue
        r=realtime.get(pid,{})
        f=faceoffs.get(pid,{})
        if any(number(r,*fields) is None for fields in
               (("hits",),("blockedShotAttempts","blockedShots"),("takeaways",))):
            missing_realtime.append(pid)
            alternate=realtime_fallback(season,pid)
            if alternate:r=alternate
        values={"G":number(s,"goals"),"A":number(s,"assists"),
                "SOG":number(s,"shots","shotsOnGoal"),"HIT":number(r,"hits"),
                "BLK":number(r,"blockedShotAttempts","blockedShots"),
                "TK":number(r,"takeaways")}
        wins=number(f,"faceoffWins","faceoffsWon","faceoffsWonTotal","totalFaceoffWins","totalFaceoffsWon")
        if wins is None:
            wins=number(s,"faceoffWins","faceoffsWon","faceoffsWonTotal","totalFaceoffsWon")
        faceoffs_available=wins is not None
        # NHL report omits some players' faceoff totals. Missing values
        # are provisionally zero, but flagged in output and the UI.
        values["FOW"]=wins if faceoffs_available else 0
        if values["G"] is not None and values["A"] is not None:
            values["PTS"]=values["G"]+values["A"]
        else:values["PTS"]=None
        values["FPTS"]=(sum(values[k]*weight for k,weight in WEIGHTS.items())
                        if all(values[k] is not None for k in WEIGHTS) else None)
        players[pid]={"gp":int(gp),"toiSeconds":seconds,"totals":values,
                      "faceoffWinsAvailable":faceoffs_available}
    unresolved=sum(any(p["totals"][key] is None for key in ("HIT","BLK","TK")) for p in players.values())
    print(f"{season}: {len(players)} eligible skaters, {len(missing_realtime)} realtime retries, {unresolved} unresolved")
    return players

def combine(season_data):
    merged={}
    for season_players in season_data:
        for pid,p in season_players.items():
            entry=merged.setdefault(pid,{"gp":0,"toiSeconds":0,"totals":{},
                "faceoffWinsAvailable":True})
            entry["gp"]+=p["gp"]
            entry["toiSeconds"]+=p["toiSeconds"]
            entry["faceoffWinsAvailable"] &= p["faceoffWinsAvailable"]
            for key,value in p["totals"].items():
                if key not in entry["totals"]:entry["totals"][key]=0
                if value is None:entry["totals"][key]=None
                elif entry["totals"][key] is not None:entry["totals"][key]+=value
    return merged

def publish_dataset(players):
    if len(players)<200:raise RuntimeError(f"Only {len(players)} eligible skaters")
    for p in players.values():
        p["rates"]={key:round(value*3600/p["toiSeconds"],3) if value is not None else None
                    for key,value in p["totals"].items()}
        # Rates and totals have their own percentile populations.
        p["percentiles"]={"total":{},"per60":{}}
    for mode,field in (("total","totals"),("per60","rates")):
        for key in METRICS:
            population=sorted(p[field][key] for p in players.values() if p[field].get(key) is not None)
            if not population:continue
            for p in players.values():
                value=p[field].get(key)
                p["percentiles"][mode][key]=(round(100*(bisect.bisect_left(population,value)+
                    bisect.bisect_right(population,value))/(2*len(population)),1)
                    if value is not None else None)
    missing=sum(not p["faceoffWinsAvailable"] for p in players.values())
    complete=sum(p["totals"]["FPTS"] is not None for p in players.values())
    if not complete:raise RuntimeError("No valid FPTS values; preserving last published file")
    return {"population":len(players),"missingFaceoffWinsCount":missing,
            "fptsProvisional":missing>0,"players":players}

def main():
    seasons={season:one_season(season) for season in SEASONS}
    current=publish_dataset(combine([seasons[SEASONS[-1]]]))
    last3=publish_dataset(combine([seasons[s] for s in SEASONS]))
    output={"season":SEASONS[-1],"seasons":SEASONS,
            "updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
            "minimumGames":1,"metrics":METRICS,
            "datasets":{"current":current,"last3":last3},
            "source":"NHL official skater summary, realtime, faceoffwins and timeonice reports"}
    # Atomic write so an interrupted run does not corrupt the snapshot.
    tmp=DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    tmp.replace(DEST)
    print(f"Published current={current['population']} and last3={last3['population']} skaters")
if __name__=="__main__":main()
