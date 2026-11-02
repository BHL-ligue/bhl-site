import datetime as dt
import runpy
import unittest

module = runpy.run_path("scripts/sync-fantrax.py")
period_at = module["period_at"]

class PeriodTests(unittest.TestCase):
    def test_toronto_dst_boundary(self):
        periods = [
            {"number": 5, "startDate": "2026-10-26T19:00:00.0-0400", "endDate": "2026-11-02T18:59:59.0-0500"},
            {"number": 6, "startDate": "2026-11-02T19:00:00.0-0500", "endDate": "2026-11-09T19:59:59.0-0500"},
        ]
        self.assertEqual(period_at(periods, dt.datetime.fromisoformat("2026-11-02T12:00:00+00:00")), 5)
        self.assertEqual(period_at(periods, dt.datetime.fromisoformat("2026-11-03T00:00:00+00:00")), 6)

    def test_outside_season_retains_snapshot(self):
        with self.assertRaises(ValueError):
            period_at([], dt.datetime.now(dt.timezone.utc))

if __name__ == "__main__":
    unittest.main()
