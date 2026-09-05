"""Team name normalization and alias resolution.

Handles common abbreviations (e.g. 'IND' -> 'India', 'ENG' -> 'England')
while ensuring historically distinct teams (e.g. East Africa vs Kenya)
are NEVER falsely merged.
"""

from __future__ import annotations

import re

_WS = re.compile(r"\s+")

# Common international team aliases and abbreviations mapped to canonical names.
_TEAM_ALIASES: dict[str, str] = {
    "ind": "India",
    "india": "India",
    "india xi": "India",
    "aus": "Australia",
    "australia": "Australia",
    "australia xi": "Australia",
    "eng": "England",
    "england": "England",
    "england xi": "England",
    "pak": "Pakistan",
    "pakistan": "Pakistan",
    "pakistan xi": "Pakistan",
    "nz": "New Zealand",
    "new zealand": "New Zealand",
    "sa": "South Africa",
    "south africa": "South Africa",
    "rsa": "South Africa",
    "wi": "West Indies",
    "west indies": "West Indies",
    "win": "West Indies",
    "sl": "Sri Lanka",
    "sri lanka": "Sri Lanka",
    "ban": "Bangladesh",
    "bangladesh": "Bangladesh",
    "bdesh": "Bangladesh",
    "afg": "Afghanistan",
    "afghanistan": "Afghanistan",
    "zim": "Zimbabwe",
    "zimbabwe": "Zimbabwe",
    "ire": "Ireland",
    "ireland": "Ireland",
    "sco": "Scotland",
    "scotland": "Scotland",
    "ned": "Netherlands",
    "netherlands": "Netherlands",
    "holland": "Netherlands",
    "the netherlands": "Netherlands",
    "uae": "United Arab Emirates",
    "united arab emirates": "United Arab Emirates",
    "u.a.e.": "United Arab Emirates",
    "usa": "United States",
    "united states": "United States",
    "united states of america": "United States",
    "u.s.a.": "United States",
    "nep": "Nepal",
    "nepal": "Nepal",
    "oma": "Oman",
    "oman": "Oman",
    "nam": "Namibia",
    "namibia": "Namibia",
    "png": "Papua New Guinea",
    "papua new guinea": "Papua New Guinea",
    "can": "Canada",
    "canada": "Canada",
    "ken": "Kenya",
    "kenya": "Kenya",
    "uga": "Uganda",
    "uganda": "Uganda",
    "east africa": "East Africa",
    "eaf": "East Africa",
    "hk": "Hong Kong",
    "hong kong": "Hong Kong",
    "ber": "Bermuda",
    "bermuda": "Bermuda",
}


def normalize_team_alias(team_input: str) -> str:
    """Normalize a team name or abbreviation to its canonical display name.

    If the team name is not a known abbreviation/alias, returns the whitespace-cleaned
    source name without aggressive alteration.
    """
    if not team_input:
        return ""
    cleaned = _WS.sub(" ", team_input).strip()
    key = cleaned.lower()
    return _TEAM_ALIASES.get(key, cleaned)


def get_canonical_team_aliases() -> dict[str, str]:
    """Return a copy of the canonical alias map."""
    return dict(_TEAM_ALIASES)
