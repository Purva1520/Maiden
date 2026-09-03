"""Data-quality checks executed against the built SQLite database.

Phase 1 focuses on *structural* integrity (referential soundness, sane values,
ordering) rather than deep cricket-law validation. Findings are returned as a
structured summary; the pipeline decides which are fatal.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field

from export.schema import TABLE_NAMES

# Tables that must be non-empty after a real (non-empty) import.
NON_EMPTY_TABLES = ("matches", "teams", "players", "innings", "overs", "deliveries")


@dataclass
class ValidationSummary:
    table_counts: dict[str, int] = field(default_factory=dict)
    fk_violations: list[tuple] = field(default_factory=list)
    empty_tables: list[str] = field(default_factory=list)
    formats_present: list[str] = field(default_factory=list)
    format_matches: dict[str, int] = field(default_factory=dict)
    negative_run_deliveries: int = 0
    bad_over_numbers: int = 0
    innings_ordering_issues: int = 0
    duplicate_matches: int = 0
    innings_team_not_in_match: int = 0
    deliveries_bowler_not_in_xi: int = 0
    deliveries_batter_not_in_xi: int = 0
    deliveries_non_striker_not_in_xi: int = 0
    date_range: dict[str, str | None] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def _scalar(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    row = conn.execute(sql, params).fetchone()
    return int(row[0]) if row and row[0] is not None else 0


def run_all_checks(conn: sqlite3.Connection) -> ValidationSummary:
    s = ValidationSummary()

    # Table counts
    for table in TABLE_NAMES:
        s.table_counts[table] = _scalar(conn, f"SELECT COUNT(*) FROM {table}")

    # Referential integrity (structural: every FK resolves)
    s.fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    if s.fk_violations:
        s.errors.append(f"{len(s.fk_violations)} foreign-key violation(s)")

    # Non-empty expectations
    for table in NON_EMPTY_TABLES:
        if s.table_counts.get(table, 0) == 0:
            s.empty_tables.append(table)
    if s.empty_tables:
        s.errors.append(f"unexpectedly empty tables: {', '.join(s.empty_tables)}")

    # Formats present
    rows = conn.execute(
        "SELECT format, COUNT(*) FROM matches GROUP BY format ORDER BY format"
    ).fetchall()
    s.format_matches = {r[0]: int(r[1]) for r in rows}
    s.formats_present = sorted(s.format_matches)

    # Value sanity
    s.negative_run_deliveries = _scalar(
        conn,
        "SELECT COUNT(*) FROM deliveries WHERE batter_runs < 0 OR extra_runs < 0 OR total_runs < 0",
    )
    if s.negative_run_deliveries:
        s.errors.append(f"{s.negative_run_deliveries} deliveries with negative runs")

    s.bad_over_numbers = _scalar(conn, "SELECT COUNT(*) FROM overs WHERE over_number < 0")
    if s.bad_over_numbers:
        s.errors.append(f"{s.bad_over_numbers} overs with negative over_number")

    # Innings ordering: numbers must run 1..n contiguously within a match
    s.innings_ordering_issues = _scalar(
        conn,
        """
        SELECT COUNT(*) FROM (
            SELECT match_id, MIN(innings_number) mn, MAX(innings_number) mx, COUNT(*) c
            FROM innings GROUP BY match_id
        ) WHERE mn <> 1 OR mx <> c
        """,
    )
    if s.innings_ordering_issues:
        s.errors.append(f"{s.innings_ordering_issues} matches with non-contiguous innings")

    # Duplicate match ids (PK should prevent; verify anyway)
    s.duplicate_matches = _scalar(
        conn,
        "SELECT COUNT(*) FROM (SELECT match_id FROM matches GROUP BY match_id HAVING COUNT(*) > 1)",
    )
    if s.duplicate_matches:
        s.errors.append(f"{s.duplicate_matches} duplicate match ids")

    # Every innings' batting team must be one of the match's two teams.
    s.innings_team_not_in_match = _scalar(
        conn,
        """
        SELECT COUNT(*) FROM innings i
        JOIN matches m ON i.match_id = m.match_id
        WHERE i.team_id NOT IN (m.team_1_id, m.team_2_id)
        """,
    )
    if s.innings_team_not_in_match:
        s.errors.append(f"{s.innings_team_not_in_match} innings whose team is not in the match")

    # Cricket sanity (warning-level): batter/bowler/non-striker listed in the XI.
    row = conn.execute(
        """
        SELECT
          SUM(CASE WHEN bmp.match_player_id  IS NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN btmp.match_player_id IS NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN nsmp.match_player_id IS NULL THEN 1 ELSE 0 END)
        FROM deliveries d
        JOIN overs o    ON d.over_id = o.over_id
        JOIN innings i  ON o.innings_id = i.innings_id
        LEFT JOIN match_players bmp
            ON bmp.match_id = i.match_id AND bmp.player_id = d.bowler_id
        LEFT JOIN match_players btmp
            ON btmp.match_id = i.match_id AND btmp.player_id = d.batter_id
        LEFT JOIN match_players nsmp
            ON nsmp.match_id = i.match_id AND nsmp.player_id = d.non_striker_id
        """
    ).fetchone()
    s.deliveries_bowler_not_in_xi = int(row[0] or 0)
    s.deliveries_batter_not_in_xi = int(row[1] or 0)
    s.deliveries_non_striker_not_in_xi = int(row[2] or 0)
    for label, n in (
        ("bowler", s.deliveries_bowler_not_in_xi),
        ("batter", s.deliveries_batter_not_in_xi),
        ("non-striker", s.deliveries_non_striker_not_in_xi),
    ):
        if n:
            s.warnings.append(f"{n} deliveries whose {label} is not in the listed XI")

    # Date range
    row = conn.execute("SELECT MIN(start_date), MAX(end_date) FROM matches").fetchone()
    s.date_range = {"min": row[0], "max": row[1]}

    return s
