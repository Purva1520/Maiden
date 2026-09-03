"""Top-level build orchestration: ingest -> parse -> normalize -> export -> validate.

Public entry point: :func:`build_database`. The build is transaction-safe — it
writes to a temporary database and only atomically replaces the known-good
``maiden.sqlite`` after validation succeeds, so a failed build never corrupts it.
"""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from cleaning.formats import CANONICAL_FORMATS  # noqa: F401  (re-export for callers/tests)
from core import config
from core.logging_setup import get_logger
from export.database import DatabaseWriter
from export.schema import apply_build_pragmas, create_indexes, create_schema
from ingest.archive import iter_raw_matches
from ingest.sources import archives_for
from parsers import ParseError, parse_match
from validation.checks import ValidationSummary, run_all_checks
from validation.report import IngestionReport

logger = get_logger(__name__)


def _resolve_sources(selection: str, raw_dir: Path) -> list[tuple[str, str, Path]]:
    """Return (format, filename, path) for the selected archives; error if missing."""
    sources: list[tuple[str, str, Path]] = []
    for spec in archives_for(selection):
        path = raw_dir / spec.filename
        if not path.exists():
            raise FileNotFoundError(
                f"Archive not found: {path}\n"
                f"Download it first:  python scripts/download_cricsheet.py"
            )
        sources.append((spec.format, spec.filename, path))
    return sources


def _write_metadata(conn: sqlite3.Connection, sources: list[tuple[str, str, Path]]) -> None:
    meta = {
        "pipeline_version": config.PIPELINE_VERSION,
        "schema_version": str(config.SCHEMA_VERSION),
        "source": config.SOURCE_NAME,
        "build_timestamp": datetime.now(UTC).isoformat(),
    }
    for fmt, filename, path in sources:
        meta[f"source_archive_{fmt}"] = filename
        try:
            stat = path.stat()
            meta[f"source_bytes_{fmt}"] = str(stat.st_size)
            meta[f"source_mtime_{fmt}"] = datetime.fromtimestamp(stat.st_mtime, UTC).isoformat()
        except OSError:
            pass
    conn.executemany(
        "INSERT OR REPLACE INTO pipeline_metadata (key, value) VALUES (?, ?)",
        list(meta.items()),
    )
    conn.commit()


def _populate_report(
    report: IngestionReport,
    summary: ValidationSummary,
    writer: DatabaseWriter,
) -> None:
    tc = summary.table_counts
    report.totals = {
        "matches": tc.get("matches", 0),
        "teams": tc.get("teams", 0),
        "players": tc.get("players", 0),
        "events": tc.get("events", 0),
        "innings": tc.get("innings", 0),
        "overs": tc.get("overs", 0),
        "deliveries": tc.get("deliveries", 0),
    }
    report.format_matches = dict(summary.format_matches)
    report.date_range = summary.date_range
    report.validation_errors = len(summary.errors)
    report.duplicate_matches = max(report.duplicate_matches, summary.duplicate_matches)
    report.unresolved_player_refs = len(writer.stats.unresolved_players)
    report.unresolved_team_refs = summary.innings_team_not_in_match

    for dup in writer.stats.duplicate_match_players:
        report.add(
            error_type="duplicate_match_player",
            message=f"{dup['name']} listed under multiple teams (kept first)",
            severity="WARNING",
            match_id=dup["match_id"],
        )

    for msg in summary.errors:
        report.add(error_type="validation", message=msg, severity="ERROR")
    for msg in summary.warnings:
        report.add(error_type="validation", message=msg, severity="WARNING")


def build_database(
    selection: str = "all",
    *,
    raw_dir: Path | None = None,
    db_path: Path | None = None,
    report_json: Path | None = None,
    report_txt: Path | None = None,
) -> IngestionReport:
    """Build the normalized SQLite database from Cricsheet archives.

    Rebuilds from scratch (idempotent). Returns the IngestionReport; report files
    are also written to disk.
    """
    raw_dir = raw_dir or config.RAW_DIR
    db_path = db_path or config.DB_PATH
    report_json = report_json or config.REPORT_JSON
    report_txt = report_txt or config.REPORT_TXT

    sources = _resolve_sources(selection, raw_dir)
    build_path = db_path.with_name("." + db_path.name + ".build")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if build_path.exists():
        build_path.unlink()

    report = IngestionReport(
        pipeline_version=config.PIPELINE_VERSION,
        schema_version=config.SCHEMA_VERSION,
        source=config.SOURCE_NAME,
    )

    conn = sqlite3.connect(build_path)
    try:
        apply_build_pragmas(conn)
        create_schema(conn)
        writer = DatabaseWriter(conn)

        seen: set[str] = set()
        for fmt, filename, path in sources:
            report.sources[fmt] = filename
            logger.info("Ingesting %s archive: %s", fmt, filename)
            for raw in iter_raw_matches(path):
                if raw.match_id in seen:
                    report.duplicate_matches += 1
                    report.add(
                        error_type="duplicate_match",
                        message=f"Duplicate match id {raw.match_id} (skipped)",
                        severity="WARNING",
                        source_file=raw.source_file,
                        match_id=raw.match_id,
                    )
                    continue
                try:
                    pm = parse_match(raw.match_id, raw.source_file, raw.data)
                except ParseError as exc:
                    report.record_parse_error(raw.source_file, raw.match_id, str(exc))
                    continue
                if pm.format != fmt:
                    report.add(
                        error_type="format_mismatch",
                        message=f"match_type {pm.match_type!r} -> {pm.format}, expected {fmt}",
                        severity="WARNING",
                        source_file=raw.source_file,
                        match_id=raw.match_id,
                    )
                seen.add(raw.match_id)
                writer.add_match(pm)
            logger.info("  parsed %d matches so far", writer.stats.matches)

        writer.flush()
        logger.info("Creating indexes")
        create_indexes(conn)
        _write_metadata(conn, sources)

        logger.info("Running validation")
        summary = run_all_checks(conn)
        _populate_report(report, summary, writer)

        required_formats = {fmt for fmt, _, _ in sources}
        present = set(summary.format_matches)
        formats_ok = required_formats.issubset(present)
        if not formats_ok:
            missing = required_formats - present
            report.add(
                error_type="validation",
                message=f"missing expected formats: {', '.join(sorted(missing))}",
                severity="ERROR",
            )

        success = summary.ok and formats_ok and report.totals["matches"] > 0
        report.status = "success" if success else "failed"
    finally:
        conn.close()

    if report.status == "success":
        import os

        os.replace(build_path, db_path)
        logger.info("Database written: %s", db_path)
    else:
        logger.error("Build FAILED — known-good database left untouched. See report.")

    report.write(report_json, report_txt)
    logger.info("Report written: %s", report_json)
    return report
