"""Batting rating model: Phase 4 batting features -> latent batting score.

Latent (unshrunk and shrunk) is a weighted mean of blended tournament+era
percentiles for the selected batting features, computed per format with that
format's weights. Only players who batted (bat_innings > 0) receive a latent;
others are UNOBSERVED (§46/§66). The latent is mapped to 0-99 by the calibration
layer, not here.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .normalization import apply_shrinkage, sample_confidence, weighted_latent


def compute_latent(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Return bat_latent, bat_latent_shrunk, bat_confidence aligned to df."""
    blend = cfg["blend"]
    shrink = cfg["shrinkage"]
    conf_cfg = cfg["confidence_innings"]

    latent = pd.Series(np.nan, index=df.index)
    for fmt, feats in cfg["features"].items():
        mask = (df["format"] == fmt) & (df["bat_innings"] > 0)
        if mask.any():
            latent.loc[mask] = weighted_latent(df.loc[mask], feats, blend)

    observed = df["bat_innings"] > 0
    shrunk = apply_shrinkage(
        latent, df["bat_innings"], shrink["innings_constant_k"], shrink["toward_percentile"]
    )
    conf = sample_confidence(df["bat_innings"], conf_cfg["high"], conf_cfg["medium"])

    return pd.DataFrame(
        {
            "bat_latent": latent.where(observed),
            "bat_latent_shrunk": shrunk.where(observed),
            "bat_confidence": conf,
        }
    )
