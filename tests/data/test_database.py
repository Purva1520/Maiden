"""Database tests: schema creation, insertion, foreign keys, duplicate protection."""

from __future__ import annotations

import sqlite3

import pytest
from export.database import DatabaseWriter
from export.schema import apply_build_pragmas, create_indexes, create_schema
from parsers import parse_match


def _build_memory_db(*matches) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    apply_build_pragmas(conn)
    create_schema(conn)
    writer = DatabaseWriter(conn)
    for mid, data in matches:
        writer.add_match(parse_match(mid, f"{mid}.json", data))
    writer.flush()
    create_indexes(conn)
    return conn


def test_schema_and_insertion(odi_json, t20_json):
    conn = _build_memory_db(("odi1", odi_json), ("t20a", t20_json))
    assert conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM deliveries").fetchone()[0] == 7
    formats = dict(conn.execute("SELECT format, COUNT(*) FROM matches GROUP BY format").fetchall())
    assert formats == {"ODI": 1, "T20": 1}


def test_foreign_keys_hold(odi_json):
    conn = _build_memory_db(("odi1", odi_json))
    conn.execute("PRAGMA foreign_keys = ON")
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_foreign_key_enforced_on_bad_insert(odi_json):
    conn = _build_memory_db(("odi1", odi_json))
    conn.execute("PRAGMA foreign_keys = ON")
    # innings referencing a non-existent match should be rejected.
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO innings (innings_id, match_id, innings_number, team_id) "
            "VALUES (99999, 'no-such-match', 1, 1)"
        )


def test_duplicate_match_id_rejected(odi_json):
    conn = _build_memory_db(("odi1", odi_json))
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO matches (match_id, source, source_file, format, team_1_id, team_2_id) "
            "VALUES ('odi1', 'cricsheet', 'x.json', 'ODI', 1, 2)"
        )


def test_query_join(odi_json):
    conn = _build_memory_db(("odi1", odi_json))
    row = conn.execute(
        """
        SELECT t1.display_name, t2.display_name, m.result_text
        FROM matches m
        JOIN teams t1 ON m.team_1_id = t1.team_id
        JOIN teams t2 ON m.team_2_id = t2.team_id
        WHERE m.match_id = 'odi1'
        """
    ).fetchone()
    assert row == ("Alpha", "Beta", "Alpha won by 10 runs")


def test_extras_and_wickets_tables(odi_json):
    conn = _build_memory_db(("odi1", odi_json))
    assert conn.execute("SELECT COUNT(*) FROM delivery_extras").fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM delivery_wickets").fetchone()[0] == 1
    kind = conn.execute("SELECT dismissal_kind FROM delivery_wickets").fetchone()[0]
    assert kind == "caught"
