#!/usr/bin/env python3
"""Build Phase 4 tournament statistics, baselines, era baselines and features.

Usage:
    python scripts/build_tournament_stats.py
    python scripts/build_tournament_stats.py --format odi
    python scripts/build_tournament_stats.py --format t20

Reads data/processed/maiden.sqlite (Phase 1-3) and writes:
    player_tournament_stats.parquet, tournament_baselines.parquet,
    era_baselines.parquet, tournament_stats_report.{json,txt},
    tournament_stats_manifest.json, feature_dictionary.json
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core import config  # noqa: E402
from core.logging_setup import configure_logging, get_logger  # noqa: E402
from export.stats_export import write_outputs  # noqa: E402
from normalization.stats.build import build  # noqa: E402
from validation.tournament_stats_report import generate_report  # noqa: E402

logger = get_logger("build_tournament_stats")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build Phase 4 tournament statistics.")
    parser.add_argument("--format", default="all", choices=["odi", "t20", "all"])
    parser.add_argument("--db", default=str(config.DB_PATH))
    args = parser.parse_args(argv)

    configure_logging()
    db_path = Path(args.db)
    if not db_path.exists():
        logger.error("Database not found: %s (run the Phase 1-3 build first)", db_path)
        return 2

    formats = None if args.format == "all" else {args.format.upper()}
    conn = sqlite3.connect(db_path)
    try:
        logger.info("Building tournament statistics (format=%s)...", args.format)
        frames = build(conn, formats=formats)
        report = generate_report(conn, frames)
        paths = write_outputs(conn, frames)
        report.write(config.STATS_REPORT_JSON, config.STATS_REPORT_TXT)
    finally:
        conn.close()

    for name, p in paths.items():
        logger.info("wrote %s -> %s", name, p)
    print()
    print(report.render_text())
    return 0 if report.status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
