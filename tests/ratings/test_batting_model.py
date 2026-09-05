"""Batting model unit tests: feature blending, weighting, shrinkage, nulls."""

from __future__ import annotations

import numpy as np
import pandas as pd

from rating import batting_model
from rating.normalization import apply_shrinkage, blended_pct, weighted_latent

_BLEND = {"tournament_pct_weight": 0.5, "era_pct_weight": 0.5}


def test_blended_pct_averages_available():
    df = pd.DataFrame({"m_tourn_pct": [80.0, np.nan], "m_era_pct": [60.0, 40.0]})
    b = blended_pct(df, "m", _BLEND)
    assert b.iloc[0] == 70.0  # mean of 80 and 60
    assert b.iloc[1] == 40.0  # only era available


def test_weighted_latent_renormalizes_over_available():
    df = pd.DataFrame(
        {
            "a_tourn_pct": [100.0],
            "a_era_pct": [100.0],  # -> 100
            "b_tourn_pct": [np.nan],
            "b_era_pct": [np.nan],  # unavailable
        }
    )
    # b is null -> its weight drops; latent = 100 (only a)
    latent = weighted_latent(df, {"a": 0.5, "b": 0.5}, _BLEND)
    assert latent.iloc[0] == 100.0


def test_shrinkage_pulls_small_samples_toward_50():
    latent = pd.Series([90.0, 90.0])
    innings = pd.Series([1, 100])
    shrunk = apply_shrinkage(latent, innings, k=3.0, toward=50.0)
    # 1 innings -> heavily shrunk toward 50; 100 innings -> barely moved
    assert shrunk.iloc[0] < shrunk.iloc[1]
    assert 50 < shrunk.iloc[0] < 90
    assert shrunk.iloc[1] > 88


def test_compute_latent_unobserved_is_nan():
    df = pd.DataFrame(
        {
            "format": ["ODI", "ODI"],
            "bat_innings": [5, 0],  # second never batted
            "bat_runs_per_innings_tourn_pct": [80.0, np.nan],
            "bat_runs_per_innings_era_pct": [80.0, np.nan],
            "bat_average_tourn_pct": [70.0, np.nan],
            "bat_average_era_pct": [70.0, np.nan],
            "bat_strike_rate_tourn_pct": [60.0, np.nan],
            "bat_strike_rate_era_pct": [60.0, np.nan],
            "bat_runs_tourn_pct": [90.0, np.nan],
            "bat_runs_era_pct": [90.0, np.nan],
        }
    )
    cfg = {
        "blend": _BLEND,
        "shrinkage": {"toward_percentile": 50.0, "innings_constant_k": 3.0},
        "confidence_innings": {"high": 5, "medium": 3},
        "features": {
            "ODI": {
                "bat_runs_per_innings": 0.3,
                "bat_average": 0.28,
                "bat_strike_rate": 0.22,
                "bat_runs": 0.2,
            }
        },
    }
    out = batting_model.compute_latent(df, cfg)
    assert not np.isnan(out["bat_latent"].iloc[0])  # batted -> latent
    assert np.isnan(out["bat_latent"].iloc[1])  # unobserved -> NaN
    assert out["bat_confidence"].iloc[0] == "HIGH"  # 5 innings
    assert out["bat_confidence"].iloc[1] == "UNOBSERVED"
