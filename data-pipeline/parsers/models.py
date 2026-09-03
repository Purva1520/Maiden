"""Intermediate, source-faithful data structures produced by the parser.

These use player/team *names* as they appear in the Cricsheet JSON. Mapping names
to canonical database identifiers happens later in the export layer, using the
match's registry (name -> stable Cricsheet person id).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ParsedWicket:
    player_out: str
    kind: str
    fielders: list[tuple[str, bool]] = field(default_factory=list)  # (name, is_substitute)


@dataclass
class ParsedDelivery:
    delivery_number: int  # 0-based index within the over's delivery list
    batter: str
    non_striker: str
    bowler: str
    batter_runs: int
    extra_runs: int
    total_runs: int
    non_boundary: bool = False
    extras: dict[str, int] = field(default_factory=dict)  # extra_type -> runs
    wickets: list[ParsedWicket] = field(default_factory=list)


@dataclass
class ParsedOver:
    over_number: int
    deliveries: list[ParsedDelivery] = field(default_factory=list)


@dataclass
class ParsedInnings:
    innings_number: int  # 1-based order within the match
    team: str  # batting team (source name)
    is_super_over: bool = False
    is_declared: bool = False
    is_forfeited: bool = False
    target_runs: int | None = None
    target_overs: float | None = None
    penalty_pre: int | None = None
    penalty_post: int | None = None
    overs: list[ParsedOver] = field(default_factory=list)


@dataclass
class ParsedMatch:
    match_id: str
    source_file: str

    # Format / classification
    format: str  # canonical: "ODI" | "T20"
    match_type: str | None  # raw Cricsheet match_type
    gender: str | None
    team_type: str | None
    balls_per_over: int | None
    overs: int | None  # scheduled overs per innings
    season: str | None

    # Event
    event_name: str | None
    event_match_number: int | None
    event_group: str | None
    event_stage: str | None

    # Location / time
    venue: str | None
    city: str | None
    dates: list[str] = field(default_factory=list)  # normalized YYYY-MM-DD, ordered

    # Teams (2, source names, in Cricsheet order)
    teams: list[str] = field(default_factory=list)

    # Toss
    toss_winner: str | None = None
    toss_decision: str | None = None
    toss_uncontested: bool | None = None

    # Outcome
    outcome_winner: str | None = None
    result_type: str | None = None  # runs|wickets|innings|tie|draw|no result|...
    result_margin: int | None = None
    result_by_innings: bool = False
    result_method: str | None = None  # e.g. D/L
    eliminator_winner: str | None = None
    result_text: str | None = None

    player_of_match: list[str] = field(default_factory=list)

    # People
    registry: dict[str, str] = field(default_factory=dict)  # name -> cricsheet person id
    players_by_team: dict[str, list[str]] = field(default_factory=dict)  # team -> XI names
    officials: dict[str, list[str]] = field(default_factory=dict)  # role -> names

    # Meta
    data_version: str | None = None
    revision: int | None = None
    created: str | None = None

    innings: list[ParsedInnings] = field(default_factory=list)
