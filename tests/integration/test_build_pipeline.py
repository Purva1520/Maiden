"""End-to-end pipeline integration test on tiny temporary archives.

Exercises ZIP reading, parsing, malformed-match handling, SQLite build, foreign
keys, report generation and idempotency — without touching the real dataset.
"""

from __future__ import annotations

import json
import sqlite3
import zipfile
from pathlib import Path

import pytest

from core.pipeline import build_database

FIXTURES = Path(__file__).resolve().parents[1] / "data" / "cricsheet"


def _make_zip(path: Path, entries: dict[str, bytes]) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in entries.items():
            zf.writestr(name, content)


@pytest.fixture
def raw_dir(tmp_path: Path) -> Path:
    raw = tmp_path / "raw"
    raw.mkdir()
    odi = (FIXTURES / "sample_odi.json").read_bytes()
    t20 = (FIXTURES / "sample_t20.json").read_bytes()

    # Semantically malformed (3 teams) and syntactically broken JSON.
    bad_semantic = json.dumps(
        {"info": {"match_type": "ODI", "teams": ["A", "B", "C"]}, "innings": []}
    ).encode()
    bad_syntax = b"{ this is not valid json"

    _make_zip(
        raw / "odis_male_json.zip",
        {"100.json": odi, "101.json": bad_semantic, "102.json": bad_syntax},
    )
    _make_zip(raw / "t20s_male_json.zip", {"200.json": t20})
    return raw


def _run(tmp_path: Path, raw_dir: Path):
    return build_database(
        "all",
        raw_dir=raw_dir,
        db_path=tmp_path / "maiden.sqlite",
        report_json=tmp_path / "ingestion_report.json",
        report_txt=tmp_path / "ingestion_report.txt",
    )


def test_build_succeeds_with_malformed_handling(tmp_path: Path, raw_dir: Path):
    report = _run(tmp_path, raw_dir)

    assert report.status == "success"
    assert report.totals["matches"] == 2
    assert report.format_matches == {"ODI": 1, "T20": 1}
    # Two malformed matches were recorded but did not abort the build.
    assert report.parse_errors == 2
    assert report.malformed_matches == 2

    db_path = tmp_path / "maiden.sqlite"
    assert db_path.exists()
    assert (tmp_path / "ingestion_report.json").exists()
    assert (tmp_path / "ingestion_report.txt").exists()


def test_built_database_is_referentially_sound(tmp_path: Path, raw_dir: Path):
    _run(tmp_path, raw_dir)
    conn = sqlite3.connect(tmp_path / "maiden.sqlite")
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        assert conn.execute("SELECT COUNT(*) FROM deliveries").fetchone()[0] == 7
        assert conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 2
        # pipeline metadata recorded for reproducibility
        keys = {r[0] for r in conn.execute("SELECT key FROM pipeline_metadata")}
        assert {"pipeline_version", "schema_version", "source"} <= keys
    finally:
        conn.close()


def test_build_is_idempotent(tmp_path: Path, raw_dir: Path):
    first = _run(tmp_path, raw_dir)
    second = _run(tmp_path, raw_dir)
    assert first.totals == second.totals
    conn = sqlite3.connect(tmp_path / "maiden.sqlite")
    try:
        assert conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 2
        assert conn.execute("SELECT COUNT(*) FROM deliveries").fetchone()[0] == 7
    finally:
        conn.close()
