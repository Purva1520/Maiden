#!/usr/bin/env python3
"""Validate an existing Maiden SQLite database and print a summary.

Usage:
    python scripts/validate_database.py
    python scripts/validate_database.py --db path/to/maiden.sqlite

Runs the structural / data-quality checks and a few sample queries. Exits non-zero
if any error-level check fails.
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
from validation.checks import run_all_checks  # noqa: E402

logger = get_logger("validate")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate the Maiden database.")
    parser.add_argument("--db", default=str(config.DB_PATH), help="path to the SQLite database")
    args = parser.parse_args(argv)

    configure_logging()
    db_path = Path(args.db)
    if not db_path.exists():
        logger.error("Database not found: %s (run build_database.py first)", db_path)
        return 2

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        summary = run_all_checks(conn)

        print("Table counts:")
        for table, n in summary.table_counts.items():
            print(f"  {table:<18} {n:>10,}")
        print()
        print(f"Formats: {summary.format_matches}")
        print(f"Date range: {summary.date_range['min']} .. {summary.date_range['max']}")
        print()

        # Sample queries (Phase 1 acceptance).
        print("Sample queries:")
        for label, sql in (
            ("matches by format", "SELECT format, COUNT(*) FROM matches GROUP BY format"),
            ("distinct players", "SELECT COUNT(*) FROM players"),
            ("total deliveries", "SELECT COUNT(*) FROM deliveries"),
        ):
            rows = conn.execute(sql).fetchall()
            print(f"  {label}: {rows}")
        print()

        if summary.warnings:
            print("Warnings:")
            for w in summary.warnings:
                print(f"  [WARNING] {w}")
        if summary.errors:
            print("Errors:")
            for e in summary.errors:
                print(f"  [ERROR] {e}")
            print("\nVALIDATION FAILED")
            return 1
        print("\nVALIDATION PASSED")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
