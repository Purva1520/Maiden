"""Parsing of innings -> overs -> deliveries (with extras and wickets).

Field names follow the Cricsheet JSON structure (data_version 1.2.0):

    innings[] : { team, overs[], declared?, forfeited?, super_over?, target?,
                  penalty_runs? {pre, post} }
    over      : { over, deliveries[] }
    delivery  : { batter, bowler, non_striker, runs {batter, extras, total,
                  non_boundary?}, extras? {...}, wickets? [{player_out, kind,
                  fielders? [{name, substitute?}]}] }
"""

from __future__ import annotations

from typing import Any

from .errors import ParseError
from .models import ParsedDelivery, ParsedInnings, ParsedOver, ParsedWicket

# Extra types exposed by Cricsheet. A delivery may carry more than one type.
KNOWN_EXTRA_TYPES = ("wides", "noballs", "byes", "legbyes", "penalty")


def _parse_wicket(raw: dict[str, Any]) -> ParsedWicket:
    player_out = raw.get("player_out")
    kind = raw.get("kind")
    if not player_out or not kind:
        raise ParseError(f"Wicket missing player_out/kind: {raw!r}")
    fielders: list[tuple[str, bool]] = []
    for f in raw.get("fielders", []) or []:
        if isinstance(f, dict) and f.get("name"):
            fielders.append((str(f["name"]), bool(f.get("substitute", False))))
    return ParsedWicket(player_out=str(player_out), kind=str(kind), fielders=fielders)


def _parse_delivery(index: int, raw: dict[str, Any]) -> ParsedDelivery:
    for key in ("batter", "bowler", "non_striker", "runs"):
        if key not in raw:
            raise ParseError(f"Delivery missing required field {key!r}")
    runs = raw["runs"]
    extras_map: dict[str, int] = {}
    for etype, value in (raw.get("extras") or {}).items():
        try:
            extras_map[str(etype)] = int(value)
        except (TypeError, ValueError) as exc:
            raise ParseError(f"Non-integer extra {etype}={value!r}") from exc

    wickets = [_parse_wicket(w) for w in (raw.get("wickets") or [])]

    return ParsedDelivery(
        delivery_number=index,
        batter=str(raw["batter"]),
        non_striker=str(raw["non_striker"]),
        bowler=str(raw["bowler"]),
        batter_runs=int(runs.get("batter", 0)),
        extra_runs=int(runs.get("extras", 0)),
        total_runs=int(runs.get("total", 0)),
        non_boundary=bool(runs.get("non_boundary", False)),
        extras=extras_map,
        wickets=wickets,
    )


def _parse_over(raw: dict[str, Any]) -> ParsedOver:
    if "over" not in raw:
        raise ParseError("Over missing 'over' number")
    over = ParsedOver(over_number=int(raw["over"]))
    for i, d in enumerate(raw.get("deliveries", []) or []):
        over.deliveries.append(_parse_delivery(i, d))
    return over


def parse_innings(raw_innings: list[dict[str, Any]]) -> list[ParsedInnings]:
    """Parse the top-level ``innings`` array into ordered ParsedInnings."""
    result: list[ParsedInnings] = []
    for order, raw in enumerate(raw_innings or [], start=1):
        team = raw.get("team")
        if not team:
            raise ParseError(f"Innings #{order} missing 'team'")
        target = raw.get("target") or {}
        penalty = raw.get("penalty_runs") or {}
        innings = ParsedInnings(
            innings_number=order,
            team=str(team),
            is_super_over=bool(raw.get("super_over", False)),
            is_declared=bool(raw.get("declared", False)),
            is_forfeited=bool(raw.get("forfeited", False)),
            target_runs=_as_int(target.get("runs")),
            target_overs=_as_float(target.get("overs")),
            penalty_pre=_as_int(penalty.get("pre")),
            penalty_post=_as_int(penalty.get("post")),
        )
        for raw_over in raw.get("overs", []) or []:
            innings.overs.append(_parse_over(raw_over))
        result.append(innings)
    return result


def _as_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
