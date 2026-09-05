"""Role normalization for Maiden cricket entities.

Normalizes raw source role descriptions into Maiden's canonical role set:
    {"BAT", "BOWL", "ALLROUNDER", "WK"}

Section 30 & 31 & 32 rules:
* Mapping is deterministic and conservative.
* Fine-grained bowling/batting styles (e.g. 'Fast bowler', 'Leg-spinner') map to BOWL.
* Wicketkeeper variants map to WK.
* Roles are NOT inferred from match scorecards (no guessing ALLROUNDER from a few overs).
* Unrecognized roles raise ValueError.
"""

from __future__ import annotations

import re

CANONICAL_ROLES = frozenset({"BAT", "BOWL", "ALLROUNDER", "WK"})

_ROLE_MAP: dict[str, str] = {
    # Batting
    "bat": "BAT",
    "batsman": "BAT",
    "batter": "BAT",
    "opening batsman": "BAT",
    "opening batter": "BAT",
    "top-order batter": "BAT",
    "top order batter": "BAT",
    "middle-order batter": "BAT",
    "middle order batter": "BAT",
    "b": "BAT",
    # Bowling
    "bowl": "BOWL",
    "bowler": "BOWL",
    "fast bowler": "BOWL",
    "pace bowler": "BOWL",
    "medium pacer": "BOWL",
    "spinner": "BOWL",
    "spin bowler": "BOWL",
    "leg-spinner": "BOWL",
    "leg spinner": "BOWL",
    "off-spinner": "BOWL",
    "off spinner": "BOWL",
    "slow left-arm": "BOWL",
    "right-arm fast": "BOWL",
    "left-arm fast": "BOWL",
    "bw": "BOWL",
    # All-rounder
    "allrounder": "ALLROUNDER",
    "all-rounder": "ALLROUNDER",
    "all rounder": "ALLROUNDER",
    "batting allrounder": "ALLROUNDER",
    "batting all-rounder": "ALLROUNDER",
    "bowling allrounder": "ALLROUNDER",
    "bowling all-rounder": "ALLROUNDER",
    "ar": "ALLROUNDER",
    # Wicketkeeper
    "wk": "WK",
    "wicketkeeper": "WK",
    "wicket-keeper": "WK",
    "wicket keeper": "WK",
    "wicketkeeper batsman": "WK",
    "wicketkeeper-batsman": "WK",
    "wicket-keeper batsman": "WK",
    "wicket-keeper-batsman": "WK",
    "wicketkeeper batter": "WK",
    "wicketkeeper-batter": "WK",
    "wicket-keeper batter": "WK",
    "wicket-keeper-batter": "WK",
    "keeper": "WK",
    "wk-batter": "WK",
    "wk-batsman": "WK",
}


def normalize_role(source_role: str) -> str:
    """Normalize a raw role string into canonical 'BAT' | 'BOWL' | 'ALLROUNDER' | 'WK'.

    Raises:
        ValueError: if the role cannot be deterministically resolved.
    """
    if not source_role or not isinstance(source_role, str):
        raise ValueError(f"Invalid role value: {source_role!r}")

    # Canonical already?
    cleaned = re.sub(r"\s+", " ", source_role.strip()).lower()
    canonical = _ROLE_MAP.get(cleaned)
    if canonical:
        return canonical

    # Check uppercase directly
    if source_role.strip().upper() in CANONICAL_ROLES:
        return source_role.strip().upper()

    raise ValueError(
        f"Unrecognized player role: {source_role!r}. "
        f"Expected one of: {sorted(CANONICAL_ROLES)} or standard variants."
    )


def is_wicketkeeper(role: str) -> bool:
    """Check whether a normalized or raw role indicates a wicketkeeper."""
    try:
        return normalize_role(role) == "WK"
    except ValueError:
        return False
