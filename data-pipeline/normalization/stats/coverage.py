"""Tournament → Cricsheet match mapping and coverage status.

Maps each Maiden World Cup to its Phase 1 match records using the verified
event mapping (config.TOURNAMENT_EVENTS), and classifies ball-by-ball coverage
as COMPLETE / PARTIAL / INSUFFICIENT. Partial coverage is never treated as
complete (§62/§63).
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from .config import COVERAGE_COMPLETE_RATIO, TOURNAMENT_EVENTS

STATUS_COMPLETE = "COMPLETE"
STATUS_PARTIAL = "PARTIAL"
STATUS_INSUFFICIENT = "INSUFFICIENT"


@dataclass
class TournamentCoverage:
    tournament_id: str
    matches_available: int
    participating_teams: int
    teams_in_matches: int
    coverage_ratio: float
    status: str


def build_tournament_match_map(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """Return {tournament_id: [match_id, ...]} using the verified event mapping."""
    tmap: dict[str, list[str]] = {}
    for tid, selectors in TOURNAMENT_EVENTS.items():
        match_ids: list[str] = []
        for event_name, year in selectors:
            rows = conn.execute(
                "SELECT m.match_id FROM matches m JOIN events e ON m.event_id = e.event_id "
                "WHERE e.event_name = ? AND CAST(strftime('%Y', m.start_date) AS INTEGER) = ?",
                (event_name, year),
            ).fetchall()
            match_ids.extend(r[0] for r in rows)
        tmap[tid] = sorted(set(match_ids))
    return tmap


def create_temp_map_table(conn: sqlite3.Connection, tmap: dict[str, list[str]]) -> None:
    """Create a temp table `tourn_match(tournament_id, match_id)` for joins."""
    conn.execute("DROP TABLE IF EXISTS tourn_match")
    conn.execute(
        "CREATE TEMP TABLE tourn_match (tournament_id TEXT NOT NULL, match_id TEXT NOT NULL)"
    )
    rows = [(tid, mid) for tid, mids in tmap.items() for mid in mids]
    conn.executemany("INSERT INTO tourn_match (tournament_id, match_id) VALUES (?, ?)", rows)
    conn.execute("CREATE INDEX idx_tourn_match ON tourn_match (tournament_id)")
    conn.execute("CREATE INDEX idx_tourn_match_mid ON tourn_match (match_id)")
    conn.commit()


def compute_coverage(
    conn: sqlite3.Connection, tmap: dict[str, list[str]]
) -> dict[str, TournamentCoverage]:
    """Classify each tournament's ball-by-ball coverage."""
    out: dict[str, TournamentCoverage] = {}
    for tid, match_ids in tmap.items():
        participating = conn.execute(
            "SELECT COUNT(DISTINCT team_id) FROM tournament_teams WHERE tournament_id = ?",
            (tid,),
        ).fetchone()[0]

        if not match_ids:
            out[tid] = TournamentCoverage(tid, 0, participating, 0, 0.0, STATUS_INSUFFICIENT)
            continue

        placeholders = ",".join("?" for _ in match_ids)
        team_rows = conn.execute(
            f"SELECT team_1_id FROM matches WHERE match_id IN ({placeholders}) "
            f"UNION SELECT team_2_id FROM matches WHERE match_id IN ({placeholders})",
            (*match_ids, *match_ids),
        ).fetchall()
        teams_in_matches = len({r[0] for r in team_rows})

        # How many of the tournament's participating teams actually appear.
        pteam_ids = {
            r[0]
            for r in conn.execute(
                "SELECT team_id FROM tournament_teams WHERE tournament_id = ?", (tid,)
            )
        }
        present = len({r[0] for r in team_rows} & pteam_ids)
        ratio = present / participating if participating else 0.0
        status = STATUS_COMPLETE if ratio >= COVERAGE_COMPLETE_RATIO else STATUS_PARTIAL

        out[tid] = TournamentCoverage(
            tournament_id=tid,
            matches_available=len(match_ids),
            participating_teams=participating,
            teams_in_matches=teams_in_matches,
            coverage_ratio=round(ratio, 4),
            status=status,
        )
    return out
