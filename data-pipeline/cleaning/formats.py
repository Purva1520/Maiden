"""Format canonicalization.

Maps raw Cricsheet ``match_type`` values to the Maiden canonical format set
{"ODI", "T20"}. The mapping table lives in ``core.config`` so it is defined once;
this module is the cleaning-layer entry point for it.

Decision: international T20 (``IT20``) and ``T20`` both canonicalize to ``T20``;
``ODI``/``ODM`` canonicalize to ``ODI``. Format is taken from match metadata, not
from the archive filename.
"""

from __future__ import annotations

from core.config import CANONICAL_FORMATS, canonical_format

__all__ = ["CANONICAL_FORMATS", "canonical_format"]
