"""Buffered writer that turns ParsedMatch objects into normalized SQLite rows.

Responsibilities:
* allocate stable integer ids for entities and rows,
* resolve player names via the match registry (Cricsheet's stable person id),
* resolve team names within the match,
* buffer rows and flush them in batches (executemany) to bound memory.

Foreign-key enforcement is off during load (for speed); referential integrity is
verified afterwards with PRAGMA foreign_key_check in the validation layer.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from itertools import count

from cleaning.names import normalize_person_name, normalize_team_name
from core.logging_setup import get_logger
from parsers.models import ParsedMatch

logger = get_logger(__name__)

# Flush the big per-delivery buffers once this many deliveries are pending.
FLUSH_THRESHOLD = 50_000

_INSERTS = {
    "teams": (
        "INSERT INTO teams (team_id, source_name, canonical_name, display_name) VALUES (?,?,?,?)"
    ),
    "players": (
        "INSERT INTO players (player_id, registry_id, canonical_name, display_name) "
        "VALUES (?,?,?,?)"
    ),
    "events": (
        "INSERT INTO events (event_id, source_name, event_name, event_type) VALUES (?,?,?,?)"
    ),
    "matches": (
        "INSERT INTO matches (match_id, source, source_file, format, match_type, gender, "
        "team_type, balls_per_over, overs, season, event_id, event_match_number, event_group, "
        "event_stage, venue, city, start_date, end_date, team_1_id, team_2_id, toss_winner_id, "
        "toss_decision, toss_uncontested, outcome_winner_id, result_type, result_margin, "
        "result_by_innings, result_method, eliminator_winner_id, result_text, player_of_match_id, "
        "data_version, revision, created) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ),
    "match_dates": "INSERT INTO match_dates (match_id, date, date_order) VALUES (?,?,?)",
    "match_players": (
        "INSERT INTO match_players (match_player_id, match_id, team_id, player_id, playing_xi) "
        "VALUES (?,?,?,?,?)"
    ),
    "match_officials": (
        "INSERT INTO match_officials (match_official_id, match_id, role, official_name, "
        "official_order) VALUES (?,?,?,?,?)"
    ),
    "innings": (
        "INSERT INTO innings (innings_id, match_id, innings_number, team_id, is_super_over, "
        "is_declared, is_forfeited, target_runs, target_overs, penalty_pre, penalty_post) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ),
    "overs": (
        "INSERT INTO overs (over_id, innings_id, over_number, delivery_count) VALUES (?,?,?,?)"
    ),
    "deliveries": (
        "INSERT INTO deliveries (delivery_id, over_id, delivery_number, batter_id, non_striker_id, "
        "bowler_id, batter_runs, extra_runs, total_runs, non_boundary, is_wicket) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ),
    "delivery_extras": (
        "INSERT INTO delivery_extras (delivery_id, extra_type, runs) VALUES (?,?,?)"
    ),
    "delivery_wickets": (
        "INSERT INTO delivery_wickets (wicket_id, delivery_id, wicket_order, player_out_id, "
        "dismissal_kind) VALUES (?,?,?,?,?)"
    ),
    "wicket_fielders": (
        "INSERT INTO wicket_fielders (wicket_fielder_id, wicket_id, fielder_id, fielder_name, "
        "is_substitute, fielder_order) VALUES (?,?,?,?,?,?)"
    ),
}


@dataclass
class WriteStats:
    matches: int = 0
    deliveries: int = 0
    innings: int = 0
    overs: int = 0
    unresolved_players: list[dict[str, str]] = field(default_factory=list)
    # A player listed under more than one team's XI in the same match (source
    # anomaly). We keep the first team assignment and record it here.
    duplicate_match_players: list[dict[str, str]] = field(default_factory=list)


class DatabaseWriter:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

        # id sequences
        self._team_seq = count(1)
        self._player_seq = count(1)
        self._event_seq = count(1)
        self._innings_seq = count(1)
        self._over_seq = count(1)
        self._delivery_seq = count(1)
        self._wicket_seq = count(1)
        self._match_player_seq = count(1)
        self._match_official_seq = count(1)
        self._fielder_seq = count(1)

        # caches (name/key -> id); survive flushes
        self._teams: dict[str, int] = {}
        self._players_by_registry: dict[str, int] = {}
        self._players_by_name: dict[str, int] = {}
        self._events: dict[str, int] = {}

        # row buffers
        self._buf: dict[str, list[tuple]] = {name: [] for name in _INSERTS}
        self._pending_deliveries = 0

        self.stats = WriteStats()

    # -- entity get-or-create ------------------------------------------------
    def _get_or_create_team(self, source_name: str) -> int:
        canonical = normalize_team_name(source_name)
        tid = self._teams.get(canonical)
        if tid is not None:
            return tid
        tid = next(self._team_seq)
        self._teams[canonical] = tid
        self._buf["teams"].append((tid, source_name, canonical, canonical))
        return tid

    def _get_or_create_event(self, source_name: str) -> int:
        canonical = source_name.strip()
        eid = self._events.get(canonical)
        if eid is not None:
            return eid
        eid = next(self._event_seq)
        self._events[canonical] = eid
        self._buf["events"].append((eid, source_name, canonical, None))
        return eid

    def _create_player(self, registry_id: str | None, name: str) -> int:
        pid = next(self._player_seq)
        canonical = normalize_person_name(name)
        self._buf["players"].append((pid, registry_id, canonical, canonical))
        return pid

    def _get_or_create_player_by_registry(self, registry_id: str, name: str) -> int:
        pid = self._players_by_registry.get(registry_id)
        if pid is not None:
            return pid
        pid = self._create_player(registry_id, name)
        self._players_by_registry[registry_id] = pid
        return pid

    def _get_or_create_player_by_name(self, name: str) -> int:
        key = normalize_person_name(name)
        pid = self._players_by_name.get(key)
        if pid is not None:
            return pid
        pid = self._create_player(None, name)
        self._players_by_name[key] = pid
        return pid

    # -- match ingestion -----------------------------------------------------
    def add_match(self, pm: ParsedMatch) -> None:
        # Local name -> player_id map from the registry (stable Cricsheet ids).
        name_to_pid: dict[str, int] = {}
        for name, rid in pm.registry.items():
            name_to_pid[name] = self._get_or_create_player_by_registry(rid, name)

        def resolve_player(name: str, context: str) -> int:
            pid = name_to_pid.get(name)
            if pid is None:
                pid = self._get_or_create_player_by_name(name)
                name_to_pid[name] = pid
                self.stats.unresolved_players.append(
                    {"match_id": pm.match_id, "name": name, "context": context}
                )
            return pid

        team_ids = {t: self._get_or_create_team(t) for t in pm.teams}

        def resolve_team(name: str | None) -> int | None:
            if name is None:
                return None
            tid = team_ids.get(name)
            if tid is None:
                tid = self._get_or_create_team(name)
                team_ids[name] = tid
            return tid

        event_id = self._get_or_create_event(pm.event_name) if pm.event_name else None
        pom_id = (
            resolve_player(pm.player_of_match[0], "player_of_match") if pm.player_of_match else None
        )

        sorted_dates = sorted(pm.dates)
        start_date = sorted_dates[0] if sorted_dates else None
        end_date = sorted_dates[-1] if sorted_dates else None

        self._buf["matches"].append(
            (
                pm.match_id,
                "cricsheet",
                pm.source_file,
                pm.format,
                pm.match_type,
                pm.gender,
                pm.team_type,
                pm.balls_per_over,
                pm.overs,
                pm.season,
                event_id,
                pm.event_match_number,
                pm.event_group,
                pm.event_stage,
                pm.venue,
                pm.city,
                start_date,
                end_date,
                team_ids[pm.teams[0]],
                team_ids[pm.teams[1]],
                resolve_team(pm.toss_winner),
                pm.toss_decision,
                _bool_or_none(pm.toss_uncontested),
                resolve_team(pm.outcome_winner),
                pm.result_type,
                pm.result_margin,
                1 if pm.result_by_innings else 0,
                pm.result_method,
                resolve_team(pm.eliminator_winner),
                pm.result_text,
                pom_id,
                pm.data_version,
                pm.revision,
                pm.created,
            )
        )

        for order, d in enumerate(pm.dates):
            self._buf["match_dates"].append((pm.match_id, d, order))

        seen_match_players: set[int] = set()
        for team, names in pm.players_by_team.items():
            tid = resolve_team(team)
            for name in names:
                pid = resolve_player(name, "match_players")
                if pid in seen_match_players:
                    # Source lists this player under more than one team — keep the
                    # first assignment (enforces UNIQUE(match_id, player_id)) and
                    # record the conflict rather than silently merging.
                    self.stats.duplicate_match_players.append(
                        {"match_id": pm.match_id, "name": name, "team": team}
                    )
                    continue
                seen_match_players.add(pid)
                self._buf["match_players"].append(
                    (next(self._match_player_seq), pm.match_id, tid, pid, 1)
                )

        for role, names in pm.officials.items():
            for order, name in enumerate(names):
                self._buf["match_officials"].append(
                    (next(self._match_official_seq), pm.match_id, role, name, order)
                )

        for inn in pm.innings:
            innings_id = next(self._innings_seq)
            self._buf["innings"].append(
                (
                    innings_id,
                    pm.match_id,
                    inn.innings_number,
                    resolve_team(inn.team),
                    1 if inn.is_super_over else 0,
                    1 if inn.is_declared else 0,
                    1 if inn.is_forfeited else 0,
                    inn.target_runs,
                    inn.target_overs,
                    inn.penalty_pre,
                    inn.penalty_post,
                )
            )
            self.stats.innings += 1

            for ov in inn.overs:
                over_id = next(self._over_seq)
                self._buf["overs"].append((over_id, innings_id, ov.over_number, len(ov.deliveries)))
                self.stats.overs += 1

                for d in ov.deliveries:
                    delivery_id = next(self._delivery_seq)
                    is_wicket = 1 if d.wickets else 0
                    self._buf["deliveries"].append(
                        (
                            delivery_id,
                            over_id,
                            d.delivery_number,
                            resolve_player(d.batter, "batter"),
                            resolve_player(d.non_striker, "non_striker"),
                            resolve_player(d.bowler, "bowler"),
                            d.batter_runs,
                            d.extra_runs,
                            d.total_runs,
                            1 if d.non_boundary else 0,
                            is_wicket,
                        )
                    )
                    self.stats.deliveries += 1
                    self._pending_deliveries += 1

                    for etype, runs in d.extras.items():
                        self._buf["delivery_extras"].append((delivery_id, etype, runs))

                    for w_order, w in enumerate(d.wickets):
                        wicket_id = next(self._wicket_seq)
                        self._buf["delivery_wickets"].append(
                            (
                                wicket_id,
                                delivery_id,
                                w_order,
                                resolve_player(w.player_out, "player_out"),
                                w.kind,
                            )
                        )
                        for f_order, (fname, is_sub) in enumerate(w.fielders):
                            # Resolve fielder only via the registry (exact); a
                            # substitute may be unresolved — keep the name.
                            fid = name_to_pid.get(fname)
                            self._buf["wicket_fielders"].append(
                                (
                                    next(self._fielder_seq),
                                    wicket_id,
                                    fid,
                                    fname,
                                    1 if is_sub else 0,
                                    f_order,
                                )
                            )

        self.stats.matches += 1
        if self._pending_deliveries >= FLUSH_THRESHOLD:
            self.flush()

    # -- flushing ------------------------------------------------------------
    def flush(self) -> None:
        cur = self.conn.cursor()
        for name, sql in _INSERTS.items():
            rows = self._buf[name]
            if rows:
                cur.executemany(sql, rows)
                rows.clear()
        self.conn.commit()
        self._pending_deliveries = 0


def _bool_or_none(value: bool | None) -> int | None:
    if value is None:
        return None
    return 1 if value else 0
