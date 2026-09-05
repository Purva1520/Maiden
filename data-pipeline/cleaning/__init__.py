"""Maiden data pipeline — cleaning stage.

Provides normalization utilities for names, roles, teams, tournaments, and dates.
"""

from cleaning.dates import normalize_date, normalize_dates
from cleaning.formats import CANONICAL_FORMATS, canonical_format
from cleaning.names import (
    generate_player_id,
    normalize_name_for_matching,
    normalize_person_name,
    normalize_team_name,
    strip_diacritics,
)
from cleaning.roles import CANONICAL_ROLES, is_wicketkeeper, normalize_role
from cleaning.teams import normalize_team_alias
from cleaning.tournaments import resolve_tournament_id

__all__ = [
    "CANONICAL_FORMATS",
    "CANONICAL_ROLES",
    "canonical_format",
    "generate_player_id",
    "is_wicketkeeper",
    "normalize_date",
    "normalize_dates",
    "normalize_name_for_matching",
    "normalize_person_name",
    "normalize_role",
    "normalize_team_alias",
    "normalize_team_name",
    "resolve_tournament_id",
    "strip_diacritics",
]
