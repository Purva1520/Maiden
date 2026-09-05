"""Tournament name normalization and canonical tournament identification.

Maps variations like 'ICC Cricket World Cup', 'Cricket World Cup', 'World Cup'
combined with format and year into the canonical Maiden tournament ID:
  - 'ODI_WC_YYYY'
  - 'T20_WC_YYYY'
"""

from __future__ import annotations

import re

_WS = re.compile(r"\s+")

# Recognized naming patterns for World Cups
_ODI_WC_PATTERNS = (
    "cricket world cup",
    "icc cricket world cup",
    "icc world cup",
    "world cup",
    "cwc",
    "prudential cup",
    "reliance world cup",
    "benson & hedges world cup",
    "wills world cup",
)

_T20_WC_PATTERNS = (
    "icc world twenty20",
    "world twenty20",
    "icc world t20",
    "world t20",
    "icc t20 world cup",
    "t20 world cup",
    "icc men's t20 world cup",
    "wt20",
)


def resolve_tournament_id(name: str, year: int, fmt: str) -> str:
    """Resolve a tournament name, year, and format to canonical 'ODI_WC_YYYY' or 'T20_WC_YYYY'.

    Raises:
        ValueError: if the tournament cannot be deterministically resolved.
    """
    clean_name = _WS.sub(" ", name).strip().lower()
    clean_fmt = fmt.strip().upper()
    if clean_fmt in ("ODI", "OD", "50"):
        clean_fmt = "ODI"
    elif clean_fmt in ("T20", "T20I", "20", "IT20"):
        clean_fmt = "T20"
    else:
        raise ValueError(f"Unsupported tournament format: {fmt!r}")

    # Verify name relates to World Cup
    is_odi_match = any(p in clean_name for p in _ODI_WC_PATTERNS)
    is_t20_match = any(p in clean_name for p in _T20_WC_PATTERNS)

    if clean_fmt == "ODI" and is_odi_match:
        return f"ODI_WC_{year}"
    if clean_fmt == "T20" and (is_t20_match or "world cup" in clean_name):
        return f"T20_WC_{year}"

    # If the name is already the tournament ID or display name:
    if clean_name.upper().startswith("ODI_WC_") or clean_name.upper().startswith("T20_WC_"):
        return clean_name.upper()

    raise ValueError(
        f"Cannot resolve tournament: {name!r} (year={year}, format={fmt!r}). "
        f"Not recognized as an official ICC World Cup edition."
    )
