"""Bowling rating model: Phase 4 bowling features -> latent bowling score.

Mirror of the batting model. Bowling percentiles from Phase 4 are already
direction-corrected (low economy/average/strike-rate -> high percentile), so the
same "higher is better" weighted mean applies. Only players who bowled
(bowl_innings > 0) receive a latent (§46/§66).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .normalization import apply_shrinkage, sample_confidence, weighted_latent


def compute_latent(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Return bowl_latent, bowl_latent_shrunk, bowl_confidence aligned to df."""
    blend = cfg["blend"]
    shrink = cfg["shrinkage"]
    conf_cfg = cfg["confidence_innings"]

    latent = pd.Series(np.nan, index=df.index)
    for fmt, feats in cfg["features"].items():
        mask = (df["format"] == fmt) & (df["bowl_innings"] > 0)
        if mask.any():
            latent.loc[mask] = weighted_latent(df.loc[mask], feats, blend)

    observed = df["bowl_innings"] > 0
    shrunk = apply_shrinkage(
        latent, df["bowl_innings"], shrink["innings_constant_k"], shrink["toward_percentile"]
    )
    conf = sample_confidence(df["bowl_innings"], conf_cfg["high"], conf_cfg["medium"])

    return pd.DataFrame(
        {
            "bowl_latent": latent.where(observed),
            "bowl_latent_shrunk": shrunk.where(observed),
            "bowl_confidence": conf,
        }
    )
