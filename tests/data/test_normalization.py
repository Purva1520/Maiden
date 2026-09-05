"""Tests for Phase 3: Attribute and Entity Normalization.

Tests cover:
  - Role normalization (BAT, BOWL, ALLROUNDER, WK, invalid roles)
  - Team normalization (standard abbreviations, preserving historical distinctness)
  - Tournament normalization (ODI & T20 World Cup name variations)
  - Date normalization (ISO, textual, multi-date, unparseable dates)
  - Name normalization (diacritics, punctuation, case, whitespace, slug generation)
"""

from __future__ import annotations

import pytest
from cleaning.dates import normalize_date, normalize_dates
from cleaning.names import (
    generate_player_id,
    normalize_name_for_matching,
    normalize_person_name,
    normalize_team_name,
    strip_diacritics,
)
from cleaning.roles import is_wicketkeeper, normalize_role
from cleaning.teams import normalize_team_alias
from cleaning.tournaments import resolve_tournament_id


# ============================================================================
# Role Normalization Tests
# ============================================================================


def test_role_normalization_standard():
    assert normalize_role("Batsman") == "BAT"
    assert normalize_role("Bowler") == "BOWL"
    assert normalize_role("All-rounder") == "ALLROUNDER"
    assert normalize_role("Wicketkeeper") == "WK"


def test_role_normalization_variants():
    # Batting variants
    assert normalize_role("Batter") == "BAT"
    assert normalize_role("Opening batsman") == "BAT"
    assert normalize_role("Top-order batter") == "BAT"
    assert normalize_role("b") == "BAT"

    # Bowling variants
    assert normalize_role("Fast bowler") == "BOWL"
    assert normalize_role("Pace bowler") == "BOWL"
    assert normalize_role("Leg-spinner") == "BOWL"
    assert normalize_role("Off-spinner") == "BOWL"
    assert normalize_role("bw") == "BOWL"

    # All-rounder variants
    assert normalize_role("allrounder") == "ALLROUNDER"
    assert normalize_role("All rounder") == "ALLROUNDER"
    assert normalize_role("Batting allrounder") == "ALLROUNDER"
    assert normalize_role("ar") == "ALLROUNDER"

    # Wicketkeeper variants
    assert normalize_role("Wicket-keeper") == "WK"
    assert normalize_role("Keeper") == "WK"
    assert normalize_role("Wicketkeeper-batsman") == "WK"
    assert normalize_role("WK-Batter") == "WK"


def test_role_normalization_invalid_raises():
    with pytest.raises(ValueError, match="Unrecognized player role"):
        normalize_role("Coach")

    with pytest.raises(ValueError, match="Unrecognized player role"):
        normalize_role("Captain")

    with pytest.raises(ValueError, match="Invalid role value"):
        normalize_role("")


def test_is_wicketkeeper_helper():
    assert is_wicketkeeper("WK") is True
    assert is_wicketkeeper("Wicketkeeper") is True
    assert is_wicketkeeper("Keeper") is True
    assert is_wicketkeeper("BAT") is False
    assert is_wicketkeeper("BOWL") is False
    assert is_wicketkeeper("ALLROUNDER") is False


# ============================================================================
# Team Normalization Tests
# ============================================================================


def test_team_normalization_abbreviations():
    assert normalize_team_alias("IND") == "India"
    assert normalize_team_alias("AUS") == "Australia"
    assert normalize_team_alias("ENG") == "England"
    assert normalize_team_alias("PAK") == "Pakistan"
    assert normalize_team_alias("NZ") == "New Zealand"
    assert normalize_team_alias("WI") == "West Indies"
    assert normalize_team_alias("RSA") == "South Africa"
    assert normalize_team_alias("The Netherlands") == "Netherlands"


def test_team_normalization_preserves_historical_distinctness():
    # East Africa is historically distinct from Kenya
    assert normalize_team_alias("East Africa") == "East Africa"
    assert normalize_team_alias("Kenya") == "Kenya"
    assert normalize_team_alias("East Africa") != normalize_team_alias("Kenya")

    # United Arab Emirates vs United States
    assert normalize_team_alias("UAE") == "United Arab Emirates"
    assert normalize_team_alias("USA") == "United States"


# ============================================================================
# Tournament Normalization Tests
# ============================================================================


def test_tournament_normalization_odi():
    assert resolve_tournament_id("ICC Cricket World Cup", 2011, "ODI") == "ODI_WC_2011"
    assert resolve_tournament_id("Cricket World Cup", 1983, "ODI") == "ODI_WC_1983"
    assert resolve_tournament_id("Prudential Cup", 1975, "ODI") == "ODI_WC_1975"
    assert resolve_tournament_id("Reliance World Cup", 1987, "ODI") == "ODI_WC_1987"


def test_tournament_normalization_t20():
    assert resolve_tournament_id("ICC World Twenty20", 2007, "T20") == "T20_WC_2007"
    assert resolve_tournament_id("World T20", 2014, "T20") == "T20_WC_2014"
    assert resolve_tournament_id("ICC Men's T20 World Cup", 2021, "T20") == "T20_WC_2021"
    assert resolve_tournament_id("T20 World Cup", 2024, "T20") == "T20_WC_2024"


def test_tournament_normalization_invalid_raises():
    with pytest.raises(ValueError, match="Unsupported tournament format"):
        resolve_tournament_id("World Cup", 2011, "TEST")

    with pytest.raises(ValueError, match="Cannot resolve tournament"):
        resolve_tournament_id("Random Club Trophy", 2020, "ODI")


# ============================================================================
# Date Normalization Tests
# ============================================================================


def test_date_normalization_formats():
    assert normalize_date("2011-02-19") == "2011-02-19"
    assert normalize_date("19 Feb 2011") == "2011-02-19"
    assert normalize_date("February 19, 2011") == "2011-02-19"
    assert normalize_date("19-Feb-2011") == "2011-02-19"
    assert normalize_date("19/02/2011") == "2011-02-19"


def test_date_normalization_invalid():
    assert normalize_date("not-a-date") is None
    assert normalize_date("") is None
    assert normalize_date(None) is None


def test_multi_date_normalization():
    dates = ["2024-01-01", "2 Jan 2024", "invalid", "2024-01-03"]
    normalized = normalize_dates(dates)
    assert normalized == ["2024-01-01", "2024-01-02", "2024-01-03"]


# ============================================================================
# Name Normalization Tests
# ============================================================================


def test_strip_diacritics():
    assert strip_diacritics("José María") == "Jose Maria"
    assert strip_diacritics("Müller") == "Muller"


def test_normalize_name_for_matching():
    assert normalize_name_for_matching("Sachin Tendulkar") == "sachin tendulkar"
    assert normalize_name_for_matching("S. Tendulkar") == "s tendulkar"
    assert normalize_name_for_matching("SR Tendulkar") == "sr tendulkar"
    assert normalize_name_for_matching("A.B. de Villiers") == "a b de villiers"
    assert normalize_name_for_matching("José María") == "jose maria"
    assert normalize_name_for_matching("  Spaces   Around  ") == "spaces around"


def test_generate_player_id():
    assert generate_player_id("Sachin Tendulkar") == "sachin_tendulkar"
    assert generate_player_id("MS Dhoni") == "ms_dhoni"
    assert generate_player_id("Glenn McGrath") == "glenn_mcgrath"
    assert generate_player_id("A Khan", disambiguator=1983) == "a_khan_1983"
