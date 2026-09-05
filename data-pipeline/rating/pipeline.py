"""Rating generation pipeline: Phase 4 features -> 0-99 Maiden ratings + export."""

from __future__ import annotations

import json
import sqlite3

import pandas as pd

from core import config

from . import batting_model, bowling_model, calibration
from .versions import RATING_MODEL_VERSION, RatingConfig, load_config

# Phase 4 sample_status -> rating status.
_STATUS_MAP = {"VALID": "FULL", "LOW": "LOW_SAMPLE", "NONE": "UNOBSERVED"}

_SORT = ["format", "year", "tournament_id", "team_id", "player_id"]

_TABLE_COLS = [
    "player_id",
    "player",
    "format",
    "tournament_id",
    "year",
    "team_id",
    "role",
    "bat_rating",
    "bowl_rating",
    "bat_latent_shrunk",
    "bowl_latent_shrunk",
    "bat_confidence",
    "bowl_confidence",
    "bat_sample_status",
    "bowl_sample_status",
    "coverage_status",
    "bat_rating_status",
    "bowl_rating_status",
    "rating_model_version",
    "statistics_version",
    "normalization_version",
    "calibration_version",
]


def build_ratings(cfg: RatingConfig, stats_df: pd.DataFrame | None = None) -> pd.DataFrame:
    """Compute the ratings dataframe from the Phase 4 statistics dataset."""
    df = stats_df if stats_df is not None else pd.read_parquet(config.STATS_PARQUET)

    bat = batting_model.compute_latent(df, cfg.batting)
    bowl = bowling_model.compute_latent(df, cfg.bowling)

    group_bat = (df["format"] + "_batting").where(bat["bat_latent_shrunk"].notna())
    group_bowl = (df["format"] + "_bowling").where(bowl["bowl_latent_shrunk"].notna())
    targets = cfg.calibration["targets"]
    clip = cfg.calibration["clip"]

    bat_rating = calibration.calibrate(bat["bat_latent_shrunk"], group_bat, targets, clip)
    bowl_rating = calibration.calibrate(bowl["bowl_latent_shrunk"], group_bowl, targets, clip)

    out = pd.DataFrame(
        {
            "player_id": df["player_id"],
            "player": df["player_name"],
            "format": df["format"],
            "tournament_id": df["tournament_id"],
            "year": df["year"].astype(int),
            "team_id": df["team_id"].astype(str),
            "team_name": df["team_name"],
            "role": df["role"],
            "bat_rating": bat_rating.astype("Int64"),
            "bowl_rating": bowl_rating.astype("Int64"),
            "bat_latent": bat["bat_latent"],
            "bat_latent_shrunk": bat["bat_latent_shrunk"],
            "bowl_latent": bowl["bowl_latent"],
            "bowl_latent_shrunk": bowl["bowl_latent_shrunk"],
            "bat_confidence": bat["bat_confidence"],
            "bowl_confidence": bowl["bowl_confidence"],
            "bat_sample_status": df["batting_sample_status"],
            "bowl_sample_status": df["bowling_sample_status"],
            "coverage_status": df["tournament_coverage_status"],
            "bat_rating_status": df["batting_sample_status"].map(_STATUS_MAP),
            "bowl_rating_status": df["bowling_sample_status"].map(_STATUS_MAP),
            "rating_model_version": cfg.model_version,
            "statistics_version": str(cfg.statistics_version),
            "normalization_version": str(cfg.normalization_version),
            "calibration_version": cfg.calibration_version,
        }
    )
    return out.sort_values(_SORT).reset_index(drop=True)


def _card_records(df: pd.DataFrame) -> list[dict]:
    def _int_or_none(v):
        return int(v) if pd.notna(v) else None

    return [
        {
            "playerId": r["player_id"],
            "player": r["player"],
            "format": r["format"],
            "tournamentId": r["tournament_id"],
            "year": int(r["year"]),
            "team": r["team_name"],
            "role": r["role"],
            "batRating": _int_or_none(r["bat_rating"]),
            "bowlRating": _int_or_none(r["bowl_rating"]),
            "ratingVersion": r["rating_model_version"],
        }
        for _, r in df.iterrows()
    ]


def _write_sqlite_table(conn: sqlite3.Connection, df: pd.DataFrame) -> None:
    """(Re)create the player_ratings table without touching other tables."""
    conn.execute("DROP TABLE IF EXISTS player_ratings")
    conn.execute(
        """
        CREATE TABLE player_ratings (
            player_id             TEXT NOT NULL,
            player                TEXT,
            format                TEXT NOT NULL,
            tournament_id         TEXT NOT NULL,
            year                  INTEGER,
            team_id               TEXT,
            role                  TEXT,
            bat_rating            INTEGER,
            bowl_rating           INTEGER,
            bat_latent_shrunk     REAL,
            bowl_latent_shrunk    REAL,
            bat_confidence        TEXT,
            bowl_confidence       TEXT,
            bat_sample_status     TEXT,
            bowl_sample_status    TEXT,
            coverage_status       TEXT,
            bat_rating_status     TEXT,
            bowl_rating_status    TEXT,
            rating_model_version  TEXT,
            statistics_version    TEXT,
            normalization_version TEXT,
            calibration_version   TEXT,
            PRIMARY KEY (player_id, tournament_id, team_id, format)
        )
        """
    )
    rows = [
        tuple(
            None if pd.isna(v) else (int(v) if col in ("bat_rating", "bowl_rating") else v)
            for col, v in zip(_TABLE_COLS, (r[c] for c in _TABLE_COLS), strict=True)
        )
        for _, r in df.iterrows()
    ]
    placeholders = ",".join("?" for _ in _TABLE_COLS)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_player_ratings_player ON player_ratings (player_id)"
    )
    conn.executemany(
        f"INSERT INTO player_ratings ({','.join(_TABLE_COLS)}) VALUES ({placeholders})", rows
    )
    conn.commit()


def write_outputs(df: pd.DataFrame, cfg: RatingConfig, db_path=None) -> dict:
    """Write parquet, ratings_<version>.json, and the SQLite player_ratings table."""
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(config.PLAYER_RATINGS_PARQUET, index=False)

    ratings_json = config.ratings_json(cfg.model_version)
    ratings_json.write_text(json.dumps(_card_records(df), indent=2) + "\n", encoding="utf-8")

    db = db_path or config.DB_PATH
    if db.exists():
        conn = sqlite3.connect(db)
        try:
            _write_sqlite_table(conn, df)
        finally:
            conn.close()

    return {
        "player_ratings_parquet": config.PLAYER_RATINGS_PARQUET,
        "ratings_json": ratings_json,
    }


def generate(version: str = RATING_MODEL_VERSION, db_path=None) -> pd.DataFrame:
    """Full pipeline: load config, build ratings, write outputs."""
    cfg = load_config(version)
    df = build_ratings(cfg)
    write_outputs(df, cfg, db_path=db_path)
    return df
