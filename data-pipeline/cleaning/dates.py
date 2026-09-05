"""Date normalization.

Normalizes single and multi-date representations into stable ISO ``YYYY-MM-DD``
strings without relying on locale-dependent or ambiguous parsing.
"""

from __future__ import annotations

from datetime import date, datetime

_ACCEPTED_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%d-%b-%Y",
    "%d-%B-%Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%b %d %Y",
    "%B %d %Y",
)


def normalize_date(value: object) -> str | None:
    """Return a canonical ``YYYY-MM-DD`` string, or None if the value cannot be parsed."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    if not text:
        return None
    for fmt in _ACCEPTED_FORMATS:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def normalize_dates(values: object) -> list[str]:
    """Normalize a list of dates, preserving order and dropping unparseable ones."""
    if not isinstance(values, list):
        single = normalize_date(values)
        return [single] if single else []
    out: list[str] = []
    for v in values:
        norm = normalize_date(v)
        if norm:
            out.append(norm)
    return out
