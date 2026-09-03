"""Central configuration for the Maiden data pipeline.

All paths are derived from the repository root so the pipeline works out of the
box with no machine-specific configuration. A few values may be overridden via
environment variables for advanced use, but defaults must always work.
"""

from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------
PIPELINE_VERSION = "1.0.0"
# Bump SCHEMA_VERSION whenever the SQLite schema changes so later phases can
# detect which schema generated a given database. This is intentionally NOT a
# full migration framework (Phase 1 rebuilds from source).
SCHEMA_VERSION = 1

SOURCE_NAME = "cricsheet"

# ---------------------------------------------------------------------------
# Paths (relative to the repository root)
# ---------------------------------------------------------------------------
# data-pipeline/core/config.py  ->  parents[2] == repository root
REPO_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = REPO_ROOT / "data"
RAW_DIR = Path(os.environ.get("MAIDEN_RAW_DIR", DATA_DIR / "raw" / "cricsheet"))
PROCESSED_DIR = Path(os.environ.get("MAIDEN_PROCESSED_DIR", DATA_DIR / "processed"))

DB_PATH = Path(os.environ.get("MAIDEN_DB_PATH", PROCESSED_DIR / "maiden.sqlite"))
# Atomic-build companion: we build here, then os.replace() onto DB_PATH so a
# failed build never clobbers a known-good database.
DB_BUILD_PATH = DB_PATH.with_name("." + DB_PATH.name + ".build")

REPORT_JSON = PROCESSED_DIR / "ingestion_report.json"
REPORT_TXT = PROCESSED_DIR / "ingestion_report.txt"

# ---------------------------------------------------------------------------
# Format canonicalization
# ---------------------------------------------------------------------------
# Cricsheet `info.match_type` -> Maiden canonical format. Phase 1 inputs are male
# ODI and (international) T20 only. IT20 is folded into T20; ODM into ODI. The
# canonical set the database exposes is exactly {"ODI", "T20"}.
CANONICAL_FORMATS = ("ODI", "T20")
MATCH_TYPE_TO_FORMAT = {
    "ODI": "ODI",
    "ODM": "ODI",
    "T20": "T20",
    "IT20": "T20",
}


def canonical_format(match_type: str | None) -> str | None:
    """Map a Cricsheet match_type to a Maiden canonical format, or None."""
    if match_type is None:
        return None
    return MATCH_TYPE_TO_FORMAT.get(match_type.strip().upper())
