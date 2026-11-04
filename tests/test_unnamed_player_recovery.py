"""Recovery must preserve scoring and reject another Fantrax player's name."""
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
SCRIPT=Path(__file__).resolve().parents[1]/"scripts/recover-unnamed-fantrax-players.py"
if not SCRIPT.exists():SCRIPT=Path(__file__).with_name("recover.py")
spec=importlib.util.spec_from_file_location("recovery",SCRIPT)
recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)
class RecoveryTests(unittest.TestCase):
 def test_public_names_require_exact_id(self):
  def response(req,**kwargs):
   pid=req.full_url.rsplit("/",1)[-1]
   return io.StringIO(json.dumps({"id":"*correct*" if pid=="correct" else "*another*","name":"Verified Player"}))
  with patch.object(recovery.urllib.request,"urlopen",side_effect=response):
   result=recovery.public_archived_names({"correct","wrong"})
  self.assertEqual(set(result),{"correct"})
 def test_names_only_change_scoring_rows(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/"data/ownership").mkdir(parents=True);(root/"data/production").mkdir()
   players={"players":{"known":{"name":"Existing"},"missing":{"name":None},"unknown":{"name":None}},"unresolvedIds":["missing","unknown"]}
   scorers={"rows":[{"id":"missing","name":None,"fpts":12.5,"gp":3,"starts":2,"missingStarts":1},{"id":"known","name":"Existing","fpts":7}]}
   (root/"data/ownership/players.json").write_text(json.dumps(players))
   path=root/"data/production/scorers.json";path.write_text(json.dumps(scorers))
   with patch.object(recovery,"ROOT",root),patch.object(recovery,"LEAGUES",{}),patch.object(recovery,"public_archived_names",return_value={"missing":{"name":"Verified Player","source":"fixture"}}):
    recovery.main()
   actual=json.loads(path.read_text())
   self.assertEqual(actual["rows"][0]["name"],"Verified Player")
   for before,after in zip(scorers["rows"],actual["rows"]):
    self.assertEqual({k:v for k,v in before.items() if k!="name"},{k:v for k,v in after.items() if k!="name"})
   self.assertEqual(json.loads((root/"data/ownership/players.json").read_text())["unresolvedIds"],["unknown"])
if __name__=="__main__":unittest.main()
