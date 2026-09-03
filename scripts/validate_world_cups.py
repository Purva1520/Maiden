#!/usr/bin/env python3
"""Validate the Phase 2 World Cup tables in an existing maiden.sqlite.

Usage:
    python scripts/validate_world_cups.py
    python scripts/validate_world_cups.py --db path/to/maiden.sqlite

Runs structural and data-quality checks on the World Cup universe and prints
a report. Exits non-zero if any error-level check fails.
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
from validation.world_cup_report import generate_world_cup_report  # noqa: E402

logger = get_logger("validate_world_cups")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate the Phase 2 World Cup database."
    )
    parser.add_argument(
        "--db", default=str(config.DB_PATH), help="path to the SQLite database"
    )
    args = parser.parse_args(argv)

    configure_logging()
    db_path = Path(args.db)
    if not db_path.exists():
        logger.error(
            "Database not found: %s (run build_world_cup_database.py first)", db_path
        )
        return 2

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        report = generate_world_cup_report(conn)

        report_json = config.WORLD_CUP_REPORT_JSON
        report_txt = config.WORLD_CUP_REPORT_TXT
        report.write(report_json, report_txt)

        print(report.render_text())

        if report.status != "PASS":
            logger.error("Validation FAILED")
            return 1
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
