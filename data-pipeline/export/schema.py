"""SQLite schema for the Maiden normalized cricket database.

Design goals: normalized (no giant denormalized delivery blob), loss-aware
(source detail preserved), and query-friendly (common joins stay simple). See
docs/data-schema.md for the full documentation and ER diagram.

Booleans are stored as INTEGER 0/1. Unknown values are stored as NULL and are
distinguishable from genuine zeros/empties.
"""

from __future__ import annotations

import sqlite3

# One statement per table. Foreign keys declare the relational structure; during
# bulk load FK enforcement is disabled for speed and integrity is verified at the
# end via PRAGMA foreign_key_check.
SCHEMA_STATEMENTS: tuple[str, ...] = (
    # -- pipeline metadata (reproducibility) --------------------------------
    """
    CREATE TABLE pipeline_metadata (
        key   TEXT PRIMARY KEY,
        value TEXT
    )
    """,
    # -- canonical entities -------------------------------------------------
    """
    CREATE TABLE teams (
        team_id        INTEGER PRIMARY KEY,
        source_name    TEXT NOT NULL,
        canonical_name TEXT NOT NULL UNIQUE,
        display_name   TEXT NOT NULL
    )
    """,
    # -- Phase 3 canonical players ------------------------------------------
    """
    CREATE TABLE players (
        player_id      TEXT PRIMARY KEY,       -- deterministic slug e.g. 'sachin_tendulkar'
        canonical_name TEXT NOT NULL,          -- formal preferred identity
        display_name   TEXT NOT NULL,          -- UI display name
        registry_id    TEXT UNIQUE,            -- Cricsheet person id (backward-compat)
        cricsheet_id   TEXT UNIQUE,            -- Cricsheet stable person id (nullable)
        country_id     TEXT,                   -- primary international country/team (nullable)
        active_from    INTEGER,                -- earliest appearance year (nullable)
        active_to      INTEGER                 -- latest appearance year (nullable)
    )
    """,
    """
    CREATE TABLE player_aliases (
        alias_id         INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id        TEXT NOT NULL,
        alias            TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        source           TEXT NOT NULL,         -- cricsheet|wikipedia|manual
        source_reference TEXT,
        FOREIGN KEY (player_id) REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE player_identifiers (
        identifier_id    INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id        TEXT NOT NULL,
        identifier_type  TEXT NOT NULL,         -- cricsheet|cricinfo|bcci|etc.
        identifier_value TEXT NOT NULL,
        source           TEXT NOT NULL,
        source_reference TEXT,
        UNIQUE (identifier_type, identifier_value),
        FOREIGN KEY (player_id) REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE player_resolution_log (
        record_id           INTEGER PRIMARY KEY AUTOINCREMENT,
        source              TEXT NOT NULL,
        raw_name            TEXT NOT NULL,
        normalized_name     TEXT NOT NULL,
        candidate_player_id TEXT,
        resolution_method   TEXT NOT NULL,     -- identifier|exact|alias|context|manual|unresolved
        resolution_status   TEXT NOT NULL,     -- RESOLVED_* | REVIEW | UNRESOLVED
        confidence          TEXT NOT NULL,     -- HIGH|MEDIUM|LOW|NONE
        reason              TEXT,
        reviewed            INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (candidate_player_id) REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE team_aliases (
        alias_id         INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id          INTEGER NOT NULL,
        alias            TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        source           TEXT,
        FOREIGN KEY (team_id) REFERENCES teams (team_id)
    )
    """,
    """
    CREATE TABLE tournament_aliases (
        alias_id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id    TEXT NOT NULL,
        alias            TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        source           TEXT,
        FOREIGN KEY (tournament_id) REFERENCES tournaments (tournament_id)
    )
    """,
    """
    CREATE TABLE events (
        event_id    INTEGER PRIMARY KEY,
        source_name TEXT NOT NULL,
        event_name  TEXT NOT NULL UNIQUE,
        event_type  TEXT                     -- NULL in Phase 1 (classification is future)
    )
    """,
    # -- matches ------------------------------------------------------------
    """
    CREATE TABLE matches (
        match_id             TEXT PRIMARY KEY,   -- Cricsheet match id (file stem)
        source               TEXT NOT NULL,      -- 'cricsheet'
        source_file          TEXT NOT NULL,      -- archive member, e.g. '1000887.json'
        format               TEXT NOT NULL,      -- canonical: 'ODI' | 'T20'
        match_type           TEXT,               -- raw Cricsheet match_type
        gender               TEXT,
        team_type            TEXT,
        balls_per_over       INTEGER,
        overs                INTEGER,            -- scheduled overs per innings
        season               TEXT,
        event_id             INTEGER,
        event_match_number   INTEGER,
        event_group          TEXT,
        event_stage          TEXT,
        venue                TEXT,
        city                 TEXT,
        start_date           TEXT,               -- earliest date, YYYY-MM-DD
        end_date             TEXT,               -- latest date, YYYY-MM-DD
        team_1_id            INTEGER NOT NULL,
        team_2_id            INTEGER NOT NULL,
        toss_winner_id       INTEGER,
        toss_decision        TEXT,               -- 'bat' | 'field'
        toss_uncontested     INTEGER,            -- 0/1/NULL
        outcome_winner_id    INTEGER,
        result_type          TEXT,               -- runs|wickets|innings|tie|draw|no result|elim.
        result_margin        INTEGER,
        result_by_innings    INTEGER NOT NULL DEFAULT 0,
        result_method        TEXT,               -- e.g. 'D/L'
        eliminator_winner_id INTEGER,
        result_text          TEXT,
        player_of_match_id   TEXT,
        data_version         TEXT,
        revision             INTEGER,
        created              TEXT,
        FOREIGN KEY (event_id)             REFERENCES events (event_id),
        FOREIGN KEY (team_1_id)            REFERENCES teams (team_id),
        FOREIGN KEY (team_2_id)            REFERENCES teams (team_id),
        FOREIGN KEY (toss_winner_id)       REFERENCES teams (team_id),
        FOREIGN KEY (outcome_winner_id)    REFERENCES teams (team_id),
        FOREIGN KEY (eliminator_winner_id) REFERENCES teams (team_id),
        FOREIGN KEY (player_of_match_id)   REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE match_dates (
        match_id   TEXT NOT NULL,
        date       TEXT NOT NULL,               -- YYYY-MM-DD
        date_order INTEGER NOT NULL,            -- 0-based
        PRIMARY KEY (match_id, date_order),
        FOREIGN KEY (match_id) REFERENCES matches (match_id)
    )
    """,
    """
    CREATE TABLE match_players (
        match_player_id INTEGER PRIMARY KEY,
        match_id        TEXT NOT NULL,
        team_id         INTEGER NOT NULL,
        player_id       TEXT NOT NULL,
        playing_xi      INTEGER NOT NULL DEFAULT 1,  -- listed in the team's players
        UNIQUE (match_id, player_id),
        FOREIGN KEY (match_id)  REFERENCES matches (match_id),
        FOREIGN KEY (team_id)   REFERENCES teams (team_id),
        FOREIGN KEY (player_id) REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE match_officials (
        match_official_id INTEGER PRIMARY KEY,
        match_id          TEXT NOT NULL,
        role              TEXT NOT NULL,        -- umpire|tv_umpire|match_referee|reserve_umpire
        official_name     TEXT NOT NULL,
        official_order    INTEGER NOT NULL,     -- 0-based within role
        FOREIGN KEY (match_id) REFERENCES matches (match_id)
    )
    """,
    # -- ball-by-ball (innings -> overs -> deliveries) ---------------------
    """
    CREATE TABLE innings (
        innings_id     INTEGER PRIMARY KEY,
        match_id       TEXT NOT NULL,
        innings_number INTEGER NOT NULL,        -- 1, 2, ...
        team_id        INTEGER NOT NULL,        -- batting team
        is_super_over  INTEGER NOT NULL DEFAULT 0,
        is_declared    INTEGER NOT NULL DEFAULT 0,
        is_forfeited   INTEGER NOT NULL DEFAULT 0,
        target_runs    INTEGER,
        target_overs   REAL,
        penalty_pre    INTEGER,
        penalty_post   INTEGER,
        UNIQUE (match_id, innings_number),
        FOREIGN KEY (match_id) REFERENCES matches (match_id),
        FOREIGN KEY (team_id)  REFERENCES teams (team_id)
    )
    """,
    """
    CREATE TABLE overs (
        over_id        INTEGER PRIMARY KEY,
        innings_id     INTEGER NOT NULL,
        over_number    INTEGER NOT NULL,        -- 0-based: 0, 1, 2, ...
        delivery_count INTEGER NOT NULL,        -- deliveries recorded in this over
        UNIQUE (innings_id, over_number),
        FOREIGN KEY (innings_id) REFERENCES innings (innings_id)
    )
    """,
    """
    CREATE TABLE deliveries (
        delivery_id     INTEGER PRIMARY KEY,
        over_id         INTEGER NOT NULL,
        delivery_number INTEGER NOT NULL,       -- 0-based order within the over
        batter_id       TEXT NOT NULL,
        non_striker_id  TEXT NOT NULL,
        bowler_id       TEXT NOT NULL,
        batter_runs     INTEGER NOT NULL,
        extra_runs      INTEGER NOT NULL,
        total_runs      INTEGER NOT NULL,
        non_boundary    INTEGER NOT NULL DEFAULT 0,
        is_wicket       INTEGER NOT NULL DEFAULT 0,
        UNIQUE (over_id, delivery_number),
        FOREIGN KEY (over_id)        REFERENCES overs (over_id),
        FOREIGN KEY (batter_id)      REFERENCES players (player_id),
        FOREIGN KEY (non_striker_id) REFERENCES players (player_id),
        FOREIGN KEY (bowler_id)      REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE delivery_extras (
        delivery_id INTEGER NOT NULL,
        extra_type  TEXT NOT NULL,              -- wides|noballs|byes|legbyes|penalty
        runs        INTEGER NOT NULL,
        PRIMARY KEY (delivery_id, extra_type),
        FOREIGN KEY (delivery_id) REFERENCES deliveries (delivery_id)
    )
    """,
    """
    CREATE TABLE delivery_wickets (
        wicket_id      INTEGER PRIMARY KEY,
        delivery_id    INTEGER NOT NULL,
        wicket_order   INTEGER NOT NULL,        -- 0-based (a delivery may have >1)
        player_out_id  TEXT NOT NULL,
        dismissal_kind TEXT NOT NULL,
        FOREIGN KEY (delivery_id)   REFERENCES deliveries (delivery_id),
        FOREIGN KEY (player_out_id) REFERENCES players (player_id)
    )
    """,
    """
    CREATE TABLE wicket_fielders (
        wicket_fielder_id INTEGER PRIMARY KEY,
        wicket_id         INTEGER NOT NULL,
        fielder_id        TEXT,                -- NULL if unresolved (e.g. substitute)
        fielder_name      TEXT NOT NULL,
        is_substitute     INTEGER NOT NULL DEFAULT 0,
        fielder_order     INTEGER NOT NULL,
        FOREIGN KEY (wicket_id)  REFERENCES delivery_wickets (wicket_id),
        FOREIGN KEY (fielder_id) REFERENCES players (player_id)
    )
    """,
    # -- Phase 2: World Cup tournament tables --------------------------------
    """
    CREATE TABLE tournaments (
        tournament_id   TEXT PRIMARY KEY,
        year            INTEGER NOT NULL,
        format          TEXT NOT NULL,       -- 'ODI' | 'T20'
        name            TEXT NOT NULL,
        display_name    TEXT NOT NULL,
        edition_number  INTEGER NOT NULL,
        status          TEXT NOT NULL DEFAULT 'completed',
        source          TEXT NOT NULL        -- cricsheet|wikipedia|manual
    )
    """,
    """
    CREATE TABLE tournament_teams (
        tournament_id    TEXT NOT NULL,
        team_id          INTEGER NOT NULL,
        team_name        TEXT NOT NULL,
        source           TEXT NOT NULL,
        source_reference TEXT,
        PRIMARY KEY (tournament_id, team_id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments (tournament_id),
        FOREIGN KEY (team_id) REFERENCES teams (team_id)
    )
    """,
    """
    CREATE TABLE tournament_squads (
        tournament_id        TEXT NOT NULL,
        team_id              INTEGER NOT NULL,
        player_id            TEXT NOT NULL,
        role                 TEXT NOT NULL,         -- BAT|BOWL|ALLROUNDER|WK
        wicketkeeper         INTEGER NOT NULL,      -- 0/1
        participated         INTEGER NOT NULL,      -- 0/1
        squad_order          INTEGER,
        source               TEXT NOT NULL,         -- cricsheet|wikipedia|manual
        source_reference     TEXT,
        source_notes         TEXT,
        original_player_name TEXT,
        original_team_name   TEXT,
        PRIMARY KEY (tournament_id, team_id, player_id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments (tournament_id),
        FOREIGN KEY (tournament_id, team_id) REFERENCES tournament_teams (tournament_id, team_id),
        FOREIGN KEY (team_id) REFERENCES teams (team_id),
        FOREIGN KEY (player_id) REFERENCES players (player_id)
    )
    """,
)

# Indexes are created AFTER bulk loading (faster) — see docs/data-schema.md for
# the rationale behind each one.
INDEX_STATEMENTS: tuple[str, ...] = (
    "CREATE INDEX idx_matches_date ON matches (start_date)",
    "CREATE INDEX idx_matches_format ON matches (format)",
    "CREATE INDEX idx_matches_event ON matches (event_id)",
    "CREATE INDEX idx_match_dates_match ON match_dates (match_id)",
    "CREATE INDEX idx_match_players_match ON match_players (match_id)",
    "CREATE INDEX idx_match_players_player ON match_players (player_id)",
    "CREATE INDEX idx_match_officials_match ON match_officials (match_id)",
    "CREATE INDEX idx_innings_match ON innings (match_id)",
    "CREATE INDEX idx_innings_team ON innings (team_id)",
    "CREATE INDEX idx_overs_innings ON overs (innings_id)",
    "CREATE INDEX idx_deliveries_over ON deliveries (over_id)",
    "CREATE INDEX idx_deliveries_batter ON deliveries (batter_id)",
    "CREATE INDEX idx_deliveries_non_striker ON deliveries (non_striker_id)",
    "CREATE INDEX idx_deliveries_bowler ON deliveries (bowler_id)",
    "CREATE INDEX idx_delivery_extras_delivery ON delivery_extras (delivery_id)",
    "CREATE INDEX idx_delivery_wickets_delivery ON delivery_wickets (delivery_id)",
    "CREATE INDEX idx_delivery_wickets_player ON delivery_wickets (player_out_id)",
    "CREATE INDEX idx_wicket_fielders_wicket ON wicket_fielders (wicket_id)",
    # Phase 2
    "CREATE INDEX idx_tournament_teams_tournament ON tournament_teams (tournament_id)",
    "CREATE INDEX idx_tournament_squads_tournament ON tournament_squads (tournament_id)",
    "CREATE INDEX idx_tournament_squads_player ON tournament_squads (player_id)",
    "CREATE INDEX idx_tournament_squads_team ON tournament_squads (team_id)",
    # Phase 3
    "CREATE INDEX idx_player_aliases_norm ON player_aliases (normalized_alias)",
    "CREATE INDEX idx_player_aliases_player ON player_aliases (player_id)",
    (
        "CREATE INDEX idx_player_identifiers_lookup "
        "ON player_identifiers (identifier_type, identifier_value)"
    ),
    "CREATE INDEX idx_player_identifiers_player ON player_identifiers (player_id)",
    "CREATE INDEX idx_players_canonical ON players (canonical_name)",
    "CREATE INDEX idx_players_cricsheet ON players (cricsheet_id)",
    "CREATE INDEX idx_player_res_log_status ON player_resolution_log (resolution_status)",
    "CREATE INDEX idx_team_aliases_norm ON team_aliases (normalized_alias)",
    "CREATE INDEX idx_tournament_aliases_norm ON tournament_aliases (normalized_alias)",
)

TABLE_NAMES: tuple[str, ...] = (
    "pipeline_metadata",
    "teams",
    "players",
    "player_aliases",
    "player_identifiers",
    "player_resolution_log",
    "team_aliases",
    "tournament_aliases",
    "events",
    "matches",
    "match_dates",
    "match_players",
    "match_officials",
    "innings",
    "overs",
    "deliveries",
    "delivery_extras",
    "delivery_wickets",
    "wicket_fielders",
    "tournaments",
    "tournament_teams",
    "tournament_squads",
)


def apply_build_pragmas(conn: sqlite3.Connection) -> None:
    """Speed-oriented pragmas for the bulk-load phase (integrity checked later)."""
    conn.execute("PRAGMA journal_mode = OFF")
    conn.execute("PRAGMA synchronous = OFF")
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute("PRAGMA cache_size = -100000")  # ~100 MB page cache


def create_schema(conn: sqlite3.Connection) -> None:
    for stmt in SCHEMA_STATEMENTS:
        conn.execute(stmt)


def create_indexes(conn: sqlite3.Connection) -> None:
    for stmt in INDEX_STATEMENTS:
        conn.execute(stmt)
