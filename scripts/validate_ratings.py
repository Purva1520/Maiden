#!/usr/bin/env python3
"""Validate the generated Maiden ratings (Phase 5).

Checks range (0-99), null policy, format separation, version consistency,
distribution sanity, and determinism (re-running the model reproduces the
committed parquet).
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
from rating.pipeline import build_ratings  # noqa: E402
from rating.versions import load_config  # noqa: E402
from validation.rating_report import generate_report  # noqa: E402

logger = get_logger("validate_ratings")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Maiden ratings.")
    parser.add_argument("--version", default="v1")
    args = parser.parse_args(argv)
    configure_logging()

    if not config.PLAYER_RATINGS_PARQUET.exists():
        logger.error("Missing %s — run generate_ratings.py first", config.PLAYER_RATINGS_PARQUET)
        return 2

    df = pd.read_parquet(config.PLAYER_RATINGS_PARQUET)
    report = generate_report(df)
    errors = list(report.errors)

    print("MAIDEN RATINGS VALIDATION")
    print("=========================")
    print(f"rows: {len(df)}  populations: {report.populations}")

    # Format separation: every row has a valid format and version.
    if not set(df["format"].unique()) <= {"ODI", "T20"}:
        errors.append("unexpected format value present")
    if df["rating_model_version"].nunique() != 1:
        errors.append("multiple model versions in one output")

    # Determinism: rebuilding must reproduce the committed ratings exactly.
    cfg = load_config(args.version)
    rebuilt = build_ratings(cfg)
    for col in ("bat_rating", "bowl_rating"):
        a = df[col].astype("Float64").fillna(-1).to_numpy()
        b = rebuilt[col].astype("Float64").fillna(-1).to_numpy()
        if not (a == b).all():
            errors.append(f"determinism failure in {col} (rebuild differs)")

    # Spot check present
    for pid, tid in (("sachin_tendulkar", "ODI_WC_2003"),):
        row = df[(df["player_id"] == pid) & (df["tournament_id"] == tid)]
        if len(row):
            r = row.iloc[0]
            print(f"spot: {pid} {tid} batRating={r['bat_rating']} bowlRating={r['bowl_rating']}")

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
