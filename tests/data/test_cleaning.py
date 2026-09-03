"""Cleaning-layer tests: dates, names, format canonicalization."""

from __future__ import annotations

from cleaning.dates import normalize_date, normalize_dates
from cleaning.formats import canonical_format
from cleaning.names import normalize_person_name, normalize_team_name


def test_normalize_date_iso():
    assert normalize_date("2024-01-05") == "2024-01-05"


def test_normalize_date_alt_formats():
    assert normalize_date("2024/01/05") == "2024-01-05"
    assert normalize_date("05-01-2024") == "2024-01-05"


def test_normalize_date_invalid():
    assert normalize_date("not-a-date") is None
    assert normalize_date(None) is None


def test_normalize_dates_preserves_order_and_drops_bad():
    assert normalize_dates(["2024-01-02", "bad", "2024-01-03"]) == ["2024-01-02", "2024-01-03"]


def test_normalize_dates_scalar():
    assert normalize_dates("2024-01-02") == ["2024-01-02"]


def test_normalize_team_name_whitespace():
    assert normalize_team_name("  South   Africa ") == "South Africa"


def test_normalize_person_name_whitespace():
    assert normalize_person_name(" V  Kohli ") == "V Kohli"


def test_canonical_format_mapping():
    assert canonical_format("ODI") == "ODI"
    assert canonical_format("ODM") == "ODI"
    assert canonical_format("T20") == "T20"
    assert canonical_format("IT20") == "T20"
    assert canonical_format("Test") is None
    assert canonical_format(None) is None
