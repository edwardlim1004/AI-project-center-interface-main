#!/usr/bin/env python3
"""
Build the US 30Y historical-regime dataset and dashboard payload.

Primary series:
- FRED DGS30 (source: Federal Reserve Board H.15), daily percent yield.
- The official 30Y constant-maturity series has a publication gap from
  2002-02-19 through 2006-02-08. The gap is intentionally NOT interpolated.

Investment thresholds are Edward's monitoring levels:
5.40%, 5.55%, 5.70%, 5.80%.

Outputs:
- data/us30y_history.csv                      full cleaned daily history
- docs/investment-ai/us30y-history/history.json
- docs/investment-ai/us30y-history/summary.json
"""

from __future__ import annotations

import csv
import io
import json
import math
import statistics
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import requests

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30"
TREASURY_CSV_TEMPLATE = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve"
    "&field_tdr_date_value={year}&page&_format=csv"
)
DATA_SOURCE_USED = "unknown"
SOURCE_PAGE = "https://fred.stlouisfed.org/series/DGS30"
TREASURY_PAGE = (
    "https://home.treasury.gov/resource-center/data-chart-center/"
    "interest-rates/TextView?type=daily_treasury_yield_curve"
)
THRESHOLDS = [5.40, 5.55, 5.70, 5.80]
HORIZONS = OrderedDict([("1m", 21), ("3m", 63), ("6m", 126), ("12m", 252)])
EVENT_COOLDOWN_DAYS = 20


def _parse_fred(text):
    rows = []
    for row in csv.DictReader(io.StringIO(text.lstrip("\ufeff"))):
        raw_date = (row.get("DATE") or row.get("observation_date") or "").strip()
        raw_value = (row.get("DGS30") or "").strip()
        if not raw_date or raw_value in {"", ".", "NA", "N/A"}:
            continue
        try:
            value = float(raw_value)
            date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        rows.append({"date": date, "yield": value})
    return rows


def _fetch_treasury_years(start_year=1990):
    session = requests.Session()
    session.headers.update({"User-Agent": "Edward-Investment-AI/1.0"})
    by_date = {}
    current_year = datetime.now(timezone.utc).year
    successful_years = 0

    for year in range(start_year, current_year + 1):
        url = TREASURY_CSV_TEMPLATE.format(year=year)
        try:
            r = session.get(url, timeout=(10, 20))
            if r.status_code != 200:
                continue
            reader = csv.DictReader(io.StringIO(r.text.lstrip("\ufeff")))
            found = 0
            for row in reader:
                raw_date = (row.get("Date") or row.get("DATE") or "").strip()
                raw_value = (row.get("30 YR") or row.get("30 Yr") or row.get("30YR") or "").strip()
                if not raw_date or raw_value in {"", ".", "NA", "N/A"}:
                    continue
                try:
                    value = float(raw_value)
                    date = datetime.strptime(raw_date, "%m/%d/%Y").date()
                except ValueError:
                    continue
                by_date[date] = {"date": date, "yield": value}
                found += 1
            if found:
                successful_years += 1
        except requests.RequestException:
            continue

    rows = [by_date[d] for d in sorted(by_date)]
    if len(rows) < 1000:
        raise RuntimeError(
            f"Treasury fallback returned too little history: {len(rows)} rows "
            f"across {successful_years} years"
        )
    return rows


def fetch_daily():
    global DATA_SOURCE_USED

    try:
        r = requests.get(
            FRED_CSV,
            timeout=(10, 18),
            headers={"User-Agent": "Edward-Investment-AI/1.0"},
        )
        r.raise_for_status()
        rows = _parse_fred(r.text)
        if len(rows) >= 1000:
            rows.sort(key=lambda x: x["date"])
            DATA_SOURCE_USED = "Federal Reserve Board H.15 via FRED DGS30"
            return rows
    except requests.RequestException as e:
        print(f"[warn] FRED download failed, using Treasury fallback: {e}")

    rows = _fetch_treasury_years(start_year=1990)
    DATA_SOURCE_USED = "U.S. Treasury daily par yield curve (30 YR), 1990-present fallback"
    return rows

def classify(y):
    if y < 5.00:
        return {"code": "LOW", "label": "< 5.00% 하락추세 관찰구간", "level": 0}
    if y < 5.40:
        return {"code": "WATCH", "label": "5.00–5.40% 대기구간", "level": 0}
    if y < 5.55:
        return {"code": "L1", "label": "1차 분할매수 (≥5.40%)", "level": 1}
    if y < 5.70:
        return {"code": "L2", "label": "2차 분할매수 (≥5.55%)", "level": 2}
    if y < 5.80:
        return {"code": "L3", "label": "3차 분할매수 (≥5.70%)", "level": 3}
    return {"code": "L4", "label": "4차 분할매수 (≥5.80%)", "level": 4}


def percentile(values, x):
    if not values:
        return None
    n = sum(1 for v in values if v <= x)
    return round(100.0 * n / len(values), 1)


def mean_or_none(vals):
    return round(statistics.fmean(vals), 1) if vals else None


def median_or_none(vals):
    return round(statistics.median(vals), 1) if vals else None


def historical_threshold_stats(rows):
    out = []
    for t in THRESHOLDS:
        event_idx = []
        last_kept = -10_000
        for i in range(1, len(rows)):
            gap_days = (rows[i]["date"] - rows[i - 1]["date"]).days
            if gap_days <= 10 and rows[i - 1]["yield"] < t <= rows[i]["yield"]:
                if i - last_kept >= EVENT_COOLDOWN_DAYS:
                    event_idx.append(i)
                    last_kept = i

        horizons = {}
        for label, step in HORIZONS.items():
            changes = []
            for i in event_idx:
                j = i + step
                if j < len(rows):
                    calendar_days = (rows[j]["date"] - rows[i]["date"]).days
                    max_calendar_days = int(step * 2.2) + 14
                    if calendar_days <= max_calendar_days:
                        changes.append((rows[j]["yield"] - rows[i]["yield"]) * 100.0)
            horizons[label] = {
                "n": len(changes),
                "mean_change_bp": mean_or_none(changes),
                "median_change_bp": median_or_none(changes),
                "prob_yield_lower_pct": (
                    round(100.0 * sum(1 for x in changes if x < 0) / len(changes), 1)
                    if changes else None
                ),
            }

        out.append(
            {
                "threshold": t,
                "independent_upcrossings": len(event_idx),
                "first_event": rows[event_idx[0]]["date"].isoformat() if event_idx else None,
                "last_event": rows[event_idx[-1]]["date"].isoformat() if event_idx else None,
                "forward": horizons,
            }
        )
    return out


def monthly_series(rows):
    by_month = OrderedDict()
    for r in rows:
        key = r["date"].strftime("%Y-%m")
        by_month[key] = r
    return [{"date": r["date"].isoformat(), "yield": r["yield"]} for r in by_month.values()]


def build_summary(rows):
    latest = rows[-1]
    prev = rows[-2] if len(rows) >= 2 else None
    y = latest["yield"]
    regime = classify(y)

    all_values = [r["yield"] for r in rows]
    post_2006 = [r["yield"] for r in rows if r["date"].isoformat() >= "2006-02-09"]
    latest_date = latest["date"]
    try:
        start_20y = latest_date.replace(year=latest_date.year - 20)
    except ValueError:
        start_20y = latest_date.replace(year=latest_date.year - 20, day=28)
    last_20y = [r["yield"] for r in rows if r["date"] >= start_20y]

    next_threshold = next((t for t in THRESHOLDS if y < t), None)
    highest_crossed = max([t for t in THRESHOLDS if y >= t], default=None)

    recent20 = rows[-20:]
    recent60 = rows[-60:]
    summary = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "series": ("DGS30" if "FRED" in DATA_SOURCE_USED else "US Treasury 30 YR Par Yield"),
        "source": {
            "name": DATA_SOURCE_USED,
            "url": SOURCE_PAGE,
            "treasury_reference": TREASURY_PAGE,
            "units": "Percent",
            "frequency": "Daily",
            "coverage_start": rows[0]["date"].isoformat(),
            "gap_note": (
                "30-year constant maturity publication was discontinued after "
                "2002-02-18 and reintroduced 2006-02-09. No interpolation is used."
            ),
        },
        "thresholds": THRESHOLDS,
        "current": {
            "date": latest["date"].isoformat(),
            "yield": y,
            "previous_yield": prev["yield"] if prev else None,
            "daily_change_bp": round((y - prev["yield"]) * 100.0, 1) if prev else None,
            "regime": regime,
            "highest_threshold_crossed": highest_crossed,
            "next_threshold": next_threshold,
            "distance_to_next_bp": round((next_threshold - y) * 100.0, 1) if next_threshold else None,
            "below_5pct": y < 5.00,
        },
        "historical_position": {
            "full_history_percentile": percentile(all_values, y),
            "post_2006_percentile": percentile(post_2006, y),
            "last_20y_percentile": percentile(last_20y, y),
            "full_history_min": min(all_values),
            "full_history_max": max(all_values),
            "recent_20d_min": min(r["yield"] for r in recent20),
            "recent_20d_max": max(r["yield"] for r in recent20),
            "recent_60d_min": min(r["yield"] for r in recent60),
            "recent_60d_max": max(r["yield"] for r in recent60),
        },
        "threshold_history": historical_threshold_stats(rows),
        "methodology": {
            "event_definition": (
                "An upcrossing occurs when the previous valid daily observation is below "
                "the threshold and the current observation is at/above it."
            ),
            "independence_rule": f"Events within {EVENT_COOLDOWN_DAYS} trading days are de-duplicated.",
            "forward_horizons_trading_days": HORIZONS,
            "interpretation": (
                "Historical forward changes are descriptive, not a forecast. "
                "Negative bp means the 30Y yield was lower after the event, which is generally favorable "
                "to long-duration Treasury prices."
            ),
        },
    }
    return summary


def write_outputs(rows):
    data_dir = Path("data")
    web_dir = Path("investment-ai/us30y-history")
    data_dir.mkdir(parents=True, exist_ok=True)
    web_dir.mkdir(parents=True, exist_ok=True)

    with (data_dir / "us30y_history.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "dgs30_pct", "regime"])
        for r in rows:
            w.writerow([r["date"].isoformat(), f'{r["yield"]:.2f}', classify(r["yield"])["code"]])

    payload = {
        "monthly": monthly_series(rows),
        "recent_daily": [
            {"date": r["date"].isoformat(), "yield": r["yield"]}
            for r in rows[-400:]
        ],
    }
    (web_dir / "history.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (web_dir / "summary.json").write_text(
        json.dumps(build_summary(rows), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main():
    rows = fetch_daily()
    write_outputs(rows)
    latest = rows[-1]
    print(f"[ok] DGS30 rows={len(rows):,}, latest={latest['date']} {latest['yield']:.2f}%")


if __name__ == "__main__":
    main()
