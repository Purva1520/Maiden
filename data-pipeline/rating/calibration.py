"""Calibration: latent scores -> 0-99 ratings.

Method ``normal_quantile``: within each (format, skill) population — pooled across
ALL tournaments so ratings are cross-era comparable (§26/§27) and separate per
format (§28) — the latent is quantile-normalized to a target normal:

    p = (rank - 0.5) / N               # Hazen plotting position
    rating = clip(round(mean + sd * Phi^-1(p)), 0, 99)

Monotonic (higher latent -> higher rating), deterministic (ties share a rank),
and it does not force each tournament's best performer to 99.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import norm


def calibrate(latent: pd.Series, group: pd.Series, targets: dict, clip: dict) -> pd.Series:
    """Map latent scores to 0-99 within each population group.

    `group` labels each row with a "<FORMAT>_<skill>" key present in `targets`.
    Returns a float Series (NaN where latent is NaN / group unobserved).
    """
    out = pd.Series(np.nan, index=latent.index, dtype=float)
    lo, hi = float(clip["min"]), float(clip["max"])

    for key in sorted(group.dropna().unique()):
        mask = (group == key) & latent.notna()
        n = int(mask.sum())
        if n == 0:
            continue
        target = targets.get(key)
        if target is None:
            raise KeyError(f"No calibration target for population '{key}'")
        sub = latent[mask]
        ranks = sub.rank(method="average")
        p = ((ranks - 0.5) / n).clip(1e-6, 1 - 1e-6)
        rating = target["mean"] + target["sd"] * norm.ppf(p)
        out.loc[mask] = rating.clip(lo, hi).round()
    return out
