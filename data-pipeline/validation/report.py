"""Ingestion report: structured error collection plus human- and machine-readable
output.

Severity levels: INFO, WARNING, ERROR, FATAL. Recoverable, match-level problems
are recorded and the build continues; FATAL problems (schema/database failures)
abort the build.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

SEVERITIES = ("INFO", "WARNING", "ERROR", "FATAL")


@dataclass
class ReportEntry:
    source_file: str | None
    match_id: str | None
    error_type: str
    message: str
    severity: str


@dataclass
class IngestionReport:
    status: str = "pending"  # success | failed | pending
    pipeline_version: str = ""
    schema_version: int = 0
    source: str = "cricsheet"
    build_timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    sources: dict[str, str] = field(default_factory=dict)  # format -> archive filename

    # per-format match counts
    format_matches: dict[str, int] = field(default_factory=dict)

    # entity totals (filled from the DB after load)
    totals: dict[str, int] = field(default_factory=dict)

    date_range: dict[str, str | None] = field(default_factory=dict)

    parse_errors: int = 0
    malformed_matches: int = 0
    validation_errors: int = 0
    duplicate_matches: int = 0
    unresolved_player_refs: int = 0
    unresolved_team_refs: int = 0

    entries: list[ReportEntry] = field(default_factory=list)

    # -- collection ----------------------------------------------------------
    def add(
        self,
        *,
        error_type: str,
        message: str,
        severity: str = "ERROR",
        source_file: str | None = None,
        match_id: str | None = None,
    ) -> None:
        assert severity in SEVERITIES, severity
        self.entries.append(
            ReportEntry(
                source_file=source_file,
                match_id=match_id,
                error_type=error_type,
                message=message,
                severity=severity,
            )
        )

    def record_parse_error(self, source_file: str, match_id: str, message: str) -> None:
        self.parse_errors += 1
        self.malformed_matches += 1
        self.add(
            error_type="parse_error",
            message=message,
            severity="ERROR",
            source_file=source_file,
            match_id=match_id,
        )

    # -- serialization -------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "pipeline_version": self.pipeline_version,
            "schema_version": self.schema_version,
            "source": self.source,
            "build_timestamp": self.build_timestamp,
            "sources": self.sources,
            "formats": {fmt: {"matches": n} for fmt, n in self.format_matches.items()},
            "players": self.totals.get("players", 0),
            "teams": self.totals.get("teams", 0),
            "events": self.totals.get("events", 0),
            "innings": self.totals.get("innings", 0),
            "overs": self.totals.get("overs", 0),
            "deliveries": self.totals.get("deliveries", 0),
            "matches": self.totals.get("matches", 0),
            "date_range": self.date_range,
            "parse_errors": self.parse_errors,
            "malformed_matches": self.malformed_matches,
            "validation_errors": self.validation_errors,
            "duplicate_matches": self.duplicate_matches,
            "unresolved_player_references": self.unresolved_player_refs,
            "unresolved_team_references": self.unresolved_team_refs,
            "entries": [asdict(e) for e in self.entries],
        }

    def render_text(self) -> str:
        t = self.totals
        lines = [
            "MAIDEN CRICSHEET INGESTION REPORT",
            "=================================",
            "",
            "Source:",
        ]
        for fmt, fname in self.sources.items():
            lines.append(f"  {fmt} archive: {fname}")
        lines.append("")
        for fmt in sorted(self.format_matches):
            lines.append(f"{fmt} matches parsed: {self.format_matches[fmt]}")
        lines += [
            "",
            f"Total matches: {t.get('matches', 0)}",
            f"Total teams: {t.get('teams', 0)}",
            f"Total players: {t.get('players', 0)}",
            f"Total events: {t.get('events', 0)}",
            "",
            f"Total innings: {t.get('innings', 0)}",
            f"Total overs: {t.get('overs', 0)}",
            f"Total deliveries: {t.get('deliveries', 0)}",
            "",
            f"Date range: {self.date_range.get('min')} .. {self.date_range.get('max')}",
            "",
            f"Parse errors: {self.parse_errors}",
            f"Malformed matches: {self.malformed_matches}",
            f"Validation errors: {self.validation_errors}",
            f"Duplicate matches: {self.duplicate_matches}",
            f"Unresolved player references: {self.unresolved_player_refs}",
            f"Unresolved team references: {self.unresolved_team_refs}",
            "",
            "Database:",
            "  data/processed/maiden.sqlite",
            "",
            "Build status:",
            f"  {self.status.upper()}",
        ]
        return "\n".join(lines)

    def write(self, json_path: Path, txt_path: Path) -> None:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(self.to_dict(), indent=2) + "\n", encoding="utf-8")
        txt_path.write_text(self.render_text() + "\n", encoding="utf-8")
