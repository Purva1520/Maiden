"""Validation-layer tests: valid data passes; corruptions are detected."""

from __future__ import annotations

import sqlite3

from export.database import DatabaseWriter
from export.schema import apply_build_pragmas, create_indexes, create_schema
from parsers import parse_match
from validation.checks import run_all_checks


def _db(*matches) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    apply_build_pragmas(conn)
    create_schema(conn)
    writer = DatabaseWriter(conn)
    for mid, data in matches:
        writer.add_match(parse_match(mid, f"{mid}.json", data))
    writer.flush()
    create_indexes(conn)
    return conn


def test_valid_match_passes(odi_json, t20_json):
    conn = _db(("odi1", odi_json), ("t20a", t20_json))
    summary = run_all_checks(conn)
    assert summary.ok
    assert summary.errors == []
    assert summary.format_matches == {"ODI": 1, "T20": 1}
    assert summary.fk_violations == []


def test_missing_player_reference_detected(odi_json):
    conn = _db(("odi1", odi_json))
    # FK enforcement is off during load, so this bad row inserts; the check catches it.
    conn.execute("UPDATE deliveries SET bowler_id = 999999 WHERE delivery_id = 1")
    summary = run_all_checks(conn)
    assert not summary.ok
    assert summary.fk_violations  # foreign_key_check reports the dangling reference


def test_negative_run_value_detected(odi_json):
    conn = _db(("odi1", odi_json))
    conn.execute("UPDATE deliveries SET batter_runs = -1 WHERE delivery_id = 1")
    summary = run_all_checks(conn)
    assert not summary.ok
    assert summary.negative_run_deliveries >= 1


def test_innings_ordering_issue_detected(odi_json):
    conn = _db(("odi1", odi_json))
    # Break contiguity: renumber an innings to 5.
    conn.execute("UPDATE innings SET innings_number = 5 WHERE innings_number = 2")
    summary = run_all_checks(conn)
    assert not summary.ok
    assert summary.innings_ordering_issues >= 1
