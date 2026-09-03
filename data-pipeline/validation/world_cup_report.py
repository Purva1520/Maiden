"""World Cup database validation report.

Generates the structured report (JSON + human-readable text) documenting
the state of the Phase 2 World Cup database: tournament counts, team/squad
totals, source breakdown, role distribution, and validation status.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from core import config
from core.logging_setup import get_logger

logger = get_logger(__name__)


@dataclass
class WorldCupReport:
    """Structured Phase 2 validation report."""

    status: str = "pending"
    build_timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    # Tournament counts
    odi_tournaments: int = 0
    t20_tournaments: int = 0
    total_tournaments: int = 0

    # Team counts
    total_tournament_teams: int = 0

    # Squad counts
    total_squad_records: int = 0
    participated_true: int = 0
    participated_false: int = 0

    # Source breakdown
    source_cricsheet: int = 0
    source_wikipedia: int = 0
    source_manual: int = 0

    # Role breakdown
    role_bat: int = 0
    role_bowl: int = 0
    role_allrounder: int = 0
    role_wk: int = 0

    # Wicketkeeper counts
    wicketkeeper_true: int = 0

    # Per-tournament detail
    tournament_details: list[dict] = field(default_factory=list)

    # Validation results
    duplicate_squad_records: int = 0
    unknown_tournaments: int = 0
    unknown_teams: int = 0
    unknown_players: int = 0
    invalid_roles: int = 0
    wk_inconsistencies: int = 0
    fk_violations: int = 0

    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    # -- rendering -----------------------------------------------------------
    def to_dict(self) -> dict:
        return asdict(self)

    def render_text(self) -> str:
        lines = [
            "MAIDEN WORLD CUP DATABASE REPORT",
            "=================================",
            "",
            "Tournaments",
            "-----------",
            f"ODI: {self.odi_tournaments}",
            f"T20: {self.t20_tournaments}",
            f"Total: {self.total_tournaments}",
            "",
            "Teams",
            "-----",
            f"Total tournament-team entries: {self.total_tournament_teams}",
            "",
            "Squads",
            "------",
            f"Total squad records: {self.total_squad_records}",
            f"Participated: {self.participated_true}",
            f"Did not participate: {self.participated_false}",
            "",
            "Sources",
            "-------",
            f"Cricsheet: {self.source_cricsheet}",
            f"Wikipedia: {self.source_wikipedia}",
            f"Manual: {self.source_manual}",
            "",
            "Roles",
            "-----",
            f"BAT: {self.role_bat}",
            f"BOWL: {self.role_bowl}",
            f"ALLROUNDER: {self.role_allrounder}",
            f"WK: {self.role_wk}",
            "",
            "Wicketkeepers",
            "-------------",
            f"Total wicketkeeper=true: {self.wicketkeeper_true}",
            "",
        ]

        # Per-tournament detail table
        lines.append("Per-Tournament Coverage")
        lines.append("-" * 60)
        lines.append(f"{'Format':<6} {'Year':<6} {'Teams':<6} {'Squad':<8} {'Source Mix'}")
        lines.append("-" * 60)
        for d in self.tournament_details:
            lines.append(
                f"{d['format']:<6} {d['year']:<6} {d['teams']:<6} "
                f"{d['squads']:<8} {d['source_mix']}"
            )
        lines.append("")

        # Validation
        lines += [
            "Validation",
            "----------",
            f"Duplicate squad records: {self.duplicate_squad_records}",
            f"Unknown tournaments: {self.unknown_tournaments}",
            f"Unknown teams: {self.unknown_teams}",
            f"Unknown players: {self.unknown_players}",
            f"Invalid roles: {self.invalid_roles}",
            f"WK inconsistencies: {self.wk_inconsistencies}",
            f"FK violations: {self.fk_violations}",
            "",
        ]

        if self.warnings:
            lines.append("Warnings:")
            for w in self.warnings:
                lines.append(f"  [WARNING] {w}")
            lines.append("")

        if self.errors:
            lines.append("Errors:")
            for e in self.errors:
                lines.append(f"  [ERROR] {e}")
            lines.append("")

        lines.append(f"STATUS: {self.status}")
        return "\n".join(lines)

    def write(self, json_path: Path, txt_path: Path) -> None:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(self.to_dict(), indent=2) + "\n", encoding="utf-8")
        txt_path.write_text(self.render_text() + "\n", encoding="utf-8")


def generate_world_cup_report(conn: sqlite3.Connection) -> WorldCupReport:
    """Run all Phase 2 validation checks and produce the report."""
    report = WorldCupReport()

    def scalar(sql: str, params: tuple = ()) -> int:
        row = conn.execute(sql, params).fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    # --- Tournament counts ---
    report.odi_tournaments = scalar(
        "SELECT COUNT(*) FROM tournaments WHERE format = 'ODI'"
    )
    report.t20_tournaments = scalar(
        "SELECT COUNT(*) FROM tournaments WHERE format = 'T20'"
    )
    report.total_tournaments = scalar("SELECT COUNT(*) FROM tournaments")

    if report.odi_tournaments != 13:
        report.errors.append(f"Expected 13 ODI tournaments, got {report.odi_tournaments}")
    if report.t20_tournaments != 9:
        report.errors.append(f"Expected 9 T20 tournaments, got {report.t20_tournaments}")
    if report.total_tournaments != 22:
        report.errors.append(f"Expected 22 tournaments, got {report.total_tournaments}")

    # --- Team counts ---
    report.total_tournament_teams = scalar("SELECT COUNT(*) FROM tournament_teams")

    # --- Squad counts ---
    report.total_squad_records = scalar("SELECT COUNT(*) FROM tournament_squads")
    report.participated_true = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE participated = 1"
    )
    report.participated_false = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE participated = 0"
    )

    # --- Source breakdown ---
    report.source_cricsheet = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE source = 'cricsheet'"
    )
    report.source_wikipedia = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE source = 'wikipedia'"
    )
    report.source_manual = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE source = 'manual'"
    )

    # --- Role breakdown ---
    report.role_bat = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE role = 'BAT'"
    )
    report.role_bowl = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE role = 'BOWL'"
    )
    report.role_allrounder = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE role = 'ALLROUNDER'"
    )
    report.role_wk = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE role = 'WK'"
    )
    report.wicketkeeper_true = scalar(
        "SELECT COUNT(*) FROM tournament_squads WHERE wicketkeeper = 1"
    )

    # --- Per-tournament detail ---
    tournaments = conn.execute(
        "SELECT tournament_id, year, format FROM tournaments ORDER BY format, year"
    ).fetchall()
    for t in tournaments:
        tid = t[0]
        teams = scalar("SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = ?", (tid,))
        squads = scalar("SELECT COUNT(*) FROM tournament_squads WHERE tournament_id = ?", (tid,))
        # Source mix
        sources = conn.execute(
            "SELECT source, COUNT(*) FROM tournament_squads "
            "WHERE tournament_id = ? GROUP BY source ORDER BY source",
            (tid,),
        ).fetchall()
        source_mix = "/".join(f"{s[0]}({s[1]})" for s in sources) if sources else "none"
        report.tournament_details.append({
            "tournament_id": tid,
            "format": t[2],
            "year": t[1],
            "teams": teams,
            "squads": squads,
            "source_mix": source_mix,
        })

    # --- Validation checks ---
    # Duplicate squad records (PK should prevent, but verify)
    report.duplicate_squad_records = scalar(
        "SELECT COUNT(*) FROM ("
        "  SELECT tournament_id, team_id, player_id "
        "  FROM tournament_squads "
        "  GROUP BY tournament_id, team_id, player_id "
        "  HAVING COUNT(*) > 1"
        ")"
    )
    if report.duplicate_squad_records:
        report.errors.append(f"{report.duplicate_squad_records} duplicate squad records")

    # Invalid roles
    report.invalid_roles = scalar(
        "SELECT COUNT(*) FROM tournament_squads "
        "WHERE role NOT IN ('BAT', 'BOWL', 'ALLROUNDER', 'WK')"
    )
    if report.invalid_roles:
        report.errors.append(f"{report.invalid_roles} squad records with invalid roles")

    # WK consistency: role=WK should have wicketkeeper=1
    report.wk_inconsistencies = scalar(
        "SELECT COUNT(*) FROM tournament_squads "
        "WHERE (role = 'WK' AND wicketkeeper = 0) "
        "   OR (wicketkeeper = 1 AND role != 'WK')"
    )
    if report.wk_inconsistencies:
        report.warnings.append(
            f"{report.wk_inconsistencies} WK/wicketkeeper inconsistencies"
        )

    # FK checks: tournament_teams.tournament_id -> tournaments
    report.unknown_tournaments = scalar(
        "SELECT COUNT(*) FROM tournament_teams tt "
        "WHERE NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.tournament_id = tt.tournament_id)"
    )
    if report.unknown_tournaments:
        report.errors.append(f"{report.unknown_tournaments} team entries reference unknown tournaments")

    # FK checks: tournament_squads.team_id -> tournament_teams
    report.unknown_teams = scalar(
        "SELECT COUNT(*) FROM tournament_squads ts "
        "WHERE NOT EXISTS ("
        "  SELECT 1 FROM tournament_teams tt "
        "  WHERE tt.tournament_id = ts.tournament_id AND tt.team_id = ts.team_id"
        ")"
    )
    if report.unknown_teams:
        report.errors.append(f"{report.unknown_teams} squad records reference unknown teams")

    # FK checks: tournament_squads.player_id -> players
    report.unknown_players = scalar(
        "SELECT COUNT(*) FROM tournament_squads ts "
        "WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.player_id = ts.player_id)"
    )
    if report.unknown_players:
        report.errors.append(f"{report.unknown_players} squad records reference unknown players")

    # PRAGMA foreign_key_check (covers all FKs)
    fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    # Filter to Phase 2 tables only
    phase2_violations = [v for v in fk_violations if v[0] in (
        "tournaments", "tournament_teams", "tournament_squads"
    )]
    report.fk_violations = len(phase2_violations)
    if report.fk_violations:
        report.errors.append(f"{report.fk_violations} foreign key violations in Phase 2 tables")

    # --- Status ---
    report.status = "PASS" if not report.errors else "FAIL"
    return report
