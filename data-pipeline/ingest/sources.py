"""Centralized Cricsheet source configuration.

Phase 1 uses Cricsheet exclusively (male ODI and male T20 JSON archives). URLs
are defined once here rather than scattered through the codebase. They were
verified against https://cricsheet.org/downloads/ at build time.

Data license: Open Data Commons Attribution License (ODC-By) v1.0. See
docs/data-policy.md — attribution and license notices must be preserved for any
redistribution of derived datasets.
"""

from __future__ import annotations

from dataclasses import dataclass

CRICSHEET_BASE_URL = "https://cricsheet.org/downloads"

# Canonical Cricsheet archive URLs. Keep this the single source of truth.
CRICSHEET_SOURCES = {
    "odi_male": f"{CRICSHEET_BASE_URL}/odis_male_json.zip",
    "t20_male": f"{CRICSHEET_BASE_URL}/t20s_male_json.zip",
}


@dataclass(frozen=True)
class ArchiveSpec:
    """Describes one Cricsheet archive the pipeline knows how to ingest."""

    key: str  # e.g. "odi_male"
    format: str  # Maiden canonical format: "ODI" | "T20"
    filename: str  # local filename under the raw directory
    url: str  # download URL


ARCHIVES: dict[str, ArchiveSpec] = {
    "ODI": ArchiveSpec(
        key="odi_male",
        format="ODI",
        filename="odis_male_json.zip",
        url=CRICSHEET_SOURCES["odi_male"],
    ),
    "T20": ArchiveSpec(
        key="t20_male",
        format="T20",
        filename="t20s_male_json.zip",
        url=CRICSHEET_SOURCES["t20_male"],
    ),
}


def archives_for(selection: str) -> list[ArchiveSpec]:
    """Return the archive specs for a format selection: 'odi', 't20' or 'all'."""
    selection = selection.strip().lower()
    if selection == "all":
        return list(ARCHIVES.values())
    if selection in ("odi", "odis"):
        return [ARCHIVES["ODI"]]
    if selection in ("t20", "t20s", "it20"):
        return [ARCHIVES["T20"]]
    raise ValueError(f"Unknown format selection: {selection!r} (use odi|t20|all)")
