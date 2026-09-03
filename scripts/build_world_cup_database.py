#!/usr/bin/env python3
"""Build the Phase 2 World Cup tables in maiden.sqlite.

Usage:
    python scripts/build_world_cup_database.py
    python scripts/build_world_cup_database.py --db path/to/maiden.sqlite

Reads curated source files from data/game/world_cups/ and writes the
``tournaments``, ``tournament_teams``, and ``tournament_squads`` tables.
The build is idempotent — Phase 2 tables are cleared and re-populated
on each run. Phase 1 tables are never modified.
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
from export.schema import INDEX_STATEMENTS, SCHEMA_STATEMENTS  # noqa: E402
from normalization.world_cups import (  # noqa: E402
    WorldCupBuilder,
    load_curated_squads,
    load_teams,
    load_tournaments,
    validate_curated_data,
)
from validation.world_cup_report import generate_world_cup_report  # noqa: E402

logger = get_logger("build_world_cups")


def _ensure_schema(conn: sqlite3.Connection) -> None:
    """Create Phase 1 + Phase 2 tables if they don't exist yet."""
    existing = {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    if "tournaments" not in existing:
        logger.info("Phase 2 tables not found — creating schema")
        for stmt in SCHEMA_STATEMENTS:
            # Skip tables that already exist
            table_name = stmt.strip().split("(")[0].split()[-1]
            if table_name not in existing:
                try:
                    conn.execute(stmt)
                except sqlite3.OperationalError:
                    pass  # table already exists
        for stmt in INDEX_STATEMENTS:
            try:
                conn.execute(stmt)
            except sqlite3.OperationalError:
                pass  # index already exists
        conn.commit()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build the Phase 2 World Cup tables in maiden.sqlite."
    )
    parser.add_argument("--db", default=str(config.DB_PATH), help="path to the SQLite database")
    args = parser.parse_args(argv)

    configure_logging()
    db_path = Path(args.db)

    # --- Load curated data ---
    logger.info("Loading curated World Cup data from %s", config.WORLD_CUP_DIR)
    try:
        tournaments = load_tournaments()
        teams = load_teams()
        squads = load_curated_squads()
    except FileNotFoundError as exc:
        logger.error("Curated data file not found: %s", exc)
        return 2

    logger.info(
        "Loaded: %d tournaments, %d team entries, %d squad records",
        len(tournaments),
        len(teams),
        len(squads),
    )

    # --- Validate curated data ---
    logger.info("Validating curated data")
    errors, warnings = validate_curated_data(tournaments, teams, squads)
    for w in warnings:
        logger.warning("Curated data: %s", w)
    if errors:
        for e in errors:
            logger.error("Curated data: %s", e)
        logger.error("Curated data validation failed — aborting build")
        return 1

    # --- Build ---
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = OFF")  # build phase; checked after
        _ensure_schema(conn)

        builder = WorldCupBuilder(conn)
        stats = builder.build(tournaments, teams, squads)
        logger.info(
            "Built %d tournaments, %d teams, %d squad entries",
            stats.tournaments_loaded,
            stats.teams_loaded,
            stats.squad_entries_loaded,
        )

        # --- Generate report ---
        logger.info("Generating World Cup report")
        conn.execute("PRAGMA foreign_keys = ON")
        report = generate_world_cup_report(conn)

        report_json = config.WORLD_CUP_REPORT_JSON
        report_txt = config.WORLD_CUP_REPORT_TXT
        report.write(report_json, report_txt)
        logger.info("Report written: %s", report_json)

        print()
        print(report.render_text())

        if report.status != "PASS":
            logger.error("World Cup build completed with validation errors")
            return 1

        logger.info("World Cup build PASSED")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
