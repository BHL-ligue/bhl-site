import datetime as dt
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import bhl_periods as b

class PeriodTests(unittest.TestCase):
 def test_period_seven(self):
  p={"startDate":"2026-11-09T20:00:00-05:00","endDate":"2026-11-16T19:29:59-05:00"}
  self.assertEqual(b.window(p),(dt.date(2026,11,9),dt.date(2026,11,15)))
  self.assertFalse(b.complete(p,dt.datetime.fromisoformat("2026-11-16T07:59:59+00:00")))
  self.assertTrue(b.complete(p,dt.datetime.fromisoformat("2026-11-16T08:00:00+00:00")))
 def test_no_monday_overlap(self):
  p={"start":"2026-11-09T20:00:00-05:00","end":"2026-11-16T19:29:59-05:00"}
  normalized=b.audit_period(p)
  self.assertEqual(normalized["start"][:10],"2026-11-09")
  self.assertEqual(normalized["end"][:10],"2026-11-15")
 def test_dst(self):
  p={"start":"2026-10-26T19:00:00-04:00","end":"2026-11-02T18:59:59-05:00"}
  self.assertEqual(b.closes_at(p).astimezone(dt.timezone.utc).hour,8)
  summer={"start":"2026-10-12T19:00:00-04:00","end":"2026-10-19T18:59:59-04:00"}
  self.assertEqual(b.closes_at(summer).astimezone(dt.timezone.utc).hour,7)
 def test_opening_partial_week(self):
  p={"startDate":"2026-09-29T19:00:00-04:00","endDate":"2026-10-05T18:59:59-04:00"}
  self.assertEqual(b.window(p),(dt.date(2026,9,29),dt.date(2026,10,4)))
 def test_current_week_stays_open(self):
  p={"start":"2026-11-16T19:30:00-05:00","end":"2026-11-23T18:59:59-05:00"}
  self.assertFalse(b.complete(p,dt.datetime.fromisoformat("2026-11-16T09:00:00+00:00")))
if __name__=="__main__":unittest.main()
