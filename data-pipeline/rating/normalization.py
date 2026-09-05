"""Turn Phase 4 normalized features into rating-model features.

This layer only *combines* the existing Phase 4 percentiles (tournament + era);
it does not re-implement Phase 4's normalization engine (§41). All percentiles
are already direction-corrected (higher = better) and null when the skill was
not observed, so a null feature is dropped from the weighted mean rather than
treated as zero (§45).
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def blended_pct(df: pd.DataFrame, metric: str, blend: dict) -> pd.Series:
    """Blend a metric's tournament and era percentiles (null-aware)."""
    t = df[f"{metric}_tourn_pct"]
    e = df[f"{metric}_era_pct"]
    wt = float(blend["tournament_pct_weight"])
    we = float(blend["era_pct_weight"])
    tp = t.notna()
    ep = e.notna()
    num = t.fillna(0.0) * wt * tp + e.fillna(0.0) * we * ep
    den = wt * tp + we * ep
    return pd.Series(np.where(den > 0, num / den.replace(0, np.nan), np.nan), index=df.index)


def weighted_latent(df: pd.DataFrame, features: dict[str, float], blend: dict) -> pd.Series:
    """Weighted mean of blended percentiles, renormalized over available features.

    Returns a latent in [0, 100], or NaN if no feature is available for a row.
    """
    num = pd.Series(0.0, index=df.index)
    den = pd.Series(0.0, index=df.index)
    for metric, weight in features.items():
        b = blended_pct(df, metric, blend)
        present = b.notna()
        num = num + b.fillna(0.0) * float(weight) * present
        den = den + float(weight) * present
    return pd.Series(np.where(den > 0, num / den.replace(0, np.nan), np.nan), index=df.index)


def apply_shrinkage(latent: pd.Series, innings: pd.Series, k: float, toward: float) -> pd.Series:
    """Shrink the latent toward `toward` by sample size: w = n/(n+k) (§21)."""
    n = innings.astype(float)
    w = n / (n + float(k))
    shrunk = w * latent + (1.0 - w) * float(toward)
    # Preserve NaN where the latent is undefined (skill not observed).
    return shrunk.where(latent.notna(), np.nan)


def sample_confidence(innings: pd.Series, high: int, medium: int) -> pd.Series:
    """HIGH/MEDIUM/LOW/UNOBSERVED from innings count (metadata, not a penalty)."""
    n = innings.fillna(0).astype(int)
    out = pd.Series("UNOBSERVED", index=innings.index, dtype=object)
    out = out.mask(n >= 1, "LOW")
    out = out.mask(n >= int(medium), "MEDIUM")
    out = out.mask(n >= int(high), "HIGH")
    return out
