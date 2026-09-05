"""Normalized tournament- and era-relative features.

For each raw metric we add four columns:
    {metric}_tourn_pct, {metric}_tourn_z, {metric}_era_pct, {metric}_era_z

Percentiles are empirical ranks within the group (0–100); z-scores use the
group mean/std. Both are **direction-corrected** so HIGHER always means BETTER
(e.g. low economy → high percentile, §42). Normalization is computed only over
players who actually batted/bowled (§30) — players with no opportunity get NaN,
never a misleading value. Raw columns are never overwritten (§43).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import BATTING_NORM_FEATURES, BOWLING_NORM_FEATURES


def _normalize_group(
    df: pd.DataFrame, group_col: str, metric: str, direction: int, suffix: str
) -> None:
    """Add direction-corrected percentile + z within `group_col` (in place)."""
    masked = df[f"_norm_{metric}"]  # metric with non-participants set to NaN
    directional = masked * direction

    df[f"{metric}_{suffix}_pct"] = (
        directional.groupby(df[group_col]).rank(pct=True, method="average") * 100
    )
    grp = masked.groupby(df[group_col])
    mean = grp.transform("mean")
    std = grp.transform("std")
    df[f"{metric}_{suffix}_z"] = np.where(std > 0, (masked - mean) / std * direction, np.nan)


def add_normalized_features(player_df: pd.DataFrame) -> pd.DataFrame:
    """Add tournament- and era-relative normalized features to the player df."""
    df = player_df.copy()
    batted = df["bat_innings"] > 0
    bowled = df["bowl_innings"] > 0

    all_metrics = {**BATTING_NORM_FEATURES, **BOWLING_NORM_FEATURES}
    batting_set = set(BATTING_NORM_FEATURES)

    # Masked copies: metric visible only for the relevant participating population.
    for metric in all_metrics:
        mask = batted if metric in batting_set else bowled
        df[f"_norm_{metric}"] = df[metric].where(mask)

    for metric, direction in all_metrics.items():
        _normalize_group(df, "tournament_id", metric, direction, "tourn")
        # Era normalization only where the row has an era.
        _normalize_group(df, "era_id", metric, direction, "era")

    df = df.drop(columns=[c for c in df.columns if c.startswith("_norm_")])
    return df
