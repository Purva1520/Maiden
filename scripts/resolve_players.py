#!/usr/bin/env python3
"""Resolve player identities and migrate the Maiden database to Phase 3.

Usage:
    python scripts/resolve_players.py --dry-run
    python scripts/resolve_players.py
    python scripts/resolve_players.py --db custom_maiden.db
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from cleaning.names import normalize_name_for_matching
from cleaning.teams import get_canonical_team_aliases
from core import config
from core.logging_setup import configure_logging, get_logger
from export.schema import create_indexes, create_schema
from ingest.register import load_register
from normalization.identity import PlayerIdentityResolver

logger = get_logger("resolve_players")


def run_resolution(
    db_path: Path,
    *,
    dry_run: bool = False,
    report_json_path: Path | None = None,
    report_txt_path: Path | None = None,
    review_json_path: Path | None = None,
) -> int:
    """Perform player identity resolution across the database."""
    if not db_path.exists():
        logger.error("Database not found: %s", db_path)
        return 1

    report_json = report_json_path or (config.PROCESSED_DIR / "player_identity_report.json")
    report_txt = report_txt_path or (config.PROCESSED_DIR / "player_identity_report.txt")
    review_json = review_json_path or (config.PROCESSED_DIR / "player_identity_review.json")

    logger.info("Initializing Cricsheet Register and Player Identity Resolver...")
    register = load_register()
    resolver = PlayerIdentityResolver(register=register)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # --- 1. Extract all existing player records from the database ---
    logger.info("Extracting existing players and references from %s", db_path)
    existing_players = conn.execute("SELECT * FROM players").fetchall()

    # Map old player_id (int or str) -> new canonical player_id
    id_migration_map: dict[str, str] = {}

    # Also collect context for players from tournament_squads and matches
    player_contexts: dict[str, dict] = {}
    try:
        squad_rows = conn.execute(
            "SELECT ts.player_id, ts.tournament_id, ts.original_player_name, t.year, t.format, tt.team_name "
            "FROM tournament_squads ts "
            "JOIN tournaments t ON ts.tournament_id = t.tournament_id "
            "JOIN tournament_teams tt ON ts.tournament_id = tt.tournament_id AND ts.team_id = tt.team_id"
        ).fetchall()
        for r in squad_rows:
            pid = str(r["player_id"])
            if pid not in player_contexts:
                player_contexts[pid] = {
                    "team": r["team_name"],
                    "year": r["year"],
                    "format": r["format"],
                    "raw_name": r["original_player_name"],
                }
    except sqlite3.OperationalError:
        pass

    logger.info("Resolving identities for %d existing player records...", len(existing_players))
    for p in existing_players:
        old_pid = str(p["player_id"])
        raw_name = p["canonical_name"]
        reg_id = p["registry_id"] if "registry_id" in p.keys() else None
        if not reg_id and "cricsheet_id" in p.keys():
            reg_id = p["cricsheet_id"]

        ctx = player_contexts.get(old_pid, {})
        team = ctx.get("team")
        year = ctx.get("year")
        fmt = ctx.get("format")

        res = resolver.resolve(
            raw_name,
            cricsheet_id=reg_id,
            team=team,
            year=year,
            format=fmt,
            source="curated" if ctx else "cricsheet",
        )

        if res.player:
            id_migration_map[old_pid] = res.player.player_id
        else:
            # If ambiguous or unresolved, record mapping to a temporary slug so FKs don't break,
            # but it is tracked in review queue!
            slug = f"unresolved_{old_pid}"
            id_migration_map[old_pid] = slug

    # Generate reports
    rep_dict = resolver.generate_report_dict()
    rep_text = resolver.render_report_text()

    print("\n" + rep_text + "\n")

    if dry_run:
        logger.info("[DRY RUN] No changes were written to %s", db_path)
        logger.info("Review queue items: %d", len(resolver.review_queue))
        conn.close()
        return 0

    # --- 2. Live Migration: Build into a temporary database, verify FKs, swap atomically ---
    logger.info("Performing live migration...")
    tmp_db_path = db_path.with_suffix(".tmp.sqlite")
    if tmp_db_path.exists():
        tmp_db_path.unlink()

    # Create schema in temporary DB
    new_conn = sqlite3.connect(tmp_db_path)
    create_schema(new_conn)

    # Copy metadata, teams, events, matches, match_dates, innings, overs, delivery_extras, tournaments, tournament_teams
    logger.info("Migrating canonical tables...")
    for tbl in ("pipeline_metadata", "teams", "events", "tournaments", "tournament_teams"):
        try:
            rows = conn.execute(f"SELECT * FROM {tbl}").fetchall()
            if rows:
                cols = rows[0].keys()
                placeholders = ", ".join("?" for _ in cols)
                col_names = ", ".join(cols)
                new_conn.executemany(
                    f"INSERT INTO {tbl} ({col_names}) VALUES ({placeholders})",
                    [tuple(r[c] for c in cols) for r in rows],
                )
        except sqlite3.OperationalError:
            pass

    # Insert team_aliases
    for alias, canon in get_canonical_team_aliases().items():
        row = new_conn.execute("SELECT team_id FROM teams WHERE LOWER(canonical_name) = LOWER(?)", (canon,)).fetchone()
        if row:
            new_conn.execute(
                "INSERT INTO team_aliases (team_id, alias, normalized_alias, source) VALUES (?, ?, ?, ?)",
                (row[0], alias, alias.lower(), "canonical_alias"),
            )

    # Insert tournament_aliases
    try:
        t_rows = new_conn.execute("SELECT tournament_id, display_name FROM tournaments").fetchall()
        for t_id, d_name in t_rows:
            new_conn.execute(
                "INSERT INTO tournament_aliases (tournament_id, alias, normalized_alias, source) VALUES (?, ?, ?, ?)",
                (t_id, d_name, d_name.lower(), "display_name"),
            )
    except sqlite3.OperationalError:
        pass

    # Insert canonical players from resolver
    logger.info("Inserting %d canonical players...", len(resolver.players_by_id))
    players_batch = []
    aliases_batch = []
    identifiers_batch = []
    for p in resolver.players_by_id.values():
        players_batch.append((p.player_id, p.canonical_name, p.display_name, p.cricsheet_id, p.country_id, p.active_from, p.active_to))
        for alias in p.aliases:
            norm_alias = normalize_name_for_matching(alias)
            if norm_alias:
                aliases_batch.append((p.player_id, alias, norm_alias, p.provenance_source, p.provenance_ref))
        for id_type, id_val in p.identifiers.items():
            identifiers_batch.append((p.player_id, id_type, id_val, p.provenance_source, p.provenance_ref))

    with new_conn:
        new_conn.executemany(
            "INSERT INTO players (player_id, canonical_name, display_name, cricsheet_id, country_id, active_from, active_to) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            players_batch,
        )
        new_conn.executemany(
            "INSERT INTO player_aliases (player_id, alias, normalized_alias, source, source_reference) "
            "VALUES (?, ?, ?, ?, ?)",
            aliases_batch,
        )
        new_conn.executemany(
            "INSERT OR IGNORE INTO player_identifiers (player_id, identifier_type, identifier_value, source, source_reference) "
            "VALUES (?, ?, ?, ?, ?)",
            identifiers_batch,
        )

        # Insert resolution audit log
        audit_batch = [
            (
                r.source,
                r.raw_name,
                r.normalized_name,
                r.candidate_player_id,
                r.resolution_method,
                r.resolution_status,
                r.confidence,
                r.reason,
                1 if r.reviewed else 0,
            )
            for r in resolver.resolution_log
        ]
        new_conn.executemany(
            "INSERT INTO player_resolution_log "
            "(source, raw_name, normalized_name, candidate_player_id, resolution_method, resolution_status, confidence, reason, reviewed) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            audit_batch,
        )

    # Migrate tournament_squads with new player_id
    try:
        squad_rows = conn.execute("SELECT * FROM tournament_squads").fetchall()
        logger.info("Migrating %d tournament_squads records...", len(squad_rows))
        squads_batch = []
        for r in squad_rows:
            old_pid = str(r["player_id"])
            new_pid = id_migration_map.get(old_pid, old_pid)
            squads_batch.append((
                r["tournament_id"],
                r["team_id"],
                new_pid,
                r["role"],
                r["wicketkeeper"],
                r["participated"],
                r["squad_order"],
                r["source"],
                r["source_reference"],
                r["source_notes"],
                r["original_player_name"],
                r["original_team_name"],
            ))
        with new_conn:
            new_conn.executemany(
                "INSERT INTO tournament_squads "
                "(tournament_id, team_id, player_id, role, wicketkeeper, participated, "
                "squad_order, source, source_reference, source_notes, original_player_name, original_team_name) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                squads_batch,
            )
    except sqlite3.OperationalError:
        pass

    # Migrate matches & ball-by-ball tables if present
    for tbl in ("matches", "match_dates", "match_players", "match_officials", "innings", "overs", "deliveries", "delivery_extras", "delivery_wickets", "wicket_fielders"):
        try:
            rows = conn.execute(f"SELECT * FROM {tbl}").fetchall()
            if not rows:
                continue
            cols = rows[0].keys()
            table_batch = []
            for r in rows:
                r_dict = dict(r)
                # Map player_id fields if present
                if tbl == "matches" and r_dict.get("player_of_match_id"):
                    r_dict["player_of_match_id"] = id_migration_map.get(str(r_dict["player_of_match_id"]), r_dict["player_of_match_id"])
                elif tbl == "match_players" and r_dict.get("player_id"):
                    r_dict["player_id"] = id_migration_map.get(str(r_dict["player_id"]), r_dict["player_id"])
                elif tbl == "deliveries":
                    for f in ("batter_id", "non_striker_id", "bowler_id"):
                        if r_dict.get(f):
                            r_dict[f] = id_migration_map.get(str(r_dict[f]), r_dict[f])
                elif tbl == "delivery_wickets" and r_dict.get("player_out_id"):
                    r_dict["player_out_id"] = id_migration_map.get(str(r_dict["player_out_id"]), r_dict["player_out_id"])
                elif tbl == "wicket_fielders" and r_dict.get("fielder_id"):
                    r_dict["fielder_id"] = id_migration_map.get(str(r_dict["fielder_id"]), r_dict["fielder_id"])

                table_batch.append(tuple(r_dict[c] for c in cols))

            placeholders = ", ".join("?" for _ in cols)
            col_names = ", ".join(cols)
            with new_conn:
                new_conn.executemany(
                    f"INSERT INTO {tbl} ({col_names}) VALUES ({placeholders})",
                    table_batch,
                )
        except sqlite3.OperationalError:
            pass

    # Build indexes
    create_indexes(new_conn)

    # Check foreign keys
    new_conn.execute("PRAGMA foreign_keys = ON")
    violations = new_conn.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        logger.error("Foreign key violations in migrated database: %s", violations)
        new_conn.close()
        tmp_db_path.unlink()
        return 1

    new_conn.commit()
    new_conn.close()
    conn.close()

    # Backup original DB
    bak_path = db_path.with_suffix(".bak")
    shutil.copy2(db_path, bak_path)
    logger.info("Backup created at %s", bak_path)

    # Replace DB atomically
    shutil.move(str(tmp_db_path), str(db_path))
    logger.info("Database migrated and updated at %s", db_path)

    # Write reports
    report_json.parent.mkdir(parents=True, exist_ok=True)
    report_json.write_text(json.dumps(rep_dict, indent=2) + "\n", encoding="utf-8")
    report_txt.write_text(rep_text + "\n", encoding="utf-8")
    review_json.write_text(json.dumps(resolver.review_queue, indent=2) + "\n", encoding="utf-8")

    logger.info("Report written: %s", report_json)
    logger.info("Review queue written: %s (%d items)", review_json, len(resolver.review_queue))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Resolve player identities and migrate database.")
    parser.add_argument("--dry-run", action="store_true", help="Simulate resolution without modifying DB")
    parser.add_argument("--db", type=Path, default=config.DB_PATH, help="Path to maiden.sqlite")
    parser.add_argument("--output-report", type=Path, help="Path to write report JSON")
    parser.add_argument("--output-review", type=Path, help="Path to write review JSON")
    args = parser.parse_args(argv)

    configure_logging()
    return run_resolution(
        args.db,
        dry_run=args.dry_run,
        report_json_path=args.output_report,
        review_json_path=args.output_review,
    )


if __name__ == "__main__":
    raise SystemExit(main())
