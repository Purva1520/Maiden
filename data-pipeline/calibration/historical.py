"""Historical ODI/T20 calibration distributions from maiden.sqlite.

Population: all men's ODI and T20 innings in the normalized Cricsheet database
(broad, not World-Cup-only, §7), first and second innings, super-overs excluded.

Metric definitions (§10-18), identical to the simulated side (§65):
* score        = sum of all runs in the innings (incl. extras).
* legal_balls  = deliveries excluding wides and no-balls.
* run_rate     = score / legal_balls * 6.
* wickets      = all dismissals in the innings (wickets falling).
* wicket_rate  = wickets / legal_balls * 100  (per 100 legal balls).
* four_rate    = fours / legal_balls * 100  (batter_runs == 4, non-boundary=0).
* six_rate     = sixes / legal_balls * 100.
* economy (environment) = total runs / total legal balls * 6 (delivery-weighted).

Only "full" innings (>= 80% of the format's balls, or all out) feed the score /
rate distributions so rain-reduced innings do not distort them (§9).
"""

from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd

MAX_BALLS = {"ODI": 300, "T20": 120}
# Phase boundaries mirror the simulator (§34): PP = first N overs, death = last M.
PHASE_BOUNDS = {"ODI": (10, 40), "T20": (6, 16)}  # (powerplay_end_over, death_start_over)
FULL_INNINGS_FRACTION = 0.8

_DELIVERIES_SQL = """
WITH dex AS (
    SELECT delivery_id,
           MAX(CASE WHEN extra_type IN ('wides','noballs') THEN 1 ELSE 0 END) AS illegal
    FROM delivery_extras GROUP BY delivery_id
),
wkt AS (SELECT delivery_id, COUNT(*) AS n FROM delivery_wickets GROUP BY delivery_id)
SELECT m.format, i.match_id, i.innings_id, i.innings_number, o.over_number,
       d.total_runs, d.batter_runs, d.non_boundary,
       COALESCE(dex.illegal, 0) AS illegal, COALESCE(wkt.n, 0) AS wk
FROM deliveries d
JOIN overs o    ON d.over_id = o.over_id
JOIN innings i  ON o.innings_id = i.innings_id
JOIN matches m  ON i.match_id = m.match_id
LEFT JOIN dex   ON dex.delivery_id = d.delivery_id
LEFT JOIN wkt   ON wkt.delivery_id = d.delivery_id
WHERE i.is_super_over = 0 AND i.innings_number IN (1, 2)
"""


def _phase(fmt: str, over_number: int) -> str:
    pp_end, death_start = PHASE_BOUNDS[fmt]
    if over_number < pp_end:
        return "POWERPLAY"
    if over_number >= death_start:
        return "DEATH"
    return "MIDDLE"


def load_deliveries(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql_query(_DELIVERIES_SQL, conn)
    df["legal"] = (df["illegal"] == 0).astype(int)
    df["is_four"] = ((df["batter_runs"] == 4) & (df["non_boundary"] == 0)).astype(int)
    df["is_six"] = ((df["batter_runs"] == 6) & (df["non_boundary"] == 0)).astype(int)
    df["phase"] = [_phase(f, o) for f, o in zip(df["format"], df["over_number"], strict=True)]
    return df


def innings_frame(deliveries: pd.DataFrame) -> pd.DataFrame:
    keys = ["format", "match_id", "innings_id", "innings_number"]
    g = deliveries.groupby(keys, as_index=False).agg(
        score=("total_runs", "sum"),
        legal_balls=("legal", "sum"),
        fours=("is_four", "sum"),
        sixes=("is_six", "sum"),
        wickets=("wk", "sum"),
    )
    g["run_rate"] = np.where(g["legal_balls"] > 0, g["score"] / g["legal_balls"] * 6, np.nan)
    g["wicket_rate"] = np.where(g["legal_balls"] > 0, g["wickets"] / g["legal_balls"] * 100, np.nan)
    g["four_rate"] = np.where(g["legal_balls"] > 0, g["fours"] / g["legal_balls"] * 100, np.nan)
    g["six_rate"] = np.where(g["legal_balls"] > 0, g["sixes"] / g["legal_balls"] * 100, np.nan)
    max_balls = g["format"].map(MAX_BALLS)
    full = g["legal_balls"] >= FULL_INNINGS_FRACTION * max_balls
    g["full_innings"] = full | (g["wickets"] >= 10)
    return g


def phase_frame(deliveries: pd.DataFrame) -> pd.DataFrame:
    g = deliveries.groupby(["format", "phase"], as_index=False).agg(
        runs=("total_runs", "sum"),
        legal_balls=("legal", "sum"),
        fours=("is_four", "sum"),
        sixes=("is_six", "sum"),
        wickets=("wk", "sum"),
    )
    g["runs_per_over"] = g["runs"] / g["legal_balls"] * 6
    g["four_rate"] = g["fours"] / g["legal_balls"] * 100
    g["six_rate"] = g["sixes"] / g["legal_balls"] * 100
    g["wicket_rate"] = g["wickets"] / g["legal_balls"] * 100
    return g


def match_frame(innings: pd.DataFrame) -> pd.DataFrame:
    """Chase / margin metrics from matches with both innings present and full-ish."""
    inn1 = innings[innings["innings_number"] == 1].set_index("match_id")
    inn2 = innings[innings["innings_number"] == 2].set_index("match_id")
    common = inn1.index.intersection(inn2.index)
    rows = []
    for mid in common:
        a = inn1.loc[mid]
        b = inn2.loc[mid]
        fmt = a["format"]
        # Require a completed first innings (full overs or all out) for a real target.
        if not a["full_innings"]:
            continue
        target = a["score"] + 1
        chased = b["score"] >= target
        rows.append(
            {
                "match_id": mid,
                "format": fmt,
                "inn1_score": int(a["score"]),
                "inn2_score": int(b["score"]),
                "target": int(target),
                "chase_success": bool(chased),
                "margin_runs": None if chased else int(a["score"] - b["score"]),
                "margin_wickets": int(10 - b["wickets"]) if chased else None,
                "balls_remaining": int(MAX_BALLS[fmt] - b["legal_balls"]) if chased else None,
            }
        )
    return pd.DataFrame(rows)


def _dist(s: pd.Series) -> dict:
    v = s.dropna().astype(float)
    d = {"count": int(v.size)}
    if v.size:
        d["mean"] = round(float(v.mean()), 3)
        d["median"] = round(float(v.median()), 3)
        d["std"] = round(float(v.std(ddof=1)), 3) if v.size > 1 else 0.0
        for p in (10, 25, 50, 75, 90, 95):
            d[f"p{p}"] = round(float(v.quantile(p / 100)), 3)
    return d


def summarize(innings: pd.DataFrame, phases: pd.DataFrame, matches: pd.DataFrame) -> dict:
    out: dict = {"source": "cricsheet", "formats": {}}
    for fmt in ("ODI", "T20"):
        full = innings[(innings["format"] == fmt) & innings["full_innings"]]
        m = matches[matches["format"] == fmt]
        economy = (
            float(full["score"].sum() / full["legal_balls"].sum() * 6)
            if full["legal_balls"].sum()
            else None
        )
        out["formats"][fmt] = {
            "innings_count": int(len(full)),
            "score": _dist(full["score"]),
            "run_rate": _dist(full["run_rate"]),
            "wicket_rate": _dist(full["wicket_rate"]),
            "four_rate": _dist(full["four_rate"]),
            "six_rate": _dist(full["six_rate"]),
            "economy": round(economy, 3) if economy is not None else None,
            "chase": {
                "attempts": int(len(m)),
                "success_rate": round(float(m["chase_success"].mean()), 4) if len(m) else None,
            },
            "margin_runs": _dist(m["margin_runs"]),
            "margin_wickets": _dist(m["margin_wickets"]),
            "balls_remaining": _dist(m["balls_remaining"]),
            "phases": {
                r["phase"]: {
                    "runs_per_over": round(r["runs_per_over"], 3),
                    "four_rate": round(r["four_rate"], 3),
                    "six_rate": round(r["six_rate"], 3),
                    "wicket_rate": round(r["wicket_rate"], 3),
                }
                for _, r in phases[phases["format"] == fmt].iterrows()
            },
        }
    return out


def build(conn: sqlite3.Connection) -> dict:
    deliveries = load_deliveries(conn)
    innings = innings_frame(deliveries)
    phases = phase_frame(deliveries)
    matches = match_frame(innings)
    return {
        "innings": innings,
        "phases": phases,
        "matches": matches,
        "summary": summarize(innings, phases, matches),
    }
