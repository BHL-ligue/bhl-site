"""BHL current-season calendar: Monday-Sunday, publication after 03:00 Eastern."""
import datetime as dt
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/Toronto")

def window(period):
    start = dt.datetime.fromisoformat(period.get("startDate") or period["start"]).date()
    end = dt.datetime.fromisoformat(period.get("endDate") or period["end"]).date()
    # Fantrax's closing Monday belongs to the next BHL week.
    if end.weekday() == 0:
        end -= dt.timedelta(days=1)
    if end < start:
        raise ValueError("Invalid BHL period calendar")
    return start, end

def closes_at(period):
    _, end = window(period)
    return dt.datetime.combine(end + dt.timedelta(days=1), dt.time(3), EASTERN)

def complete(period, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    return now >= closes_at(period)

def current_season(now=None):
    local = (now or dt.datetime.now(dt.timezone.utc)).astimezone(EASTERN)
    year = local.year if local.month >= 7 else local.year - 1
    return f"{year}-{str(year+1)[-2:]}"

def audit_period(period):
    start, end = window(period)
    return {**period,
        "start": dt.datetime.combine(start, dt.time.min, EASTERN).isoformat(),
        "end": dt.datetime.combine(end, dt.time.max, EASTERN).isoformat()}
