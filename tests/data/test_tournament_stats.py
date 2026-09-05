"""Phase 4 statistics tests: golden fixtures + extreme cases + normalization."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from normalization.stats import aggregate, features
from normalization.stats.config import BOWLER_WICKET_KINDS, era_for


def _delivery(**kw) -> dict:
    base = dict(
        tournament_id="T",
        innings_id=1,
        over_number=0,
        batter_id="A",
        non_striker_id="B",
        bowler_id="X",
        batter_runs=0,
        non_boundary=0,
        wide_runs=0,
        noball_runs=0,
        is_wide=0,
        is_noball=0,
    )
    base.update(kw)
    return base


# --- golden batting/bowling fixture --------------------------------------
@pytest.fixture
def golden():
    d = [
        _delivery(batter_runs=4),  # four
        _delivery(batter_runs=6),  # six
        _delivery(batter_runs=0),  # dot
        _delivery(batter_runs=1),  # single
        _delivery(batter_runs=0, wide_runs=1, is_wide=1),  # wide: not faced, charged
        _delivery(batter_runs=2, noball_runs=1, is_noball=1),  # no-ball: faced, charged
        _delivery(batter_runs=0),  # wicket ball (A caught)
    ]
    deliveries = pd.DataFrame(d)
    wickets = pd.DataFrame(
        [
            {"tournament_id": "T", "innings_id": 1, "bowler_id": "X",
             "player_out_id": "A", "dismissal_kind": "caught"},
        ]
    )
    return deliveries, wickets


def test_batting_golden(golden):
    deliveries, wickets = golden
    bat, _ = aggregate.compute_batting(deliveries, wickets)
    a = bat[bat["player_id"] == "A"].iloc[0]
    assert a["bat_runs"] == 4 + 6 + 0 + 1 + 0 + 2 + 0  # 13
    assert a["bat_balls"] == 6  # 7 deliveries minus 1 wide
    assert a["bat_fours"] == 1
    assert a["bat_sixes"] == 1
    assert a["bat_dismissals"] == 1
    assert a["bat_not_outs"] == 0
    assert a["bat_innings"] == 1
    assert a["bat_highest"] == 13


def test_batting_derived_nulls(golden):
    deliveries, wickets = golden
    bat, _ = aggregate.compute_batting(deliveries, wickets)
    bat = aggregate.add_batting_derived(bat)
    a = bat[bat["player_id"] == "A"].iloc[0]
    assert a["bat_average"] == pytest.approx(13.0)  # 13 runs / 1 dismissal
    assert a["bat_strike_rate"] == pytest.approx(13 / 6 * 100)
    # Non-striker B never faced a ball and was not out -> came to crease, 0 runs, avg null
    b = bat[bat["player_id"] == "B"].iloc[0]
    assert b["bat_innings"] == 1
    assert b["bat_dismissals"] == 0
    assert np.isnan(b["bat_average"])  # 0 dismissals -> null, not 0
    assert np.isnan(b["bat_strike_rate"])  # 0 balls faced -> null


def test_bowling_golden(golden):
    deliveries, wickets = golden
    bowl, _ = aggregate.compute_bowling(deliveries, wickets)
    bowl = aggregate.add_bowling_derived(bowl)
    x = bowl[bowl["player_id"] == "X"].iloc[0]
    # legal balls = deliveries minus wides minus no-balls: 7 - 1 wide - 1 no-ball = 5
    assert x["bowl_balls"] == 5
    assert x["bowl_runs_conceded"] == 13 + 1 + 1  # batter runs 13 + wide 1 + no-ball 1 = 15
    assert x["bowl_wickets"] == 1  # caught credited
    assert x["bowl_economy"] == pytest.approx(15 * 6 / 5)
    assert x["bowl_average"] == pytest.approx(15.0)
    assert x["bowl_strike_rate"] == pytest.approx(5.0)
    assert x["bowl_overs_display"] == "0.5"  # 5 balls


def test_run_out_not_bowler_wicket():
    deliveries = pd.DataFrame([_delivery(batter_runs=1, bowler_id="Y", batter_id="C")])
    wickets = pd.DataFrame(
        [{"tournament_id": "T", "innings_id": 1, "bowler_id": "Y",
          "player_out_id": "C", "dismissal_kind": "run out"}]
    )
    bowl, _ = aggregate.compute_bowling(deliveries, wickets)
    assert bowl[bowl["player_id"] == "Y"].iloc[0]["bowl_wickets"] == 0  # run out not credited
    bat, _ = aggregate.compute_batting(deliveries, wickets)
    assert bat[bat["player_id"] == "C"].iloc[0]["bat_dismissals"] == 1  # but C is out


def test_bowling_null_when_no_wickets():
    deliveries = pd.DataFrame([_delivery(batter_runs=4, bowler_id="Z")])
    bowl, _ = aggregate.compute_bowling(deliveries, pd.DataFrame(
        columns=["tournament_id", "innings_id", "bowler_id", "player_out_id", "dismissal_kind"]
    ))
    bowl = aggregate.add_bowling_derived(bowl)
    z = bowl[bowl["player_id"] == "Z"].iloc[0]
    assert z["bowl_wickets"] == 0
    assert np.isnan(z["bowl_average"])  # 0 wickets -> null
    assert np.isnan(z["bowl_strike_rate"])
    assert z["bowl_economy"] == pytest.approx(24.0)  # 4*6/1


def test_fifties_hundreds_and_five_wickets():
    # One batter scores 50 over 10 sixes-ish; another scores 100+.
    rows = [_delivery(innings_id=1, batter_id="H", batter_runs=6) for _ in range(9)]
    rows.append(_delivery(innings_id=1, batter_id="H", batter_runs=1))  # 55
    rows += [_delivery(innings_id=2, batter_id="H", batter_runs=6) for _ in range(17)]  # 102
    bat, _ = aggregate.compute_batting(pd.DataFrame(rows), pd.DataFrame(
        columns=["tournament_id", "innings_id", "bowler_id", "player_out_id", "dismissal_kind"]))
    h = bat[bat["player_id"] == "H"].iloc[0]
    assert h["bat_fifties"] == 1  # innings 1 (55)
    assert h["bat_hundreds"] == 1  # innings 2 (102)
    assert h["bat_highest"] == 102


def test_bowler_wicket_kinds():
    assert "caught" in BOWLER_WICKET_KINDS
    assert "run out" not in BOWLER_WICKET_KINDS
    assert "retired hurt" not in BOWLER_WICKET_KINDS


def test_era_lookup():
    assert era_for("ODI", 2003) == "ODI_2000s"
    assert era_for("ODI", 2023) == "ODI_2020s"
    assert era_for("T20", 2016) == "T20_2013_2018"
    assert era_for("ODI", 1975) is None  # no era window covers it


# --- normalization direction & nulls -------------------------------------
def test_normalization_direction():
    df = pd.DataFrame(
        {
            "tournament_id": ["T", "T", "T"],
            "era_id": [None, None, None],
            "player_id": ["p1", "p2", "p3"],
            "bat_innings": [5, 5, 5],
            "bowl_innings": [5, 5, 5],
            "bat_runs": [100, 200, 300],
            "bat_average": [10.0, 20.0, 30.0],
            "bat_strike_rate": [80.0, 100.0, 120.0],
            "bat_runs_per_innings": [20.0, 40.0, 60.0],
            "bat_boundary_rate": [0.1, 0.2, 0.3],
            "bowl_wickets": [2, 5, 8],
            "bowl_economy": [4.0, 6.0, 8.0],  # LOWER is better
            "bowl_average": [20.0, 30.0, 40.0],
            "bowl_strike_rate": [24.0, 30.0, 36.0],
            "bowl_wickets_per_innings": [0.4, 1.0, 1.6],
        }
    )
    out = features.add_normalized_features(df)
    # Higher runs -> higher percentile
    assert out.loc[2, "bat_runs_tourn_pct"] > out.loc[0, "bat_runs_tourn_pct"]
    # LOWER economy -> HIGHER percentile (direction corrected)
    assert out.loc[0, "bowl_economy_tourn_pct"] > out.loc[2, "bowl_economy_tourn_pct"]
    # percentiles in [0,100]
    pcts = out[[c for c in out.columns if c.endswith("_tourn_pct")]].to_numpy()
    pcts = pcts[~np.isnan(pcts)]
    assert pcts.min() >= 0 and pcts.max() <= 100


def test_normalization_excludes_non_participants():
    df = pd.DataFrame(
        {
            "tournament_id": ["T", "T"],
            "era_id": [None, None],
            "player_id": ["batter", "nonbatter"],
            "bat_innings": [5, 0],  # second never batted
            "bowl_innings": [0, 0],
            "bat_runs": [200, 0],
            "bat_average": [40.0, np.nan],
            "bat_strike_rate": [100.0, np.nan],
            "bat_runs_per_innings": [40.0, np.nan],
            "bat_boundary_rate": [0.2, np.nan],
            "bowl_wickets": [0, 0],
            "bowl_economy": [np.nan, np.nan],
            "bowl_average": [np.nan, np.nan],
            "bowl_strike_rate": [np.nan, np.nan],
            "bowl_wickets_per_innings": [np.nan, np.nan],
        }
    )
    out = features.add_normalized_features(df)
    # Non-batter gets NaN percentile (not a misleading value)
    assert np.isnan(out.loc[1, "bat_runs_tourn_pct"])
