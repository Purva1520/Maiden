"""Tests for Phase 3: Player Identity and Entity Resolution.

Tests cover:
  - Known-identity resolution across variants (Sachin Tendulkar, MS Dhoni, Virat Kohli, etc.)
  - Ambiguity protection (A Khan must NOT be automatically merged)
  - Contextual resolution with team/year
  - Identifier lookup via Cricsheet Register
  - Manual overrides precedence
  - Audit logging and report generation
"""

from __future__ import annotations

import pytest
from ingest.register import RegisterData, RegisterPerson
from normalization.identity import CanonicalPlayer, PlayerIdentityResolver


@pytest.fixture
def mock_register():
    """Register data for testing resolution without network access."""
    reg = RegisterData()

    # Sachin Tendulkar
    sachin = RegisterPerson(
        identifier="d2c2b2d5",
        name="SR Tendulkar",
        unique_name="SR Tendulkar",
        external_ids={"cricinfo": "35320"},
        aliases={"Sachin Tendulkar", "S Tendulkar", "SR Tendulkar", "Sachin R Tendulkar"},
    )
    reg.people_by_id["d2c2b2d5"] = sachin
    reg.people_by_external_id[("cricinfo", "35320")] = sachin

    # Multiple Khans for ambiguity testing
    khan_1 = RegisterPerson(
        identifier="khan0001",
        name="Adil Khan",
        unique_name="Adil Khan",
        aliases={"Adil Khan", "A Khan"},
    )
    khan_2 = RegisterPerson(
        identifier="khan0002",
        name="Asif Khan",
        unique_name="Asif Khan",
        aliases={"Asif Khan", "A Khan"},
    )
    reg.people_by_id["khan0001"] = khan_1
    reg.people_by_id["khan0002"] = khan_2

    # Ricky Ponting
    ponting = RegisterPerson(
        identifier="pont0001",
        name="Ricky Ponting",
        unique_name="RT Ponting",
        external_ids={"cricinfo": "7133"},
        aliases={"Ricky Ponting", "RT Ponting", "R Ponting"},
    )
    reg.people_by_id["pont0001"] = ponting

    # Build normalized indexes
    for p in reg.people_by_id.values():
        for a in p.aliases:
            from cleaning.names import normalize_name_for_matching
            norm = normalize_name_for_matching(a)
            reg.people_by_normalized_name.setdefault(norm, []).append(p)

    return reg


@pytest.fixture
def resolver(mock_register, tmp_path):
    """Resolver initialized with mock register."""
    # Write a test override file
    overrides_file = tmp_path / "test_overrides.json"
    overrides_file.write_text(
        """{
        "version": 1,
        "overrides": {
            "Sachin Tendulkar": {"player_id": "sachin_tendulkar", "canonical_name": "Sachin Tendulkar"},
            "SR Tendulkar": {"player_id": "sachin_tendulkar", "canonical_name": "Sachin Tendulkar"},
            "S Tendulkar": {"player_id": "sachin_tendulkar", "canonical_name": "Sachin Tendulkar"},
            "S. Tendulkar": {"player_id": "sachin_tendulkar", "canonical_name": "Sachin Tendulkar"},
            "Sachin R Tendulkar": {"player_id": "sachin_tendulkar", "canonical_name": "Sachin Tendulkar"}
        },
        "contextual_overrides": [
            {
                "name": "A Khan",
                "team": "Pakistan",
                "year": 1996,
                "player_id": "akram_khan",
                "reason": "Test contextual override"
            }
        ]
    }""",
        encoding="utf-8",
    )
    return PlayerIdentityResolver(register=mock_register, overrides_path=overrides_file)


# ============================================================================
# Known Identity Tests
# ============================================================================


def test_sachin_tendulkar_variants_resolve_to_same_id(resolver):
    variants = [
        "Sachin Tendulkar",
        "S Tendulkar",
        "S. Tendulkar",
        "SR Tendulkar",
        "Sachin R Tendulkar",
    ]
    for variant in variants:
        res = resolver.resolve(variant)
        assert res.player is not None, f"Failed to resolve {variant}"
        assert res.player.player_id == "sachin_tendulkar"
        assert res.player.canonical_name == "Sachin Tendulkar"
        assert res.status in ("RESOLVED_MANUAL", "RESOLVED_EXACT", "RESOLVED_ALIAS")


def test_ricky_ponting_alias_resolution(resolver):
    res_full = resolver.resolve("Ricky Ponting")
    assert res_full.player is not None
    assert "ponting" in res_full.player.player_id

    res_initial = resolver.resolve("RT Ponting")
    assert res_initial.player is not None
    assert res_initial.player.player_id == res_full.player.player_id


def test_cricsheet_identifier_resolution(resolver):
    res = resolver.resolve("Unknown Alias", cricsheet_id="d2c2b2d5")
    assert res.player is not None
    assert res.status == "RESOLVED_IDENTIFIER"
    assert res.player.player_id == "sachin_tendulkar"


# ============================================================================
# Ambiguity Protection Tests (Section 47: Mandatory)
# ============================================================================


def test_ambiguous_name_not_automatically_merged(resolver):
    """CRITICAL: 'A Khan' must NOT be silently merged when multiple candidates exist."""
    res = resolver.resolve("A Khan", team="Generic Team", year=2020)
    assert res.status == "REVIEW"
    assert res.method in ("ambiguous", "unresolved")
    assert len(res.candidates) >= 2
    assert "khan0001" in [p for p in res.candidates] or any("khan" in c for c in res.candidates)

    # Must also appear in the review queue
    queued_names = [q["raw_name"] for q in resolver.review_queue]
    assert "A Khan" in queued_names


def test_ambiguous_name_resolved_with_contextual_override(resolver):
    """When explicit contextual evidence matches, disambiguation succeeds."""
    res = resolver.resolve("A Khan", team="Pakistan", year=1996)
    assert res.status == "RESOLVED_MANUAL"
    assert res.player is not None
    assert res.player.player_id == "akram_khan"


# ============================================================================
# Curated Historical Sources Minting
# ============================================================================


def test_curated_historical_player_minted_cleanly(resolver):
    res = resolver.resolve("Harilal Shah", team="East Africa", year=1975, source="curated")
    assert res.status == "RESOLVED_EXACT"
    assert res.player is not None
    assert res.player.player_id == "harilal_shah"
    assert res.player.canonical_name == "Harilal Shah"
    assert res.player.country_id == "East Africa"


# ============================================================================
# Audit Logging and Reporting Tests
# ============================================================================


def test_audit_log_records_resolutions(resolver):
    resolver.resolve("Sachin Tendulkar")
    resolver.resolve("A Khan")
    rep = resolver.generate_report_dict()

    assert rep["raw_player_references"] >= 2
    assert rep["canonical_players"] >= 3
    assert rep["review"]["ambiguous"] >= 1

    text = resolver.render_report_text()
    assert "MAIDEN PLAYER IDENTITY REPORT" in text
    assert "Canonical players:" in text
