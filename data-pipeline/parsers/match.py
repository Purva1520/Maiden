"""Parsing of a single Cricsheet match JSON into a ParsedMatch.

Top-level keys: ``meta``, ``info``, ``innings``. See docs/cricsheet-mapping.md for
the full field-by-field mapping to the database schema.
"""

from __future__ import annotations

from typing import Any

from cleaning.dates import normalize_dates
from core.config import canonical_format

from .errors import ParseError
from .innings import parse_innings
from .models import ParsedMatch

# Cricsheet officials roles we preserve.
OFFICIAL_ROLES = ("umpires", "tv_umpires", "reserve_umpires", "match_referees")


def _build_result_text(
    winner: str | None,
    result_type: str | None,
    margin: int | None,
    by_innings: bool,
    method: str | None,
    eliminator: str | None,
) -> str:
    if result_type in ("tie", "draw", "no result"):
        base = {"tie": "Match tied", "draw": "Match drawn", "no result": "No result"}[result_type]
        if eliminator:
            base += f" ({eliminator} won the eliminator)"
        return base
    if winner and result_type == "innings":
        runs = f" and {margin} runs" if margin is not None else ""
        text = f"{winner} won by an innings{runs}"
    elif winner and result_type == "runs":
        text = f"{winner} won by {margin} run{'s' if margin != 1 else ''}"
    elif winner and result_type == "wickets":
        text = f"{winner} won by {margin} wicket{'s' if margin != 1 else ''}"
    elif winner:
        text = f"{winner} won"
    elif eliminator:
        text = f"{eliminator} won the eliminator"
    else:
        text = "Result unknown"
    if method:
        text += f" ({method})"
    return text


def _parse_outcome(outcome: dict[str, Any]) -> dict[str, Any]:
    winner = outcome.get("winner")
    method = outcome.get("method")
    eliminator = outcome.get("eliminator")
    result_type: str | None = None
    margin: int | None = None
    by_innings = False

    if "result" in outcome:
        # 'tie' | 'draw' | 'no result'
        result_type = str(outcome["result"]).strip().lower()
    elif winner is not None:
        by = outcome.get("by") or {}
        if "innings" in by:
            result_type = "innings"
            by_innings = True
            margin = _as_int(by.get("runs"))
        elif "runs" in by:
            result_type = "runs"
            margin = _as_int(by.get("runs"))
        elif "wickets" in by:
            result_type = "wickets"
            margin = _as_int(by.get("wickets"))
        else:
            result_type = "other"
    elif eliminator is not None:
        result_type = "eliminator"

    return {
        "winner": str(winner) if winner is not None else None,
        "result_type": result_type,
        "margin": margin,
        "by_innings": by_innings,
        "method": str(method) if method is not None else None,
        "eliminator": str(eliminator) if eliminator is not None else None,
        "text": _build_result_text(
            str(winner) if winner is not None else None,
            result_type,
            margin,
            by_innings,
            str(method) if method is not None else None,
            str(eliminator) if eliminator is not None else None,
        ),
    }


def parse_match(match_id: str, source_file: str, data: dict[str, Any]) -> ParsedMatch:
    if "__parse_error__" in data:
        raise ParseError(f"Unreadable JSON: {data['__parse_error__']}")
    info = data.get("info")
    if not isinstance(info, dict):
        raise ParseError("Missing 'info' section")

    teams = info.get("teams")
    if not isinstance(teams, list) or len(teams) != 2:
        raise ParseError(f"Expected exactly 2 teams, got {teams!r}")

    match_type = info.get("match_type")
    fmt = canonical_format(match_type)
    if fmt is None:
        raise ParseError(f"Unknown/unsupported match_type: {match_type!r}")

    registry = {}
    for name, pid in (info.get("registry") or {}).get("people", {}).items():
        registry[str(name)] = str(pid)

    players_by_team: dict[str, list[str]] = {}
    for team, names in (info.get("players") or {}).items():
        players_by_team[str(team)] = [str(n) for n in (names or [])]

    officials: dict[str, list[str]] = {}
    for role in OFFICIAL_ROLES:
        vals = (info.get("officials") or {}).get(role)
        if vals:
            officials[role] = [str(v) for v in vals]

    toss = info.get("toss") or {}
    outcome = _parse_outcome(info.get("outcome") or {})
    event = info.get("event") or {}
    meta = data.get("meta") or {}

    try:
        innings = parse_innings(data.get("innings") or [])
    except ParseError:
        raise
    except (KeyError, TypeError, ValueError) as exc:
        raise ParseError(f"Innings parse failure: {exc}") from exc

    return ParsedMatch(
        match_id=match_id,
        source_file=source_file,
        format=fmt,
        match_type=str(match_type) if match_type is not None else None,
        gender=_as_str(info.get("gender")),
        team_type=_as_str(info.get("team_type")),
        balls_per_over=_as_int(info.get("balls_per_over")),
        overs=_as_int(info.get("overs")),
        season=_as_str(info.get("season")),
        event_name=_as_str(event.get("name")),
        event_match_number=_as_int(event.get("match_number")),
        event_group=_as_str(event.get("group")),
        event_stage=_as_str(event.get("stage")),
        venue=_as_str(info.get("venue")),
        city=_as_str(info.get("city")),
        dates=normalize_dates(info.get("dates")),
        teams=[str(t) for t in teams],
        toss_winner=_as_str(toss.get("winner")),
        toss_decision=_as_str(toss.get("decision")),
        toss_uncontested=(bool(toss["uncontested"]) if "uncontested" in toss else None),
        outcome_winner=outcome["winner"],
        result_type=outcome["result_type"],
        result_margin=outcome["margin"],
        result_by_innings=outcome["by_innings"],
        result_method=outcome["method"],
        eliminator_winner=outcome["eliminator"],
        result_text=outcome["text"],
        player_of_match=[str(p) for p in (info.get("player_of_match") or [])],
        registry=registry,
        players_by_team=players_by_team,
        officials=officials,
        data_version=_as_str(meta.get("data_version")),
        revision=_as_int(meta.get("revision")),
        created=_as_str(meta.get("created")),
        innings=innings,
    )


def _as_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
