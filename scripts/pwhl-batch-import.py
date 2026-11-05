#!/usr/bin/env python3
"""Small, rate-limited research import of completed PWHL games.

Uses the indexed season game IDs, validates the game summary's season and
completion status, and produces one per-game report plus a manifest.
Not intended for live production or publishing.
"""
import argparse,json,pathlib,subprocess,sys,time,urllib.parse,urllib.request
ROOT=pathlib.Path("research/pwhl")
URL="https://lscluster.hockeytech.com/feed/index.php"
def fetch(game_id):
    q=urllib.parse.urlencode(dict(feed="gc",tab="gamesummary",game_id=game_id,key="446521baf8c38984",client_code="pwhl",site_id=0,lang="en"))
    with urllib.request.urlopen(urllib.request.Request(URL+"?"+q,headers={"User-Agent":"BHL-PWHL-Research/0.4"}),timeout=30) as resp:
        return json.load(resp)["GC"]["Gamesummary"]
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--season",default="2025-26")
    parser.add_argument("--limit",type=int,default=5)
    parser.add_argument("--offset",type=int,default=0,help="Start index in the season schedule; use batches of at most 20")
    parser.add_argument("--delay",type=float,default=1.0)
    args=parser.parse_args()
    if not 1<=args.limit<=20:raise ValueError("limit must be 1..20")
    if args.offset<0:raise ValueError("offset must be nonnegative")
    index=json.loads((ROOT/"season-game-index.json").read_text())
    season=index["seasons"][args.season]
    ids=season.get("game_ids",[])
    if not ids:raise ValueError("No game IDs available")
    manifest={"season":args.season,"season_id":season["season_id"],"requested":args.limit,"offset":args.offset,"scored":[],"skipped":[]}
    output=ROOT/"batch"/args.season
    output.mkdir(parents=True,exist_ok=True)
    for game_id in ids[args.offset:args.offset+args.limit]:
        try:
            out=output/(str(game_id)+".json")
            if out.exists():
                report=json.loads(out.read_text())
                if str(report.get("game_id"))!=str(game_id) or str(report.get("season_id"))!=str(season["season_id"]):
                    raise ValueError("cached game report has mismatched identity")
                manifest["scored"].append({"game":game_id,"date":report.get("date"),"skaters":report["summary"]["skaters"],"goalies":report["summary"]["goalies"],"cached":True})
                continue
            gs=fetch(game_id)
            meta=gs.get("meta",{})
            if str(meta.get("season_id"))!=str(season["season_id"]):
                manifest["skipped"].append({"game":game_id,"reason":"season_mismatch"});continue
            if not gs.get("goals") and not gs.get("goalies",{}).get("home") and not gs.get("goalies",{}).get("visitor"):
                manifest["skipped"].append({"game":game_id,"reason":"no_game_stats"});continue
            subprocess.run([sys.executable,"scripts/pwhl-game-fpts.py","--game-id",str(game_id),"--output",str(out)],check=True,stdout=subprocess.DEVNULL,timeout=40)
            report=json.loads(out.read_text())
            if str(report.get("game_id"))!=str(game_id) or str(report.get("season_id"))!=str(season["season_id"]):
                raise ValueError("cached game report has mismatched identity")
            if report["summary"]["skaters"]["scored"]==0:
                out.unlink(missing_ok=True)
                manifest["skipped"].append({"game":game_id,"reason":"no_scored_skaters"});continue
            manifest["scored"].append({"game":game_id,"date":report.get("date"),"skaters":report["summary"]["skaters"],"goalies":report["summary"]["goalies"]})
        except Exception as exc:
            manifest["skipped"].append({"game":game_id,"reason":str(exc)[:180]})
        time.sleep(args.delay)
        if len(manifest["skipped"])>60:break
    (ROOT/f"batch-manifest-{args.season}-{args.offset:03d}.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"scored":len(manifest["scored"]),"skipped":len(manifest["skipped"])},ensure_ascii=False))
if __name__=="__main__":main()
