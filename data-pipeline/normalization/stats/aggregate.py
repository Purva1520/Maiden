"""Raw player × tournament × team batting and bowling statistics.

SQL data access is separated from the pure-pandas aggregation so the statistical
conventions can be unit-tested on small fixtures (§91). All conventions are
documented in docs/statistical-methodology.md. Super-over innings are excluded.

Key conventions:
* balls faced   — deliveries faced as striker excluding wides (§12).
* batter dismissal — any wicket of the batter except retirements (run outs count).
* bowler wickets — only BOWLER_WICKET_KINDS (§23).
* runs conceded — batter runs + wides + no-balls (not byes/leg-byes/penalty) (§22).
* legal balls   — deliveries excluding wides and no-balls (§21).
* averages/rates — null (not 0) when the denominator is undefined (§13/§14/§52).
"""

from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd

from .config import BOWLER_WICKET_KINDS

# Retirements that do NOT count as a batting dismissal (batter is "not out").
NOT_OUT_RETIREMENTS = frozenset({"retired hurt", "retired not out"})

_DELIVERIES_SQL = """
WITH dex AS (
    SELECT delivery_id,
        SUM(CASE WHEN extra_type = 'wides'   THEN runs ELSE 0 END) AS wide_runs,
        SUM(CASE WHEN extra_type = 'noballs' THEN runs ELSE 0 END) AS noball_runs,
        MAX(CASE WHEN extra_type = 'wides'   THEN 1 ELSE 0 END)    AS is_wide,
        MAX(CASE WHEN extra_type = 'noballs' THEN 1 ELSE 0 END)    AS is_noball
    FROM delivery_extras GROUP BY delivery_id
)
SELECT tm.tournament_id, i.innings_id, o.over_number, d.delivery_id,
       d.batter_id, d.non_striker_id, d.bowler_id, d.batter_runs, d.non_boundary,
       COALESCE(dex.wide_runs, 0)   AS wide_runs,
       COALESCE(dex.noball_runs, 0) AS noball_runs,
       COALESCE(dex.is_wide, 0)     AS is_wide,
       COALESCE(dex.is_noball, 0)   AS is_noball
FROM deliveries d
JOIN overs o        ON d.over_id = o.over_id
JOIN innings i      ON o.innings_id = i.innings_id
JOIN tourn_match tm ON i.match_id = tm.match_id
LEFT JOIN dex       ON dex.delivery_id = d.delivery_id
WHERE i.is_super_over = 0
"""

_WICKETS_SQL = """
SELECT tm.tournament_id, i.innings_id, d.bowler_id,
       dw.player_out_id, dw.dismissal_kind
FROM delivery_wickets dw
JOIN deliveries d   ON dw.delivery_id = d.delivery_id
JOIN overs o        ON d.over_id = o.over_id
JOIN innings i      ON o.innings_id = i.innings_id
JOIN tourn_match tm ON i.match_id = tm.match_id
WHERE i.is_super_over = 0
"""

_MATCH_PLAYERS_SQL = """
SELECT tm.tournament_id, mp.match_id, mp.team_id, mp.player_id
FROM match_players mp JOIN tourn_match tm ON mp.match_id = tm.match_id
"""


def load_frames(conn: sqlite3.Connection) -> dict[str, pd.DataFrame]:
    """Load the tournament-filtered delivery/wicket/match-player frames."""
    return {
        "deliveries": pd.read_sql_query(_DELIVERIES_SQL, conn),
        "wickets": pd.read_sql_query(_WICKETS_SQL, conn),
        "match_players": pd.read_sql_query(_MATCH_PLAYERS_SQL, conn),
    }


# ---------------------------------------------------------------------------
# Batting
# ---------------------------------------------------------------------------
def compute_batting(
    deliveries: pd.DataFrame, wickets: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (per-player batting df, per-innings df) keyed by tournament/player."""
    d = deliveries
    faced = (d["is_wide"] == 0).astype(int)
    is_four = ((d["batter_runs"] == 4) & (d["non_boundary"] == 0)).astype(int)
    is_six = ((d["batter_runs"] == 6) & (d["non_boundary"] == 0)).astype(int)
    work = pd.DataFrame(
        {
            "tournament_id": d["tournament_id"],
            "innings_id": d["innings_id"],
            "player_id": d["batter_id"],
            "runs": d["batter_runs"],
            "faced": faced,
            "four": is_four,
            "six": is_six,
        }
    )
    bat_inn = work.groupby(["tournament_id", "innings_id", "player_id"], as_index=False).sum()

    # Everyone who came to the crease: batters + non-strikers + dismissed players.
    ns = d[["tournament_id", "innings_id", "non_striker_id"]].rename(
        columns={"non_striker_id": "player_id"}
    )
    outs = wickets.rename(columns={"player_out_id": "player_id"})
    crease = pd.concat(
        [
            bat_inn[["tournament_id", "innings_id", "player_id"]],
            ns[["tournament_id", "innings_id", "player_id"]],
            outs[["tournament_id", "innings_id", "player_id"]],
        ],
        ignore_index=True,
    ).drop_duplicates()

    innings = crease.merge(bat_inn, on=["tournament_id", "innings_id", "player_id"], how="left")
    for col in ("runs", "faced", "four", "six"):
        innings[col] = innings[col].fillna(0).astype(int)

    # Dismissals (a wicket of this player that is not a retirement not-out).
    dis = outs[~outs["dismissal_kind"].isin(NOT_OUT_RETIREMENTS)][
        ["tournament_id", "innings_id", "player_id"]
    ].drop_duplicates()
    dis["dismissed"] = 1
    innings = innings.merge(dis, on=["tournament_id", "innings_id", "player_id"], how="left")
    innings["dismissed"] = innings["dismissed"].fillna(0).astype(int)

    g = innings.groupby(["tournament_id", "player_id"])
    out = g.agg(
        bat_innings=("runs", "size"),
        bat_runs=("runs", "sum"),
        bat_balls=("faced", "sum"),
        bat_fours=("four", "sum"),
        bat_sixes=("six", "sum"),
        bat_dismissals=("dismissed", "sum"),
        bat_highest=("runs", "max"),
        bat_fifties=("runs", lambda s: int(((s >= 50) & (s < 100)).sum())),
        bat_hundreds=("runs", lambda s: int((s >= 100).sum())),
    ).reset_index()
    out["bat_not_outs"] = out["bat_innings"] - out["bat_dismissals"]
    out["bat_boundary_runs"] = out["bat_fours"] * 4 + out["bat_sixes"] * 6
    return out, innings[["tournament_id", "player_id", "runs", "faced", "dismissed"]]


# ---------------------------------------------------------------------------
# Bowling
# ---------------------------------------------------------------------------
def compute_bowling(
    deliveries: pd.DataFrame, wickets: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (per-player bowling df, per-innings df) keyed by tournament/player."""
    d = deliveries
    legal = ((d["is_wide"] == 0) & (d["is_noball"] == 0)).astype(int)
    bowler_runs = d["batter_runs"] + d["wide_runs"] + d["noball_runs"]
    work = pd.DataFrame(
        {
            "tournament_id": d["tournament_id"],
            "innings_id": d["innings_id"],
            "over_number": d["over_number"],
            "player_id": d["bowler_id"],
            "legal": legal,
            "runs": bowler_runs,
        }
    )
    # Bowler-credited wickets per innings.
    wk = wickets[wickets["dismissal_kind"].isin(BOWLER_WICKET_KINDS)]
    wk_inn = (
        wk.groupby(["tournament_id", "innings_id", "bowler_id"], as_index=False)
        .size()
        .rename(columns={"bowler_id": "player_id", "size": "wkts"})
    )

    inn = work.groupby(["tournament_id", "innings_id", "player_id"], as_index=False).agg(
        balls=("legal", "sum"), runs=("runs", "sum")
    )
    inn = inn.merge(wk_inn, on=["tournament_id", "innings_id", "player_id"], how="left")
    inn["wkts"] = inn["wkts"].fillna(0).astype(int)

    # Maidens: an over where the bowler conceded 0 charged runs and bowled ≥1 legal ball.
    over = work.groupby(
        ["tournament_id", "innings_id", "over_number", "player_id"], as_index=False
    ).agg(over_runs=("runs", "sum"), over_legal=("legal", "sum"))
    over["maiden"] = ((over["over_runs"] == 0) & (over["over_legal"] >= 1)).astype(int)
    maidens = over.groupby(["tournament_id", "player_id"], as_index=False)["maiden"].sum()

    g = inn.groupby(["tournament_id", "player_id"])
    out = g.agg(
        bowl_innings=("balls", "size"),
        bowl_balls=("balls", "sum"),
        bowl_runs_conceded=("runs", "sum"),
        bowl_wickets=("wkts", "sum"),
        bowl_five_wickets=("wkts", lambda s: int((s >= 5).sum())),
    ).reset_index()
    out = out.merge(
        maidens.rename(columns={"maiden": "bowl_maidens"}),
        on=["tournament_id", "player_id"],
        how="left",
    )
    out["bowl_maidens"] = out["bowl_maidens"].fillna(0).astype(int)
    return out, inn[["tournament_id", "player_id", "balls", "runs", "wkts"]]


# ---------------------------------------------------------------------------
# Participation
# ---------------------------------------------------------------------------
def compute_matches_played(match_players: pd.DataFrame) -> pd.DataFrame:
    """matches_played per (tournament, player) from match-player (XI) records."""
    return (
        match_players.groupby(["tournament_id", "player_id"], as_index=False)["match_id"]
        .nunique()
        .rename(columns={"match_id": "matches_played"})
    )


# ---------------------------------------------------------------------------
# Derived ratios (null-safe)
# ---------------------------------------------------------------------------
def _safe_div(num: pd.Series, den: pd.Series) -> pd.Series:
    return np.where(den > 0, num / den, np.nan)


def add_batting_derived(df: pd.DataFrame) -> pd.DataFrame:
    df["bat_average"] = _safe_div(df["bat_runs"], df["bat_dismissals"])
    df["bat_strike_rate"] = np.where(
        df["bat_balls"] > 0, df["bat_runs"] / df["bat_balls"] * 100, np.nan
    )
    df["bat_runs_per_innings"] = _safe_div(df["bat_runs"], df["bat_innings"])
    df["bat_boundary_rate"] = _safe_div(df["bat_fours"] + df["bat_sixes"], df["bat_balls"])
    # Highest score is undefined when the player never batted.
    df["bat_highest"] = np.where(df["bat_innings"] > 0, df["bat_highest"], np.nan)
    return df


def add_bowling_derived(df: pd.DataFrame) -> pd.DataFrame:
    df["bowl_economy"] = np.where(
        df["bowl_balls"] > 0, df["bowl_runs_conceded"] * 6 / df["bowl_balls"], np.nan
    )
    df["bowl_average"] = _safe_div(df["bowl_runs_conceded"], df["bowl_wickets"])
    df["bowl_strike_rate"] = _safe_div(df["bowl_balls"], df["bowl_wickets"])
    df["bowl_wickets_per_innings"] = _safe_div(df["bowl_wickets"], df["bowl_innings"])
    df["bowl_overs_display"] = df["bowl_balls"].apply(_overs_display)
    return df


def _overs_display(balls: float) -> str | float:
    """Cricket over notation: 29 balls -> '4.5' (4 overs + 5 balls)."""
    if pd.isna(balls) or balls <= 0:
        return np.nan
    b = int(balls)
    return f"{b // 6}.{b % 6}"
