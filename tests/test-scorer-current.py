import importlib.util
from pathlib import Path
import unittest
script=Path(__file__).resolve().parents[1]/"scripts/build-bhl-scorers.py"
spec=importlib.util.spec_from_file_location("scorers",script)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class CurrentSeasonTests(unittest.TestCase):
 def test_preserves_historical_rows_exactly(self):
  historical={"season":"2018-19","id":"old","starts":25,"fpts":410}
  old_current={"season":"2026-27","id":"a","starts":6}
  updated={"season":"2026-27","id":"a","starts":7}
  existing=[historical,old_current]
  merged=m.merge_seasons(existing,[updated],["2026-27"])
  self.assertEqual(merged,[historical,updated])
  self.assertEqual(existing,[historical,old_current])
 def test_replaces_current_coverage_and_diagnostics(self):
  old=[{"season":"2025-26","checkedPeriods":24},{"season":"2026-27","checkedPeriods":6}]
  new=[{"season":"2026-27","checkedPeriods":7}]
  self.assertEqual(sum(r["checkedPeriods"] for r in m.merge_seasons(old,new,["2026-27"])),31)
 def test_does_not_duplicate_refreshed_rows(self):
  current=[{"season":"2026-27","id":"a"}]
  self.assertEqual(m.merge_seasons(current,current,["2026-27"]),current)
if __name__=="__main__":unittest.main()
