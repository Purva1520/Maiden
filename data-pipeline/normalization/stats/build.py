"""Assemble the Phase 4 player × tournament statistics dataset.

Population = the Phase 2 `tournament_squads` (canonical historical squads, §7).
Each squad row is left-joined with computed batting/bowling statistics, so a
selected player who never batted/bowled is still represented — with explicit
participation, sample-size and coverage metadata rather than fake zeros.
"""

from __future__ import annotations

import sqlite3

import pandas as pd

from . import aggregate, baselines, coverage, features
from .config import (
    BATTING_SAMPLE_VALID_INNINGS,
    BOWLING_SAMPLE_VALID_INNINGS,
    era_for,
)

# Integer count columns that are genuinely zero when there was no opportunity.
_COUNT_COLS = [
    "bat_innings",
    "bat_runs",
    "bat_balls",
    "bat_fours",
    "bat_sixes",
    "bat_dismissals",
    "bat_not_outs",
    "bat_fifties",
    "bat_hundreds",
    "bat_boundary_runs",
    "bowl_innings",
    "bowl_balls",
    "bowl_runs_conceded",
    "bowl_wickets",
    "bowl_five_wickets",
    "bowl_maidens",
    "matches_played",
]


def _sample_status(innings: int, valid: int) -> str:
    if innings <= 0:
        return "NONE"
    return "LOW" if innings < valid else "VALID"


def build(conn: sqlite3.Connection, formats: set[str] | None = None) -> dict[str, pd.DataFrame]:
    """Build all Phase 4 frames. Returns player_stats, baselines, eras, etc.

    `formats` optionally restricts to {"ODI"} / {"T20"} (default: both).
    """
    tmap = coverage.build_tournament_match_map(conn)
    if formats:
        prefixes = tuple(f"{f}_" for f in formats)
        tmap = {tid: mids for tid, mids in tmap.items() if tid.startswith(prefixes)}
    coverage.create_temp_map_table(conn, tmap)
    cov = coverage.compute_coverage(conn, tmap)

    frames = aggregate.load_frames(conn)
    bat, _ = aggregate.compute_batting(frames["deliveries"], frames["wickets"])
    bowl, _ = aggregate.compute_bowling(frames["deliveries"], frames["wickets"])
    mp = aggregate.compute_matches_played(frames["match_players"])

    # Population: every tournament squad row, with tournament + team context.
    pop = pd.read_sql_query(
        """
        SELECT ts.tournament_id, t.year, t.format, ts.team_id, ts.player_id,
               ts.participated, ts.role, ts.wicketkeeper, tm.team_name,
               p.display_name AS player_name
        FROM tournament_squads ts
        JOIN tournaments t        ON ts.tournament_id = t.tournament_id
        JOIN tournament_teams tm  ON ts.tournament_id = tm.tournament_id AND ts.team_id = tm.team_id
        JOIN players p            ON ts.player_id = p.player_id
        """,
        conn,
    )
    pop = pop[pop["tournament_id"].isin(tmap.keys())].reset_index(drop=True)

    df = pop.merge(bat, on=["tournament_id", "player_id"], how="left")
    df = df.merge(bowl, on=["tournament_id", "player_id"], how="left")
    df = df.merge(mp, on=["tournament_id", "player_id"], how="left")

    for col in _COUNT_COLS:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(int)

    df = aggregate.add_batting_derived(df)
    df = aggregate.add_bowling_derived(df)

    # Participation states (kept distinct, §8).
    df["squad_member"] = True
    df["participated"] = df["participated"].astype(bool)
    df["batted"] = df["bat_innings"] > 0
    df["bowled"] = df["bowl_innings"] > 0

    # Sample-size and coverage metadata.
    df["batting_sample_status"] = df["bat_innings"].apply(
        lambda n: _sample_status(n, BATTING_SAMPLE_VALID_INNINGS)
    )
    df["bowling_sample_status"] = df["bowl_innings"].apply(
        lambda n: _sample_status(n, BOWLING_SAMPLE_VALID_INNINGS)
    )
    df["tournament_coverage_status"] = df["tournament_id"].map(
        {tid: c.status for tid, c in cov.items()}
    )
    # Ball-by-ball data quality follows coverage (no data => INSUFFICIENT).
    df["batting_data_quality"] = df["tournament_coverage_status"]
    df["bowling_data_quality"] = df["tournament_coverage_status"]

    # Era context.
    df["era_id"] = [era_for(f, int(y)) for f, y in zip(df["format"], df["year"], strict=True)]

    # Normalized features (tournament + era).
    df = features.add_normalized_features(df)

    # Tidy types.
    df["team_id"] = df["team_id"].astype(str)
    df["year"] = df["year"].astype(int)

    tournament_baselines = baselines.compute_tournament_baselines(df)
    era_baselines = baselines.compute_era_baselines(df)
    environment = baselines.environment_summary(df)
    coverage_df = pd.DataFrame([c.__dict__ for c in cov.values()])

    return {
        "player_stats": df,
        "tournament_baselines": tournament_baselines,
        "era_baselines": era_baselines,
        "environment": environment,
        "coverage": coverage_df,
    }
