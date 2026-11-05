#!/usr/bin/env python3
"""Cache real NHL player portraits for every Hall candidate on GitHub Pages.

Runs in GitHub Actions, stores verified player-specific headshots locally,
and writes a coverage report instead of substituting BHL logos.
"""
import concurrent.futures
import io
import json
import os
import pathlib
import time
import urllib.error
import urllib.request
from PIL import Image, ImageStat

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"images"/"hall"
OUT.mkdir(parents=True,exist_ok=True)
UA={"User-Agent":"Mozilla/5.0 (compatible; BHL-Hall-Portraits/1.0)","Accept":"application/json,image/png,image/jpeg,*/*"}
def get(url,timeout=18):
    req=urllib.request.Request(url,headers=UA)
    with urllib.request.urlopen(req,timeout=timeout) as response:
        return response.read()
def load(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))
def targets():
    scores=load("data/production/scorers.json")
    identity=load("data/player-identity-map.json").get("players",{})
    history=load("data/historical-player-identities.json").get("players",{})
    last={}
    for row in scores.get("rows",[]):
        if not row.get("id") or not row.get("name") or not float(row.get("starts") or 0):continue
        year=int(str(row.get("season") or "0")[:4] or 0)
        key=str(row["id"])
        if year>last.get(key,0):last[key]=year
    for key,year in last.items():
        if not 0<year<=2022:continue
        record=identity.get(key) or history.get(key) or {}
        nhl_id=int(record.get("nhlId") or 0)
        if nhl_id:yield key,nhl_id,record.get("fantraxName") or record.get("nhlName") or key
def good_image(data):
    if len(data)<2500:return None
    try:
        image=Image.open(io.BytesIO(data)).convert("RGBA")
        if image.width<90 or image.height<90:return None
        sample=image.resize((32,32)).convert("RGB")
        if sum(ImageStat.Stat(sample).stddev)<10:return None
        return image
    except Exception:return None
def task(row):
    fantrax_id,nhl_id,name=row
    dest=OUT/(str(nhl_id)+".png")
    if dest.exists() and good_image(dest.read_bytes()):return fantrax_id,nhl_id,name,"cached"
    try:
        data=json.loads(get(f"https://api-web.nhle.com/v1/player/{nhl_id}/landing"))
    except Exception as e:return fantrax_id,nhl_id,name,"landing: "+str(e)[:80]
    urls=[]
    if data.get("headshot"):urls.append(data["headshot"])
    for entry in reversed(data.get("seasonTotals",[])):
        if str(entry.get("leagueAbbrev","")).upper()!="NHL":continue
        season=str(entry.get("season") or "")
        club=str(entry.get("teamAbbrev") or "").upper()
        if len(season)==8 and 2<=len(club)<=3:
            urls.append(f"https://assets.nhle.com/mugs/nhl/{season}/{club}/{nhl_id}.png")
    for url in dict.fromkeys(urls):
        try:
            image=good_image(get(url))
            if image is None:continue
            # Keep transparent cutout if supplied; avoid converting to JPG.
            image.save(dest,"PNG",optimize=True)
            return fantrax_id,nhl_id,name,"saved"
        except Exception:continue
    return fantrax_id,nhl_id,name,"not found"
def main():
    rows=list(targets())
    print(f"Portraits to check: {len(rows)}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(task,rows))
    report={"total":len(rows),"cached_or_saved":sum(x[3] in ("cached","saved") for x in results),"missing":[{"fantraxId":a,"nhlId":b,"name":c,"reason":d} for a,b,c,d in results if d not in ("cached","saved")]}
    (OUT/"coverage.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"total":report["total"],"available":report["cached_or_saved"],"missing":len(report["missing"])},ensure_ascii=False))
    for item in report["missing"][:30]:print("MISSING",item)
if __name__=="__main__":main()
