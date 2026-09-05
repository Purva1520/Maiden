"""Bowling model unit tests (mirror of batting; direction handled in Phase 4)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from rating import bowling_model

_BLEND = {"tournament_pct_weight": 0.5, "era_pct_weight": 0.5}
_CFG = {
    "blend": _BLEND,
    "shrinkage": {"toward_percentile": 50.0, "innings_constant_k": 3.0},
    "confidence_innings": {"high": 5, "medium": 3},
    "features": {
        "ODI": {
            "bowl_economy": 0.3,
            "bowl_wickets": 0.3,
            "bowl_average": 0.25,
            "bowl_strike_rate": 0.15,
        }
    },
}


def _row(bowl_innings, pct):
    cols = {"format": "ODI", "bowl_innings": bowl_innings}
    for m in ("bowl_economy", "bowl_wickets", "bowl_average", "bowl_strike_rate"):
        cols[f"{m}_tourn_pct"] = pct
        cols[f"{m}_era_pct"] = pct
    return cols


def test_bowling_latent_reflects_percentiles():
    df = pd.DataFrame([_row(6, 90.0), _row(6, 20.0)])
    out = bowling_model.compute_latent(df, _CFG)
    # Higher (already direction-corrected) percentiles -> higher latent
    assert out["bowl_latent"].iloc[0] > out["bowl_latent"].iloc[1]


def test_bowling_unobserved_is_nan():
    df = pd.DataFrame([_row(0, np.nan)])
    out = bowling_model.compute_latent(df, _CFG)
    assert np.isnan(out["bowl_latent"].iloc[0])
    assert out["bowl_confidence"].iloc[0] == "UNOBSERVED"


def test_bowling_confidence_levels():
    df = pd.DataFrame([_row(5, 50.0), _row(3, 50.0), _row(1, 50.0)])
    out = bowling_model.compute_latent(df, _CFG)
    assert list(out["bowl_confidence"]) == ["HIGH", "MEDIUM", "LOW"]
