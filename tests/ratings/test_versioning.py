"""Versioning/config-loading tests."""

from __future__ import annotations

from rating.versions import RATING_MODEL_VERSION, load_config


def test_load_config_v1():
    cfg = load_config("v1")
    assert cfg.model_version == "v1"
    assert cfg.calibration_version == "v1"
    # Format-specific weights present and non-empty.
    assert set(cfg.batting["features"]) == {"ODI", "T20"}
    assert set(cfg.bowling["features"]) == {"ODI", "T20"}
    assert cfg.calibration["method"] == "normal_quantile"
    # Calibration targets exist for all four populations.
    for key in ("ODI_batting", "ODI_bowling", "T20_batting", "T20_bowling"):
        assert key in cfg.calibration["targets"]


def test_batting_weights_differ_by_format():
    cfg = load_config("v1")
    # T20 weights strike rate more heavily than ODI (documented format difference).
    assert (
        cfg.batting["features"]["T20"]["bat_strike_rate"]
        > cfg.batting["features"]["ODI"]["bat_strike_rate"]
    )


def test_default_version_constant():
    assert RATING_MODEL_VERSION == "v1"
