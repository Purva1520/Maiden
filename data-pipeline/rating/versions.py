"""Rating model versioning and configuration loading.

A final rating is reproducible from its version metadata + committed config files
under data/game/ratings/. Statistics/normalization versions are inherited from
the Phase 4 manifest so lineage is preserved end to end.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from core import config

RATING_MODEL_VERSION = "v1"


@dataclass(frozen=True)
class RatingConfig:
    """All configuration + versions needed to generate a rating batch."""

    model_version: str
    calibration_version: str
    statistics_version: int | str
    normalization_version: int | str
    batting: dict
    bowling: dict
    calibration: dict


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _phase4_versions() -> tuple[int | str, int | str]:
    """Read statistics/normalization versions from the Phase 4 manifest."""
    manifest = config.STATS_MANIFEST
    if manifest.exists():
        m = _load_json(manifest)
        return (
            m.get("statistics_schema_version", "unknown"),
            m.get("normalization_version", "unknown"),
        )
    return ("unknown", "unknown")


def load_config(version: str = RATING_MODEL_VERSION) -> RatingConfig:
    """Load the batting/bowling/calibration configs for a model version."""
    cfg_dir = config.RATINGS_CONFIG_DIR
    batting = _load_json(cfg_dir / f"batting_{version}.json")
    bowling = _load_json(cfg_dir / f"bowling_{version}.json")
    calibration = _load_json(cfg_dir / f"calibration_{version}.json")
    stats_v, norm_v = _phase4_versions()
    return RatingConfig(
        model_version=version,
        calibration_version=calibration.get("version", version),
        statistics_version=stats_v,
        normalization_version=norm_v,
        batting=batting,
        bowling=bowling,
        calibration=calibration,
    )
