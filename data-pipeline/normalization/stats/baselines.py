"""Tournament and era statistical baselines (the cricket environment).

Baselines are persisted (not recomputed per query, §36). For each
tournament/era, format, population and metric we record count/mean/median/
std/quantiles. Distributions — not just means — so Phase 5 can use percentile,
z-score or robust z-score (§37).

Baselines are computed over the qualifying player population for each metric
(players for whom the metric is defined). This is player-weighted; environment
metrics that should be delivery-weighted (run rate, economy) are recorded
separately with population='environment'.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import (
    BASELINE_MIN_POPULATION,
    BATTING_NORM_FEATURES,
    BOWLING_NORM_FEATURES,
)

_QUANTILES = {"q10": 0.10, "q25": 0.25, "q50": 0.50, "q75": 0.75, "q90": 0.90}


def _distribution_rows(
    group_key: str,
    df: pd.DataFrame,
    metrics: dict[str, int],
    population: str,
    extra: dict,
) -> list[dict]:
    """One row per (group, metric) with distributional summary."""
    rows: list[dict] = []
    for key, sub in df.groupby(group_key):
        for metric in metrics:
            vals = sub[metric].dropna()
            n = int(vals.size)
            row = {
                group_key: key,
                "population": population,
                "metric": metric,
                "count": n,
                "mean": float(vals.mean()) if n else np.nan,
                "median": float(vals.median()) if n else np.nan,
                "std": float(vals.std(ddof=1)) if n >= 2 else np.nan,
                "baseline_status": "INSUFFICIENT" if n < BASELINE_MIN_POPULATION else "OK",
                **extra,
            }
            for qname, q in _QUANTILES.items():
                row[qname] = float(vals.quantile(q)) if n else np.nan
            rows.append(row)
    return rows


def compute_tournament_baselines(player_df: pd.DataFrame) -> pd.DataFrame:
    """Per-tournament distribution of each normalized batting/bowling metric."""
    batted = player_df[player_df["bat_innings"] > 0]
    bowled = player_df[player_df["bowl_innings"] > 0]

    rows: list[dict] = []
    # carry format/year for context
    meta = player_df.groupby("tournament_id")[["format", "year"]].first().to_dict("index")

    def ctx(tid: str) -> dict:
        m = meta.get(tid, {})
        return {"format": m.get("format"), "year": m.get("year")}

    for population, sub, metrics in (
        ("batting", batted, BATTING_NORM_FEATURES),
        ("bowling", bowled, BOWLING_NORM_FEATURES),
    ):
        for tid, g in sub.groupby("tournament_id"):
            rows.extend(
                _distribution_rows("tournament_id", g.assign(_t=tid), metrics, population, ctx(tid))
            )
    out = pd.DataFrame(rows)
    return out


def compute_era_baselines(player_df: pd.DataFrame) -> pd.DataFrame:
    """Pooled per-era distribution of each metric (players across the era window)."""
    batted = player_df[(player_df["bat_innings"] > 0) & player_df["era_id"].notna()]
    bowled = player_df[(player_df["bowl_innings"] > 0) & player_df["era_id"].notna()]

    rows: list[dict] = []
    meta = player_df.dropna(subset=["era_id"]).groupby("era_id")["format"].first().to_dict()

    for population, sub, metrics in (
        ("batting", batted, BATTING_NORM_FEATURES),
        ("bowling", bowled, BOWLING_NORM_FEATURES),
    ):
        for eid, g in sub.groupby("era_id"):
            rows.extend(
                _distribution_rows("era_id", g, metrics, population, {"format": meta.get(eid)})
            )
    return pd.DataFrame(rows)


def environment_summary(player_df: pd.DataFrame) -> pd.DataFrame:
    """Delivery-weighted environment metrics per tournament (for era analysis).

    Uses aggregate raw totals so a few small-sample players cannot distort it.
    """
    g = player_df.groupby(["tournament_id", "format", "year"], as_index=False).agg(
        total_bat_runs=("bat_runs", "sum"),
        total_bat_balls=("bat_balls", "sum"),
        total_fours=("bat_fours", "sum"),
        total_sixes=("bat_sixes", "sum"),
        total_bowl_balls=("bowl_balls", "sum"),
        total_bowl_runs=("bowl_runs_conceded", "sum"),
        total_wickets=("bowl_wickets", "sum"),
    )
    g["batting_run_rate"] = np.where(
        g["total_bat_balls"] > 0, g["total_bat_runs"] / g["total_bat_balls"] * 100, np.nan
    )
    g["boundary_rate"] = np.where(
        g["total_bat_balls"] > 0,
        (g["total_fours"] + g["total_sixes"]) / g["total_bat_balls"],
        np.nan,
    )
    g["environment_economy"] = np.where(
        g["total_bowl_balls"] > 0, g["total_bowl_runs"] * 6 / g["total_bowl_balls"], np.nan
    )
    return g
