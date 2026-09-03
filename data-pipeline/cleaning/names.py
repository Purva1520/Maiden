"""Name normalization for teams and people.

Phase 1 performs only the *minimal* normalization needed for consistent
references within the Cricsheet dataset:

* trim and collapse whitespace,
* keep the original source name alongside the canonical form.

It deliberately does NOT perform historical identity reconciliation, fuzzy
matching, or team-identity merging (e.g. it never assumes "A Khan" == "Abdul
Khan"). That is Phase 3 work. Player identity is instead anchored on Cricsheet's
stable registry id where available.
"""

from __future__ import annotations

import re

_WS = re.compile(r"\s+")


def _collapse(value: str) -> str:
    return _WS.sub(" ", value).strip()


def normalize_team_name(source_name: str) -> str:
    """Canonical team name (whitespace-normalized). Identity is NOT merged."""
    return _collapse(source_name)


def normalize_person_name(source_name: str) -> str:
    """Canonical person (player/official) name (whitespace-normalized)."""
    return _collapse(source_name)
