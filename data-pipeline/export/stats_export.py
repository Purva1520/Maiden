"""Phase 4 output export: Parquet datasets, manifest, and feature dictionary."""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from core import config
from normalization.stats.config import (
    BATTING_NORM_FEATURES,
    BOWLING_NORM_FEATURES,
    NORMALIZATION_VERSION,
    STATISTICS_SCHEMA_VERSION,
)

# Authoritative descriptions for the non-normalized columns (§76/§77).
_BASE_FIELDS: dict[str, dict] = {
    "tournament_id": {
        "desc": "Maiden tournament id (e.g. ODI_WC_2011).",
        "type": "string",
        "kind": "identity",
    },
    "year": {"desc": "Tournament year.", "type": "int", "kind": "identity"},
    "format": {"desc": "ODI or T20.", "type": "string", "kind": "identity"},
    "team_id": {"desc": "Canonical team id (string).", "type": "string", "kind": "identity"},
    "player_id": {"desc": "Canonical Phase 3 player id.", "type": "string", "kind": "identity"},
    "player_name": {"desc": "Display name.", "type": "string", "kind": "identity"},
    "team_name": {"desc": "Team display name.", "type": "string", "kind": "identity"},
    "era_id": {
        "desc": "Era window id (config), null if none.",
        "type": "string",
        "kind": "identity",
    },
    "squad_member": {
        "desc": "In the Phase 2 tournament squad (always true here).",
        "type": "bool",
        "kind": "participation",
    },
    "participated": {
        "desc": "Phase 2 flag: appeared in >=1 tournament match.",
        "type": "bool",
        "kind": "participation",
    },
    "batted": {"desc": "Had >=1 batting innings.", "type": "bool", "kind": "participation"},
    "bowled": {"desc": "Had >=1 bowling innings.", "type": "bool", "kind": "participation"},
    "matches_played": {
        "desc": "Distinct tournament matches in the XI.",
        "type": "int",
        "kind": "participation",
    },
    "role": {
        "desc": "Canonical role BAT/BOWL/ALLROUNDER/WK.",
        "type": "string",
        "kind": "participation",
    },
    "wicketkeeper": {"desc": "Wicketkeeper flag.", "type": "int", "kind": "participation"},
    "bat_innings": {"desc": "Innings the player came to the crease.", "type": "int", "kind": "raw"},
    "bat_runs": {"desc": "Runs off the bat (excludes extras).", "type": "int", "kind": "raw"},
    "bat_balls": {"desc": "Balls faced (excludes wides).", "type": "int", "kind": "raw"},
    "bat_dismissals": {
        "desc": "Times out (all kinds except retirements).",
        "type": "int",
        "kind": "raw",
    },
    "bat_not_outs": {"desc": "bat_innings - bat_dismissals.", "type": "int", "kind": "raw"},
    "bat_fours": {"desc": "Boundary fours off the bat.", "type": "int", "kind": "raw"},
    "bat_sixes": {"desc": "Boundary sixes off the bat.", "type": "int", "kind": "raw"},
    "bat_boundary_runs": {"desc": "4*fours + 6*sixes.", "type": "int", "kind": "derived"},
    "bat_highest": {
        "desc": "Highest innings score; null if never batted.",
        "type": "float",
        "kind": "raw",
    },
    "bat_fifties": {"desc": "Innings with 50<=score<100.", "type": "int", "kind": "raw"},
    "bat_hundreds": {"desc": "Innings with score>=100.", "type": "int", "kind": "raw"},
    "bat_average": {
        "desc": "runs/dismissals; null if 0 dismissals.",
        "type": "float",
        "kind": "derived",
    },
    "bat_strike_rate": {
        "desc": "runs/balls*100; null if 0 balls.",
        "type": "float",
        "kind": "derived",
    },
    "bat_runs_per_innings": {
        "desc": "runs/innings; null if 0 innings.",
        "type": "float",
        "kind": "derived",
    },
    "bat_boundary_rate": {
        "desc": "(fours+sixes)/balls; null if 0 balls.",
        "type": "float",
        "kind": "derived",
    },
    "bowl_innings": {"desc": "Innings the player bowled.", "type": "int", "kind": "raw"},
    "bowl_balls": {
        "desc": "Legal balls bowled (excl. wides/no-balls).",
        "type": "int",
        "kind": "raw",
    },
    "bowl_overs_display": {
        "desc": "Overs in cricket notation (e.g. 4.5); null if none.",
        "type": "string",
        "kind": "derived",
    },
    "bowl_runs_conceded": {"desc": "Batter runs + wides + no-balls.", "type": "int", "kind": "raw"},
    "bowl_wickets": {"desc": "Bowler-credited wickets only.", "type": "int", "kind": "raw"},
    "bowl_maidens": {
        "desc": "Overs with 0 charged runs and >=1 legal ball.",
        "type": "int",
        "kind": "raw",
    },
    "bowl_five_wickets": {"desc": "Innings with >=5 bowler wickets.", "type": "int", "kind": "raw"},
    "bowl_economy": {"desc": "runs*6/balls; null if 0 balls.", "type": "float", "kind": "derived"},
    "bowl_average": {
        "desc": "runs/wickets; null if 0 wickets.",
        "type": "float",
        "kind": "derived",
    },
    "bowl_strike_rate": {
        "desc": "balls/wickets; null if 0 wickets.",
        "type": "float",
        "kind": "derived",
    },
    "bowl_wickets_per_innings": {
        "desc": "wickets/innings; null if 0 innings.",
        "type": "float",
        "kind": "derived",
    },
    "batting_sample_status": {
        "desc": "NONE/LOW/VALID by batting innings.",
        "type": "string",
        "kind": "quality",
    },
    "bowling_sample_status": {
        "desc": "NONE/LOW/VALID by bowling innings.",
        "type": "string",
        "kind": "quality",
    },
    "tournament_coverage_status": {
        "desc": "COMPLETE/PARTIAL/INSUFFICIENT ball-by-ball coverage.",
        "type": "string",
        "kind": "quality",
    },
    "batting_data_quality": {
        "desc": "Follows tournament coverage.",
        "type": "string",
        "kind": "quality",
    },
    "bowling_data_quality": {
        "desc": "Follows tournament coverage.",
        "type": "string",
        "kind": "quality",
    },
}


def build_feature_dictionary(df: pd.DataFrame) -> dict:
    """Document every exported column (base + generated normalized columns)."""
    fields: dict[str, dict] = {}
    for col in df.columns:
        if col in _BASE_FIELDS:
            fields[col] = _BASE_FIELDS[col]
            continue
        # Generated normalized columns: {metric}_{tourn|era}_{pct|z}
        for scope, scope_name in (("tourn", "tournament"), ("era", "era")):
            for kind, kdesc in (
                ("pct", "percentile (0-100, higher=better)"),
                ("z", "z-score (direction-corrected)"),
            ):
                suffix = f"_{scope}_{kind}"
                if col.endswith(suffix):
                    metric = col[: -len(suffix)]
                    direction = {**BATTING_NORM_FEATURES, **BOWLING_NORM_FEATURES}.get(metric)
                    fields[col] = {
                        "desc": f"{metric} {scope_name} {kdesc}; direction={direction}.",
                        "type": "float",
                        "kind": "normalized",
                    }
    return {
        "statistics_schema_version": STATISTICS_SCHEMA_VERSION,
        "normalization_version": NORMALIZATION_VERSION,
        "fields": fields,
    }


def write_outputs(conn: sqlite3.Connection, frames: dict[str, pd.DataFrame]) -> dict[str, Path]:
    """Write all Phase 4 output files. Returns {name: path}."""
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df = frames["player_stats"]

    df.to_parquet(config.STATS_PARQUET, index=False)
    frames["tournament_baselines"].to_parquet(config.TOURNAMENT_BASELINES_PARQUET, index=False)
    frames["era_baselines"].to_parquet(config.ERA_BASELINES_PARQUET, index=False)

    # Feature dictionary
    config.FEATURE_DICTIONARY.write_text(
        json.dumps(build_feature_dictionary(df), indent=2) + "\n", encoding="utf-8"
    )

    # Manifest
    src_schema = conn.execute(
        "SELECT value FROM pipeline_metadata WHERE key = 'schema_version'"
    ).fetchone()
    manifest = {
        "statistics_schema_version": STATISTICS_SCHEMA_VERSION,
        "normalization_version": NORMALIZATION_VERSION,
        "source_database_schema_version": src_schema[0] if src_schema else None,
        "build_timestamp": datetime.now(UTC).isoformat(),
        "formats_processed": sorted(df["format"].unique().tolist()),
        "tournaments_processed": int(df["tournament_id"].nunique()),
        "player_tournament_records": int(len(df)),
        "feature_count": int(df.shape[1]),
    }
    config.STATS_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    return {
        "player_stats": config.STATS_PARQUET,
        "tournament_baselines": config.TOURNAMENT_BASELINES_PARQUET,
        "era_baselines": config.ERA_BASELINES_PARQUET,
        "feature_dictionary": config.FEATURE_DICTIONARY,
        "manifest": config.STATS_MANIFEST,
    }
