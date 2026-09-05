#!/usr/bin/env python3
"""Generate Maiden player ratings (Phase 5) from the Phase 4 statistics dataset.

Usage:
    python scripts/generate_ratings.py --version v1
    python scripts/generate_ratings.py --version v1 --dry-run

Loads player_tournament_stats.parquet + model configuration, computes 0-99
batting/bowling ratings per player x tournament x format, validates, and writes
player_ratings.parquet, ratings_<version>.json, the SQLite player_ratings table,
and the rating reports.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core import config  # noqa: E402
from core.logging_setup import configure_logging, get_logger  # noqa: E402
from rating.pipeline import build_ratings, write_outputs  # noqa: E402
from rating.versions import load_config  # noqa: E402
from validation.rating_report import generate_report  # noqa: E402

logger = get_logger("generate_ratings")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate Maiden ratings.")
    parser.add_argument("--version", default="v1")
    parser.add_argument("--dry-run", action="store_true", help="compute but write nothing")
    args = parser.parse_args(argv)
    configure_logging()

    if not config.STATS_PARQUET.exists():
        logger.error("Missing %s — run build_tournament_stats.py first", config.STATS_PARQUET)
        return 2

    cfg = load_config(args.version)
    logger.info(
        "Building ratings (model=%s, calibration=%s)", cfg.model_version, cfg.calibration_version
    )
    df = build_ratings(cfg)
    report = generate_report(df)

    if args.dry_run:
        print("\n[DRY RUN] no files written\n")
        print(f"input records: {len(df)}")
        print(f"populations: {report.populations}")
        print(f"unobserved: {report.unobserved}")
        print(f"validation errors: {len(report.errors)}")
        return 0

    write_outputs(df, cfg)
    report.write(
        config.RATING_REPORT_JSON, config.RATING_REPORT_TXT, config.RATING_DISTRIBUTION_REPORT
    )
    logger.info("wrote %s", config.PLAYER_RATINGS_PARQUET)
    logger.info("wrote %s", config.ratings_json(cfg.model_version))
    logger.info("wrote %s", config.RATING_REPORT_JSON)
    print()
    print(report.render_text())
    return 0 if report.status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
