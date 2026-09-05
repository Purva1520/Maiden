"""World Cup tournament universe — Phase 2 normalization.

Reads curated JSON source files (``data/game/world_cups/``) and writes the
three Phase 2 tables (``tournaments``, ``tournament_teams``,
``tournament_squads``) into the Maiden SQLite database.

Player and team names are resolved against the existing Phase 1 canonical
tables; new records are created for historical entities absent from Cricsheet.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from cleaning.names import (
    generate_player_id,
    normalize_name_for_matching,
    normalize_person_name,
    normalize_team_name,
)
from cleaning.teams import get_canonical_team_aliases
from core import config
from core.logging_setup import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VALID_ROLES = frozenset({"BAT", "BOWL", "ALLROUNDER", "WK"})
VALID_SOURCES = frozenset({"cricsheet", "wikipedia", "manual"})

REQUIRED_TOURNAMENT_FIELDS = {
    "tournament_id",
    "year",
    "format",
    "name",
    "display_name",
    "edition_number",
    "source",
}
REQUIRED_TEAM_FIELDS = {"tournament_id", "team_name", "source"}
REQUIRED_SQUAD_FIELDS = {
    "tournament_id",
    "year",
    "format",
    "team",
    "player",
    "role",
    "wicketkeeper",
    "participated",
    "source",
}


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------
def load_tournaments(path: Path | None = None) -> list[dict]:
    """Load the canonical tournament list from JSON."""
    path = path or config.WORLD_CUP_DIR / "tournaments.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_teams(path: Path | None = None) -> list[dict]:
    """Load tournament-team mappings from JSON."""
    path = path or config.WORLD_CUP_DIR / "teams.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_curated_squads(path: Path | None = None) -> list[dict]:
    """Load the curated squad data from JSON."""
    path = path or config.WORLD_CUP_DIR / "curated_squads.json"
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_curated_data(
    tournaments: list[dict],
    teams: list[dict],
    squads: list[dict],
) -> tuple[list[str], list[str]]:
    """Pre-insertion validation of the curated JSON data.

    Returns ``(errors, warnings)`` — both are lists of human-readable strings.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # --- Tournament counts ---
    tournament_ids = {t["tournament_id"] for t in tournaments}
    odi_count = sum(1 for t in tournaments if t["format"] == "ODI")
    t20_count = sum(1 for t in tournaments if t["format"] == "T20")

    if len(tournament_ids) != len(tournaments):
        errors.append("Duplicate tournament IDs found")
    if odi_count != 13:
        errors.append(f"Expected 13 ODI tournaments, got {odi_count}")
    if t20_count != 9:
        errors.append(f"Expected 9 T20 tournaments, got {t20_count}")
    if len(tournaments) != 22:
        errors.append(f"Expected 22 tournaments, got {len(tournaments)}")

    for t in tournaments:
        missing = REQUIRED_TOURNAMENT_FIELDS - t.keys()
        if missing:
            errors.append(f"Tournament {t.get('tournament_id', '?')} missing fields: {missing}")
        if t.get("source") and t["source"] not in VALID_SOURCES:
            errors.append(f"Tournament {t['tournament_id']} invalid source: {t['source']}")

    # --- Team mappings ---
    team_keys: set[tuple[str, str]] = set()
    for t in teams:
        missing = REQUIRED_TEAM_FIELDS - t.keys()
        if missing:
            errors.append(f"Team entry missing fields: {missing}")
            continue
        key = (t["tournament_id"], t["team_name"])
        if key in team_keys:
            errors.append(f"Duplicate team entry: {key}")
        team_keys.add(key)
        if t["tournament_id"] not in tournament_ids:
            errors.append(f"Team references unknown tournament: {t['tournament_id']}")
        if t["source"] not in VALID_SOURCES:
            errors.append(f"Team invalid source: {t['source']} for {key}")

    # --- Squad records ---
    squad_keys: set[tuple[str, str, str]] = set()
    for s in squads:
        missing = REQUIRED_SQUAD_FIELDS - s.keys()
        if missing:
            errors.append(f"Squad entry missing fields: {missing}")
            continue

        key = (s["tournament_id"], s["team"], s["player"])
        if key in squad_keys:
            errors.append(f"Duplicate squad entry: {key}")
        squad_keys.add(key)

        if s["tournament_id"] not in tournament_ids:
            errors.append(f"Squad references unknown tournament: {s['tournament_id']}")

        team_key = (s["tournament_id"], s["team"])
        if team_key not in team_keys:
            errors.append(f"Squad references unknown team: {s['team']} in {s['tournament_id']}")

        if s["role"] not in VALID_ROLES:
            errors.append(f"Invalid role '{s['role']}' for {s['player']} in {s['tournament_id']}")

        if s["source"] not in VALID_SOURCES:
            errors.append(
                f"Invalid source '{s['source']}' for {s['player']} in {s['tournament_id']}"
            )

        # Wicketkeeper consistency
        if s["role"] == "WK" and not s["wicketkeeper"]:
            warnings.append(
                f"role=WK but wicketkeeper=false: {s['player']} in {s['tournament_id']}"
            )
        if s["wicketkeeper"] and s["role"] != "WK":
            warnings.append(
                f"wicketkeeper=true but role={s['role']}: {s['player']} in {s['tournament_id']}"
            )

    # --- Coverage: every tournament must have teams and squads ---
    for tid in tournament_ids:
        tc = sum(1 for t in teams if t["tournament_id"] == tid)
        sc = sum(1 for s in squads if s["tournament_id"] == tid)
        if tc == 0:
            errors.append(f"Tournament {tid} has no teams")
        if sc == 0:
            errors.append(f"Tournament {tid} has no squad records")

    return errors, warnings


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
@dataclass
class WorldCupBuildStats:
    """Counters accumulated during the Phase 2 build."""

    tournaments: int = 0
    tournament_teams: int = 0
    squad_records: int = 0
    new_teams_created: int = 0
    new_players_created: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class WorldCupBuilder:
    """Write Phase 2 and Phase 3 tables into an existing ``maiden.sqlite``."""

    def __init__(self, conn: sqlite3.Connection, resolver: Any | None = None) -> None:
        self.conn = conn
        self.resolver = resolver
        self.stats = WorldCupBuildStats()
        self._team_cache: dict[str, int] = {}  # lower(canonical) -> team_id
        self._player_cache: dict[str, str] = {}  # lower(canonical) -> player_id string
        self._next_team_id: int = 1

    # -- entity resolution ---------------------------------------------------
    def _load_existing_entities(self) -> None:
        """Cache teams/players already present."""
        try:
            rows = self.conn.execute("SELECT team_id, canonical_name FROM teams").fetchall()
            for tid, name in rows:
                self._team_cache[name.lower()] = tid
            if rows:
                self._next_team_id = max(tid for tid, _ in rows) + 1
        except sqlite3.OperationalError:
            pass  # teams table doesn't exist yet

        try:
            rows = self.conn.execute("SELECT player_id, canonical_name FROM players").fetchall()
            for pid, name in rows:
                self._player_cache[name.lower()] = str(pid)
        except sqlite3.OperationalError:
            pass  # players table doesn't exist yet

    def _resolve_team(self, team_name: str) -> int:
        """Find or create a team record, return its ``team_id``."""
        canonical = normalize_team_name(team_name)
        key = canonical.lower()
        tid = self._team_cache.get(key)
        if tid is not None:
            return tid
        tid = self._next_team_id
        self._next_team_id += 1
        self.conn.execute(
            "INSERT INTO teams (team_id, source_name, canonical_name, display_name) "
            "VALUES (?, ?, ?, ?)",
            (tid, team_name, canonical, canonical),
        )
        self._team_cache[key] = tid
        self.stats.new_teams_created += 1

        # Add aliases into team_aliases
        for alias, canon in get_canonical_team_aliases().items():
            if canon.lower() == canonical.lower():
                try:
                    self.conn.execute(
                        "INSERT INTO team_aliases (team_id, alias, normalized_alias, source) "
                        "VALUES (?, ?, ?, ?)",
                        (tid, alias, alias.lower(), "canonical_alias"),
                    )
                except sqlite3.OperationalError:
                    pass

        logger.debug("Created new team: [%d] %s", tid, canonical)
        return tid

    def _resolve_player(
        self,
        player_name: str,
        team: str | None = None,
        year: int | None = None,
        fmt: str | None = None,
        source: str = "wikipedia",
        source_ref: str | None = None,
    ) -> str:
        """Find or create a player record, return its ``player_id``."""
        canonical = normalize_person_name(player_name)
        key = canonical.lower()
        pid = self._player_cache.get(key)
        if pid is not None:
            return pid

        if self.resolver:
            res = self.resolver.resolve(
                player_name,
                team=team,
                year=year,
                format=fmt,
                source=source,
                source_ref=source_ref,
            )
            if res.player:
                pid = res.player.player_id
                self.conn.execute(
                    "INSERT OR IGNORE INTO players ("
                    "player_id, canonical_name, display_name, cricsheet_id, country_id, "
                    "active_from, active_to) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        pid,
                        res.player.canonical_name,
                        res.player.display_name,
                        res.player.cricsheet_id,
                        res.player.country_id or team,
                        res.player.active_from or year,
                        res.player.active_to or year,
                    ),
                )
                # Record alias
                try:
                    self.conn.execute(
                        "INSERT INTO player_aliases ("
                        "player_id, alias, normalized_alias, source, source_reference) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (
                            pid,
                            player_name,
                            normalize_name_for_matching(player_name),
                            source,
                            source_ref,
                        ),
                    )
                except sqlite3.OperationalError:
                    pass

                self._player_cache[key] = pid
                return pid

        # Fallback slug generator
        pid = generate_player_id(canonical)
        self.conn.execute(
            "INSERT OR IGNORE INTO players ("
            "player_id, canonical_name, display_name, cricsheet_id, country_id, "
            "active_from, active_to) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (pid, canonical, canonical, None, team, year, year),
        )
        try:
            self.conn.execute(
                "INSERT INTO player_aliases ("
                "player_id, alias, normalized_alias, source, source_reference) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    pid,
                    player_name,
                    normalize_name_for_matching(player_name),
                    source,
                    source_ref,
                ),
            )
        except sqlite3.OperationalError:
            pass

        self._player_cache[key] = pid
        self.stats.new_players_created += 1
        return pid

    # -- build ---------------------------------------------------------------
    def build(
        self,
        tournaments: list[dict],
        teams: list[dict],
        squads: list[dict],
    ) -> WorldCupBuildStats:
        """Write all Phase 2 and Phase 3 data into the database (idempotent)."""
        self._load_existing_entities()

        # Clear existing Phase 2 data for idempotent rebuild
        for table in ("tournament_squads", "tournament_teams", "tournaments", "tournament_aliases"):
            try:
                self.conn.execute(f"DELETE FROM {table}")
            except sqlite3.OperationalError:
                pass
        self.conn.commit()

        # --- tournaments ---
        for t in tournaments:
            self.conn.execute(
                "INSERT INTO tournaments "
                "(tournament_id, year, format, name, display_name, edition_number, status, source) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    t["tournament_id"],
                    t["year"],
                    t["format"],
                    t["name"],
                    t["display_name"],
                    t["edition_number"],
                    t.get("status", "completed"),
                    t["source"],
                ),
            )
            try:
                self.conn.execute(
                    "INSERT INTO tournament_aliases ("
                    "tournament_id, alias, normalized_alias, source) "
                    "VALUES (?, ?, ?, ?)",
                    (
                        t["tournament_id"],
                        t["display_name"],
                        t["display_name"].lower(),
                        "display_name",
                    ),
                )
            except sqlite3.OperationalError:
                pass
            self.stats.tournaments += 1

        # --- tournament_teams ---
        for t in teams:
            team_id = self._resolve_team(t["team_name"])
            self.conn.execute(
                "INSERT INTO tournament_teams "
                "(tournament_id, team_id, team_name, source, source_reference) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    t["tournament_id"],
                    team_id,
                    t["team_name"],
                    t["source"],
                    t.get("source_reference"),
                ),
            )
            self.stats.tournament_teams += 1

        # --- tournament_squads ---
        for s in squads:
            team_id = self._resolve_team(s["team"])
            player_id = self._resolve_player(
                s["player"],
                team=s["team"],
                year=s["year"],
                fmt=s["format"],
                source=s.get("source", "wikipedia"),
                source_ref=s.get("source_reference"),
            )
            self.conn.execute(
                "INSERT INTO tournament_squads "
                "(tournament_id, team_id, player_id, role, wicketkeeper, participated, "
                "squad_order, source, source_reference, source_notes, "
                "original_player_name, original_team_name) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    s["tournament_id"],
                    team_id,
                    player_id,
                    s["role"],
                    1 if s["wicketkeeper"] else 0,
                    1 if s["participated"] else 0,
                    s.get("squad_order"),
                    s["source"],
                    s.get("source_reference"),
                    s.get("source_notes"),
                    s.get("original_player_name", s["player"]),
                    s.get("original_team_name", s["team"]),
                ),
            )
            self.stats.squad_records += 1

        self.conn.commit()
        logger.info(
            "World Cup build: %d tournaments, %d team entries, %d squad records "
            "(%d new teams, %d new players created)",
            self.stats.tournaments,
            self.stats.tournament_teams,
            self.stats.squad_records,
            self.stats.new_teams_created,
            self.stats.new_players_created,
        )
        return self.stats
