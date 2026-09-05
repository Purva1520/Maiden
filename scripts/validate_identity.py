#!/usr/bin/env python3
"""Validate player identity and referential integrity across the Maiden database.

Usage:
    python scripts/validate_identity.py
    python scripts/validate_identity.py --db path/to/maiden.sqlite
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core import config
from core.logging_setup import configure_logging, get_logger

logger = get_logger("validate_identity")


def validate_identity(db_path: Path) -> int:
    """Run referential integrity and identity consistency checks."""
    if not db_path.exists():
        logger.error("Database not found: %s", db_path)
        return 1

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    errors: list[str] = []
    warnings: list[str] = []

    # 1. PRAGMA foreign_key_check
    fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    if fk_violations:
        errors.append(f"Foreign key violations found: {len(fk_violations)}")
        for v in fk_violations[:5]:
            errors.append(f"  FK violation: table={v[0]} rowid={v[1]} parent={v[2]}")

    # 2. Check for NULL or unmapped player IDs in referencing tables
    checks = [
        ("tournament_squads", "player_id"),
        ("match_players", "player_id"),
        ("deliveries", "batter_id"),
        ("deliveries", "bowler_id"),
        ("deliveries", "non_striker_id"),
        ("delivery_wickets", "player_out_id"),
    ]

    for table, col in checks:
        try:
            null_count = conn.execute(
                f"SELECT COUNT(*) FROM {table} WHERE {col} IS NULL"
            ).fetchone()[0]
            if null_count > 0:
                errors.append(f"Table '{table}' has {null_count} NULL '{col}' values")

            # Check orphans (references to players not in players table)
            orphan_count = conn.execute(
                f"SELECT COUNT(*) FROM {table} t "
                f"LEFT JOIN players p ON t.{col} = p.player_id "
                f"WHERE p.player_id IS NULL AND t.{col} IS NOT NULL"
            ).fetchone()[0]
            if orphan_count > 0:
                errors.append(
                    f"Table '{table}' has {orphan_count} orphan '{col}' references not found in players"
                )
        except sqlite3.OperationalError:
            pass  # Table does not exist in this test configuration

    # 3. Check for external identifier collisions
    try:
        dup_ids = conn.execute(
            "SELECT identifier_type, identifier_value, COUNT(*) "
            "FROM player_identifiers "
            "GROUP BY identifier_type, identifier_value "
            "HAVING COUNT(*) > 1"
        ).fetchall()
        if dup_ids:
            for d in dup_ids:
                errors.append(f"Duplicate identifier collision: {d[0]}={d[1]} (count={d[2]})")
    except sqlite3.OperationalError:
        errors.append("Table 'player_identifiers' does not exist")

    # 4. Check resolution log summary
    try:
        amb_count = conn.execute(
            "SELECT COUNT(*) FROM player_resolution_log WHERE resolution_status = 'REVIEW'"
        ).fetchone()[0]
        if amb_count > 0:
            warnings.append(
                f"{amb_count} player reference(s) flagged for REVIEW in player_resolution_log"
            )
    except sqlite3.OperationalError:
        pass

    # 5. Detect an un-migrated database (Phase 3 not applied). Phase 1 assigns
    #    integer player ids; canonical Phase 3 ids are slugs. A purely-numeric id
    #    means resolve_players.py has not been run against this database.
    numeric_ids = conn.execute(
        "SELECT COUNT(*) FROM players "
        "WHERE player_id GLOB '[0-9]*' AND NOT player_id GLOB '*[^0-9]*'"
    ).fetchone()[0]
    if numeric_ids > 0:
        errors.append(
            f"{numeric_ids} players still have numeric (Phase 1) ids — the Phase 3 identity "
            f"migration has NOT been applied. Run: python scripts/resolve_players.py"
        )
    if conn.execute("SELECT COUNT(*) FROM player_identifiers").fetchone()[0] == 0:
        warnings.append(
            "player_identifiers is empty — Cricsheet Register identifiers are not linked "
            "(has resolve_players.py been run?)"
        )

    # 6. Summary counts
    total_players = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    total_aliases = conn.execute("SELECT COUNT(*) FROM player_aliases").fetchone()[0]
    total_identifiers = conn.execute("SELECT COUNT(*) FROM player_identifiers").fetchone()[0]

    conn.close()

    print("\nMAIDEN PLAYER IDENTITY VALIDATION")
    print("=================================")
    print(f"Database: {db_path}")
    print(f"Canonical players: {total_players}")
    print(f"Total aliases: {total_aliases}")
    print(f"Total identifiers: {total_identifiers}")
    print(f"Foreign key violations: {len(fk_violations)}")
    print(f"Validation errors: {len(errors)}")
    print(f"Validation warnings: {len(warnings)}")

    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  [WARNING] {w}")

    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  [ERROR] {e}")
        print("\nSTATUS: FAIL")
        return 1

    print("\nSTATUS: PASS\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate player identity tables and constraints.")
    parser.add_argument("--db", type=Path, default=config.DB_PATH, help="Path to maiden.sqlite")
    args = parser.parse_args(argv)

    configure_logging()
    return validate_identity(args.db)


if __name__ == "__main__":
    raise SystemExit(main())
