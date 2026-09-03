"""Parser error type."""

from __future__ import annotations


class ParseError(ValueError):
    """Raised when a match cannot be parsed into the Maiden intermediate model.

    Caught per-match by the pipeline so one malformed match does not abort the
    whole import; the failure is recorded in the ingestion report.
    """
