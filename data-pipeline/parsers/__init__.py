"""Cricsheet JSON parsing.

Turns raw match JSON into the source-faithful intermediate model in
``parsers.models``. Split by responsibility: ``match`` (match-level metadata) and
``innings`` (innings/over/delivery). Mapping to canonical database ids happens in
the export layer.
"""

from __future__ import annotations

from .errors import ParseError
from .match import parse_match
from .models import (
    ParsedDelivery,
    ParsedInnings,
    ParsedMatch,
    ParsedOver,
    ParsedWicket,
)

__all__ = [
    "ParseError",
    "ParsedDelivery",
    "ParsedInnings",
    "ParsedMatch",
    "ParsedOver",
    "ParsedWicket",
    "parse_match",
]
