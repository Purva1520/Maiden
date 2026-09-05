"""Query API for the Maiden World Cup universe.

Public interface:

    getSquad(format, year, team)   → list of squad members
    get_tournament(format, year)   → tournament metadata
    get_tournament_teams(fmt, yr)  → list of team names
    list_tournaments()             → all 22 tournaments

All inputs are normalized (case-insensitive). Invalid inputs raise
``ValueError`` with a descriptive message.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from core import config
from core.logging_setup import get_logger

logger = get_logger(__name__)

# Canonical format aliases for user convenience
_FORMAT_ALIASES: dict[str, str] = {
    "ODI": "ODI",
    "OD": "ODI",
    "ODIS": "ODI",
    "50": "ODI",
    "T20": "T20",
    "T20I": "T20",
    "T20S": "T20",
    "IT20": "T20",
    "20": "T20",
}


def _normalize_format(fmt: str) -> str:
    """Resolve a format string to the canonical 'ODI' or 'T20'."""
    key = fmt.strip().upper()
    result = _FORMAT_ALIASES.get(key)
    if result is None:
        raise ValueError(f"Unsupported format: {fmt!r}. Use 'ODI' or 'T20'.")
    return result


def _normalize_team(team: str) -> str:
    """Collapse whitespace and title-case for deterministic lookup."""
    return " ".join(team.split()).strip()


def _connect(db_path: Path | None = None) -> sqlite3.Connection:
    db = db_path or config.DB_PATH
    if not db.exists():
        raise FileNotFoundError(f"Database not found: {db}")
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _tournament_id(fmt: str, year: int) -> str:
    """Build the canonical tournament_id: ``ODI_WC_YYYY`` / ``T20_WC_YYYY``."""
    return f"{fmt}_WC_{year}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def list_tournaments(*, db_path: Path | None = None) -> list[dict]:
    """Return all 22 tournament records, sorted by format then year."""
    conn = _connect(db_path)
    try:
        rows = conn.execute(
            "SELECT tournament_id, year, format, name, display_name, edition_number, "
            "status, source FROM tournaments ORDER BY format, year"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_tournament(
    fmt: str,
    year: int,
    *,
    db_path: Path | None = None,
) -> dict:
    """Return metadata for a single tournament edition.

    Raises ``ValueError`` if the tournament is not found.
    """
    canon_fmt = _normalize_format(fmt)
    tid = _tournament_id(canon_fmt, year)
    conn = _connect(db_path)
    try:
        row = conn.execute(
            "SELECT tournament_id, year, format, name, display_name, edition_number, "
            "status, source FROM tournaments WHERE tournament_id = ?",
            (tid,),
        ).fetchone()
        if row is None:
            raise ValueError(
                f"Tournament not found: {fmt} {year} (id={tid}). "
                f"Valid years for {canon_fmt}: use list_tournaments() to see all editions."
            )
        return dict(row)
    finally:
        conn.close()


def get_tournament_teams(
    fmt: str,
    year: int,
    *,
    db_path: Path | None = None,
) -> list[str]:
    """Return team names for a tournament, sorted alphabetically."""
    canon_fmt = _normalize_format(fmt)
    tid = _tournament_id(canon_fmt, year)
    conn = _connect(db_path)
    try:
        # Verify tournament exists
        exists = conn.execute(
            "SELECT 1 FROM tournaments WHERE tournament_id = ?", (tid,)
        ).fetchone()
        if exists is None:
            raise ValueError(f"Tournament not found: {fmt} {year} (id={tid})")

        rows = conn.execute(
            "SELECT team_name FROM tournament_teams WHERE tournament_id = ? ORDER BY team_name",
            (tid,),
        ).fetchall()
        return [r["team_name"] for r in rows]
    finally:
        conn.close()


def getSquad(
    fmt: str,
    year: int,
    team: str,
    *,
    db_path: Path | None = None,
) -> list[dict]:
    """Return the tournament squad for a given format/year/team.

    Parameters
    ----------
    fmt : str
        ``'ODI'`` or ``'T20'`` (case-insensitive).
    year : int
        Tournament year.
    team : str
        Team name (case-insensitive).

    Returns
    -------
    list[dict]
        Each dict contains: ``player``, ``role``, ``wicketkeeper``,
        ``participated``, ``squad_order``.

    Raises
    ------
    ValueError
        If format, year, or team is invalid/not found.

    Examples
    --------
    >>> getSquad("ODI", 2011, "India")  # doctest: +SKIP
    [{'player': 'MS Dhoni', 'role': 'WK', 'wicketkeeper': True, ...}, ...]
    """
    canon_fmt = _normalize_format(fmt)
    tid = _tournament_id(canon_fmt, year)
    norm_team = _normalize_team(team)

    conn = _connect(db_path)
    try:
        # Verify tournament exists
        t_row = conn.execute("SELECT 1 FROM tournaments WHERE tournament_id = ?", (tid,)).fetchone()
        if t_row is None:
            raise ValueError(
                f"Tournament not found: {fmt} {year} (id={tid}). "
                f"Check list_tournaments() for valid editions."
            )

        # Find the team (case-insensitive match via team_name)
        team_row = conn.execute(
            "SELECT tt.team_id FROM tournament_teams tt "
            "WHERE tt.tournament_id = ? AND LOWER(tt.team_name) = LOWER(?)",
            (tid, norm_team),
        ).fetchone()
        if team_row is None:
            # List available teams for a helpful error
            available = conn.execute(
                "SELECT team_name FROM tournament_teams WHERE tournament_id = ? ORDER BY team_name",
                (tid,),
            ).fetchall()
            team_list = ", ".join(r["team_name"] for r in available)
            raise ValueError(
                f"Team {team!r} not found in {canon_fmt} {year}. Available teams: {team_list}"
            )

        team_id = team_row["team_id"]

        rows = conn.execute(
            "SELECT p.player_id, p.display_name AS player, ts.role, ts.wicketkeeper, "
            "ts.participated, ts.squad_order "
            "FROM tournament_squads ts "
            "JOIN players p ON ts.player_id = p.player_id "
            "WHERE ts.tournament_id = ? AND ts.team_id = ? "
            "ORDER BY COALESCE(ts.squad_order, 999), p.display_name",
            (tid, team_id),
        ).fetchall()

        return [
            {
                "player": r["player"],
                "player_id": r["player_id"],
                "role": r["role"],
                "wicketkeeper": bool(r["wicketkeeper"]),
                "participated": bool(r["participated"]),
                "squad_order": r["squad_order"],
            }
            for r in rows
        ]
    finally:
        conn.close()
