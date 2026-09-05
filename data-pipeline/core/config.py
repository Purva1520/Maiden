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
SCHEMA_VERSION = 2

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

# Phase 2: World Cup curated data and reports
GAME_DIR = DATA_DIR / "game"
WORLD_CUP_DIR = GAME_DIR / "world_cups"
WORLD_CUP_REPORT_JSON = PROCESSED_DIR / "world_cup_report.json"
WORLD_CUP_REPORT_TXT = PROCESSED_DIR / "world_cup_report.txt"

# Phase 4: tournament statistics & era normalization outputs
STATS_PARQUET = PROCESSED_DIR / "player_tournament_stats.parquet"
TOURNAMENT_BASELINES_PARQUET = PROCESSED_DIR / "tournament_baselines.parquet"
ERA_BASELINES_PARQUET = PROCESSED_DIR / "era_baselines.parquet"
STATS_REPORT_JSON = PROCESSED_DIR / "tournament_stats_report.json"
STATS_REPORT_TXT = PROCESSED_DIR / "tournament_stats_report.txt"
STATS_MANIFEST = PROCESSED_DIR / "tournament_stats_manifest.json"
STATS_REVIEW_JSON = PROCESSED_DIR / "tournament_stats_review.json"
FEATURE_DICTIONARY = PROCESSED_DIR / "feature_dictionary.json"

# Phase 5: Maiden rating system
RATINGS_CONFIG_DIR = GAME_DIR / "ratings"
PLAYER_RATINGS_PARQUET = PROCESSED_DIR / "player_ratings.parquet"
RATING_REPORT_JSON = PROCESSED_DIR / "rating_report.json"
RATING_REPORT_TXT = PROCESSED_DIR / "rating_report.txt"
RATING_DISTRIBUTION_REPORT = PROCESSED_DIR / "rating_distribution_report.json"


def ratings_json(version: str) -> Path:
    return PROCESSED_DIR / f"ratings_{version}.json"


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
