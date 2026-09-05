"""Calibration unit tests: range, monotonicity, determinism, format separation."""

from __future__ import annotations

import numpy as np
import pandas as pd

from rating.calibration import calibrate

_TARGETS = {"ODI_batting": {"mean": 52.0, "sd": 15.0}}
_CLIP = {"min": 0, "max": 99}


def _run(latents):
    latent = pd.Series(latents, dtype=float)
    group = pd.Series(["ODI_batting"] * len(latents))
    return calibrate(latent, group, _TARGETS, _CLIP)


def test_range_0_99():
    r = _run(list(range(0, 101)))
    v = r.dropna()
    assert v.min() >= 0 and v.max() <= 99
    assert (v == v.round()).all()


def test_monotonic():
    latents = [10, 30, 50, 70, 90]
    r = _run(latents).tolist()
    assert r == sorted(r)  # higher latent -> higher (or equal) rating


def test_median_maps_near_target_mean():
    r = _run(list(np.linspace(0, 100, 201)))
    assert abs(r.median() - 52.0) <= 2.0  # target mean


def test_deterministic():
    a = _run([10, 20, 30, 40, 50])
    b = _run([10, 20, 30, 40, 50])
    assert a.equals(b)


def test_nan_latent_stays_nan():
    latent = pd.Series([50.0, np.nan, 80.0])
    group = pd.Series(["ODI_batting", None, "ODI_batting"])
    r = calibrate(latent, group, _TARGETS, _CLIP)
    assert np.isnan(r.iloc[1])
    assert r.notna().sum() == 2
