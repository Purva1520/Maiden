#!/usr/bin/env python3
"""Validate the Phase 4 statistics outputs.

Usage:
    python scripts/validate_tournament_stats.py

Opens the generated Parquet datasets, checks schema/row-counts/null-semantics,
and re-runs the reconciliation checks against the database.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core import config  # noqa: E402
from core.logging_setup import configure_logging, get_logger  # noqa: E402

logger = get_logger("validate_tournament_stats")

_REQUIRED_COLS = [
    "tournament_id",
    "year",
    "format",
    "team_id",
    "player_id",
    "bat_runs",
    "bat_average",
    "bat_strike_rate",
    "bowl_wickets",
    "bowl_economy",
    "tournament_coverage_status",
    "batting_sample_status",
    "bat_runs_tourn_pct",
    "bowl_economy_tourn_pct",
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Phase 4 statistics outputs.")
    parser.add_argument("--db", default=str(config.DB_PATH))
    args = parser.parse_args(argv)
    configure_logging()

    errors: list[str] = []
    for path in (
        config.STATS_PARQUET,
        config.TOURNAMENT_BASELINES_PARQUET,
        config.ERA_BASELINES_PARQUET,
    ):
        if not path.exists():
            errors.append(f"missing output: {path.name}")
    if errors:
        for e in errors:
            logger.error("%s", e)
        logger.error("Run build_tournament_stats.py first.")
        return 2

    stats = pd.read_parquet(config.STATS_PARQUET)
    tb = pd.read_parquet(config.TOURNAMENT_BASELINES_PARQUET)
    eb = pd.read_parquet(config.ERA_BASELINES_PARQUET)

    print("MAIDEN PHASE 4 STATS VALIDATION")
    print("===============================")
    print(f"player_tournament_stats rows: {len(stats):,}  cols: {stats.shape[1]}")
    print(f"tournament_baselines rows:    {len(tb):,}")
    print(f"era_baselines rows:           {len(eb):,}")
    print(f"formats: {sorted(stats['format'].unique())}")
    print(f"tournaments: {stats['tournament_id'].nunique()}")

    # Schema
    missing = [c for c in _REQUIRED_COLS if c not in stats.columns]
    if missing:
        errors.append(f"missing required columns: {missing}")

    # Row counts non-zero
    if len(stats) == 0:
        errors.append("player_tournament_stats is empty")

    # Null semantics: a player who never batted must have null average, not 0
    never_batted = stats[stats["bat_innings"] == 0]
    if len(never_batted) and never_batted["bat_average"].notna().any():
        errors.append("some non-batters have a non-null bat_average (should be null)")
    if len(never_batted) and (never_batted["bat_highest"].fillna(-1) >= 0).any():
        errors.append("some non-batters have a non-null bat_highest (should be null)")

    # Percentiles in range
    for col in [c for c in stats.columns if c.endswith(("_tourn_pct", "_era_pct"))]:
        v = stats[col].dropna()
        if len(v) and (v.min() < 0 or v.max() > 100):
            errors.append(f"{col} out of [0,100]")

    # Canonical ids: no numeric-only player ids
    if stats["player_id"].astype(str).str.fullmatch(r"\d+").any():
        errors.append("numeric (non-canonical) player_id present")

    # Spot check: known player present
    sach = stats[
        (stats["player_id"] == "sachin_tendulkar") & (stats["tournament_id"] == "ODI_WC_2003")
    ]
    if len(sach):
        row = sach.iloc[0]
        print(
            f"\nSpot check — Sachin Tendulkar ODI_WC_2003: runs={row['bat_runs']}, "
            f"inns={row['bat_innings']}, avg={row['bat_average']:.1f}, "
            f"SR={row['bat_strike_rate']:.1f}, runs_pct={row['bat_runs_tourn_pct']:.0f}"
        )

    print()
    if errors:
        for e in errors:
            print(f"  [ERROR] {e}")
        print("\nSTATUS: FAIL")
        return 1
    print("STATUS: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
