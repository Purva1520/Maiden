"""Name normalization and slug generation for teams and people.

Phase 3 provides conservative normalization that preserves canonical display
names while enabling deterministic comparison and slug generation.

Key functions:
* ``normalize_person_name``: Preserves display string while trimming and collapsing whitespace.
* ``normalize_team_name``: Preserves display team name while trimming whitespace.
* ``normalize_name_for_matching``: Case-folded, diacritic-stripped, punctuation-normalized
  form strictly used for candidate generation and lookup matching.
* ``generate_player_id``: Stable, human-readable, URL/database-safe slug
  (e.g., 'sachin_tendulkar').
"""

from __future__ import annotations

import re
import unicodedata

_WS = re.compile(r"\s+")
_NON_ALPHANUM = re.compile(r"[^a-z0-9]+")
_PUNCTUATION_TO_SPACE = re.compile(r"[.,/_\-]+")
_APOSTROPHES = re.compile(r"['’`]")


def _collapse(value: str) -> str:
    return _WS.sub(" ", value).strip()


def normalize_team_name(source_name: str) -> str:
    """Canonical team name (whitespace-normalized). Identity is NOT merged."""
    return _collapse(source_name)


def normalize_person_name(source_name: str) -> str:
    """Canonical person (player/official) display name (whitespace-normalized)."""
    return _collapse(source_name)


def strip_diacritics(text: str) -> str:
    """Decompose Unicode characters and remove combining diacritical marks."""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def normalize_name_for_matching(source_name: str) -> str:
    """Produce a conservative, lowercase, diacritic-free string for alias matching.

    Examples:
        'S. Tendulkar'   -> 's tendulkar'
        'Sachin R. Tendulkar' -> 'sachin r tendulkar'
        'José María'     -> 'jose maria'
        'A.B. de Villiers' -> 'ab de villiers'
    """
    if not source_name:
        return ""
    # Strip diacritics
    s = strip_diacritics(source_name)
    # Remove apostrophes (e.g. O'Brien -> OBrien)
    s = _APOSTROPHES.sub("", s)
    # Convert dots/periods between initials (e.g. A.B. -> AB, or S. -> S )
    # If dot follows a single letter, remove dot so 'A.B.' -> 'AB ' or keep initials clean
    s = re.sub(r"\b([A-Za-z])\.", r"\1 ", s)
    # Convert remaining punctuation to space
    s = _PUNCTUATION_TO_SPACE.sub(" ", s)
    # Case fold and collapse whitespace
    s = _WS.sub(" ", s.lower()).strip()
    return s


def generate_player_id(name: str, disambiguator: str | int | None = None) -> str:
    """Generate a deterministic, stable, URL-safe Maiden player ID.

    Examples:
        'Sachin Tendulkar' -> 'sachin_tendulkar'
        'MS Dhoni'         -> 'ms_dhoni'
        'Glenn McGrath'    -> 'glenn_mcgrath'
        'A Khan', 1983     -> 'a_khan_1983'
    """
    clean = strip_diacritics(name)
    clean = _APOSTROPHES.sub("", clean)
    clean = clean.lower()
    # Replace non-alphanumeric chars with underscore
    slug = _NON_ALPHANUM.sub("_", clean).strip("_")
    if not slug:
        slug = "player"
    if disambiguator is not None:
        dis_clean = _NON_ALPHANUM.sub("_", str(disambiguator).lower()).strip("_")
        if dis_clean:
            slug = f"{slug}_{dis_clean}"
    return slug
