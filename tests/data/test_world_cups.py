"""Tests for Phase 2: Historical World Cup database.

Tests cover:
  - Curated data validation (errors, warnings, edge cases)
  - Database schema & builder (foreign keys, players, teams, squads)
  - Query API (getSquad, get_tournament, get_tournament_teams, list_tournaments)
  - Report generation (integrity checks, summary stats)
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from export.schema import apply_build_pragmas, create_indexes, create_schema
from normalization.query import (
    _normalize_format,
    _normalize_team,
    get_tournament,
    get_tournament_teams,
    getSquad,
    list_tournaments,
)
from normalization.world_cups import (
    WorldCupBuilder,
    load_curated_squads,
    load_teams,
    load_tournaments,
    validate_curated_data,
)
from validation.world_cup_report import generate_world_cup_report


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def sample_curated_data():
    """Minimal valid dataset of 22 tournaments with teams and squads."""
    tournaments = []
    teams = []
    squads = []

    # 13 ODI + 9 T20 = 22 tournaments
    odi_years = [1975, 1979, 1983, 1987, 1992, 1996, 1999, 2003, 2007, 2011, 2015, 2019, 2023]
    t20_years = [2007, 2009, 2010, 2012, 2014, 2016, 2021, 2022, 2024]

    for yr in odi_years:
        tid = f"ODI_WC_{yr}"
        tournaments.append({
            "tournament_id": tid,
            "year": yr,
            "format": "ODI",
            "name": "Cricket World Cup",
            "display_name": f"{yr} Cricket World Cup",
            "edition_number": odi_years.index(yr) + 1,
            "status": "completed",
            "source": "wikipedia",
        })
        teams.append({
            "tournament_id": tid,
            "team_name": "India",
            "source": "wikipedia",
            "source_reference": f"{yr} CWC",
        })
        teams.append({
            "tournament_id": tid,
            "team_name": "Australia",
            "source": "wikipedia",
            "source_reference": f"{yr} CWC",
        })
        squads.append({
            "tournament_id": tid,
            "year": yr,
            "format": "ODI",
            "team": "India",
            "player": f"Player Ind {yr}",
            "role": "BAT",
            "wicketkeeper": False,
            "participated": True,
            "squad_order": 1,
            "source": "wikipedia",
            "source_reference": f"{yr} CWC",
            "original_player_name": f"Player Ind {yr}",
            "source_notes": None,
        })
        squads.append({
            "tournament_id": tid,
            "year": yr,
            "format": "ODI",
            "team": "Australia",
            "player": f"Player Aus {yr}",
            "role": "WK",
            "wicketkeeper": True,
            "participated": True,
            "squad_order": 1,
            "source": "wikipedia",
            "source_reference": f"{yr} CWC",
            "original_player_name": f"Player Aus {yr}",
            "source_notes": None,
        })

    for yr in t20_years:
        tid = f"T20_WC_{yr}"
        tournaments.append({
            "tournament_id": tid,
            "year": yr,
            "format": "T20",
            "name": "ICC Men's T20 World Cup",
            "display_name": f"{yr} ICC Men's T20 World Cup",
            "edition_number": t20_years.index(yr) + 1,
            "status": "completed",
            "source": "wikipedia",
        })
        teams.append({
            "tournament_id": tid,
            "team_name": "India",
            "source": "wikipedia",
            "source_reference": f"{yr} T20 WC",
        })
        squads.append({
            "tournament_id": tid,
            "year": yr,
            "format": "T20",
            "team": "India",
            "player": f"T20 Player {yr}",
            "role": "ALLROUNDER",
            "wicketkeeper": False,
            "participated": True,
            "squad_order": 1,
            "source": "wikipedia",
            "source_reference": f"{yr} T20 WC",
            "original_player_name": f"T20 Player {yr}",
            "source_notes": None,
        })

    return tournaments, teams, squads


@pytest.fixture
def wc_test_db(sample_curated_data, tmp_path):
    """Create a temporary SQLite DB populated with sample curated World Cup data."""
    db_file = tmp_path / "test_maiden.db"
    conn = sqlite3.connect(db_file)
    apply_build_pragmas(conn)
    create_schema(conn)

    tournaments, teams, squads = sample_curated_data
    builder = WorldCupBuilder(conn)
    builder.build(tournaments, teams, squads)
    create_indexes(conn)
    conn.close()
    return db_file


# ============================================================================
# Validation Tests
# ============================================================================


def test_validate_curated_data_passes(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    errors, warnings = validate_curated_data(tournaments, teams, squads)
    assert errors == []
    assert warnings == []


def test_validate_curated_data_detects_missing_fields(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    bad_tournaments = [dict(t) for t in tournaments]
    del bad_tournaments[0]["year"]

    errors, _ = validate_curated_data(bad_tournaments, teams, squads)
    assert any("missing fields" in e for e in errors)


def test_validate_curated_data_detects_duplicate_squad(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    bad_squads = [dict(s) for s in squads]
    bad_squads.append(dict(bad_squads[0]))  # Duplicate

    errors, _ = validate_curated_data(tournaments, teams, bad_squads)
    assert any("Duplicate squad entry" in e for e in errors)


def test_validate_curated_data_detects_unknown_team(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    bad_squads = [dict(s) for s in squads]
    bad_squads[0]["team"] = "NonExistentCountry"

    errors, _ = validate_curated_data(tournaments, teams, bad_squads)
    assert any("Squad references unknown team" in e for e in errors)


def test_validate_curated_data_detects_invalid_role(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    bad_squads = [dict(s) for s in squads]
    bad_squads[0]["role"] = "COACH"

    errors, _ = validate_curated_data(tournaments, teams, bad_squads)
    assert any("Invalid role" in e for e in errors)


def test_validate_curated_data_wk_inconsistency(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    warn_squads = [dict(s) for s in squads]
    warn_squads[0]["role"] = "WK"
    warn_squads[0]["wicketkeeper"] = False

    errors, warnings = validate_curated_data(tournaments, teams, warn_squads)
    assert errors == []
    assert any("role=WK but wicketkeeper=false" in w for w in warnings)


def test_validate_curated_data_tournament_count_mismatch(sample_curated_data):
    tournaments, teams, squads = sample_curated_data
    errors, _ = validate_curated_data(tournaments[:10], teams, squads)
    assert any("Expected 22 tournaments" in e for e in errors)


# ============================================================================
# WorldCupBuilder & Database Tests
# ============================================================================


def test_builder_populates_tables(sample_curated_data):
    conn = sqlite3.connect(":memory:")
    apply_build_pragmas(conn)
    create_schema(conn)

    tournaments, teams, squads = sample_curated_data
    builder = WorldCupBuilder(conn)
    stats = builder.build(tournaments, teams, squads)
    create_indexes(conn)

    assert stats.tournaments == 22
    assert stats.tournament_teams == len(teams)
    assert stats.squad_records == len(squads)

    # Check database tables
    t_count = conn.execute("SELECT COUNT(*) FROM tournaments").fetchone()[0]
    tt_count = conn.execute("SELECT COUNT(*) FROM tournament_teams").fetchone()[0]
    ts_count = conn.execute("SELECT COUNT(*) FROM tournament_squads").fetchone()[0]
    p_count = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    team_count = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]

    assert t_count == 22
    assert tt_count == len(teams)
    assert ts_count == len(squads)
    assert p_count > 0
    assert team_count >= 2

    conn.close()


def test_builder_foreign_keys_valid(sample_curated_data):
    conn = sqlite3.connect(":memory:")
    apply_build_pragmas(conn)
    create_schema(conn)

    tournaments, teams, squads = sample_curated_data
    builder = WorldCupBuilder(conn)
    builder.build(tournaments, teams, squads)
    create_indexes(conn)

    conn.execute("PRAGMA foreign_keys = ON")
    violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    assert violations == []

    conn.close()


# ============================================================================
# Query API Tests
# ============================================================================


def test_query_list_tournaments(wc_test_db):
    t_list = list_tournaments(db_path=wc_test_db)
    assert len(t_list) == 22
    assert all("tournament_id" in t for t in t_list)
    assert all("year" in t for t in t_list)


def test_query_get_tournament(wc_test_db):
    t = get_tournament("ODI", 2011, db_path=wc_test_db)
    assert t["tournament_id"] == "ODI_WC_2011"
    assert t["year"] == 2011
    assert t["format"] == "ODI"

    # Alias check
    t_alias = get_tournament("t20i", 2021, db_path=wc_test_db)
    assert t_alias["tournament_id"] == "T20_WC_2021"

    # Not found raises ValueError
    with pytest.raises(ValueError, match="Tournament not found"):
        get_tournament("ODI", 1900, db_path=wc_test_db)


def test_query_get_tournament_teams(wc_test_db):
    teams = get_tournament_teams("ODI", 2011, db_path=wc_test_db)
    assert teams == ["Australia", "India"]

    with pytest.raises(ValueError, match="Tournament not found"):
        get_tournament_teams("ODI", 1990, db_path=wc_test_db)


def test_query_get_squad(wc_test_db):
    squad = getSquad("ODI", 2011, "India", db_path=wc_test_db)
    assert len(squad) == 1
    player = squad[0]
    assert player["player"] == "Player Ind 2011"
    assert player["role"] == "BAT"
    assert player["wicketkeeper"] is False
    assert player["participated"] is True
    assert player["squad_order"] == 1

    # Unknown team raises ValueError
    with pytest.raises(ValueError, match="Team 'England' not found"):
        getSquad("ODI", 2011, "England", db_path=wc_test_db)


def test_query_format_and_team_normalization():
    assert _normalize_format("odi") == "ODI"
    assert _normalize_format("T20I") == "T20"
    assert _normalize_format("20") == "T20"
    with pytest.raises(ValueError, match="Unsupported format"):
        _normalize_format("TEST")

    assert _normalize_team("  West   Indies  ") == "West Indies"


# ============================================================================
# Report Generation Tests
# ============================================================================


def test_report_generation(wc_test_db):
    conn = sqlite3.connect(wc_test_db)
    report = generate_world_cup_report(conn)
    conn.close()

    assert report.total_tournaments == 22
    assert report.odi_tournaments == 13
    assert report.t20_tournaments == 9
    assert report.status == "PASS"
    assert report.duplicate_squad_records == 0
    assert report.fk_violations == 0

    rendered = report.render_text()
    assert "STATUS: PASS" in rendered
    assert "MAIDEN WORLD CUP DATABASE REPORT" in rendered
