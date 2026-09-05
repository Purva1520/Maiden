"""Regression tests: golden ratings from the finalized v1 model.

Values were generated from the reviewed v1 model and committed deliberately.
They span old/new tournaments and both formats (§85). Skipped when the Phase 4
dataset is not present locally (e.g. CI without generated artifacts).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core import config  # noqa: E402

pytestmark = pytest.mark.skipif(
    not config.STATS_PARQUET.exists(),
    reason="player_tournament_stats.parquet not built",
)

# (tournament_id, player_id, column, expected)
GOLDEN = [
    ("ODI_WC_2003", "sachin_tendulkar", "bat_rating", 88),
    ("ODI_WC_2015", "ma_starc", "bowl_rating", 97),
    ("T20_WC_2010", "dpmd_jayawardene", "bat_rating", 99),
    ("T20_WC_2024", "jj_bumrah", "bowl_rating", 94),
]


@pytest.fixture(scope="module")
def ratings():
    from rating.pipeline import build_ratings
    from rating.versions import load_config

    return build_ratings(load_config("v1"))


@pytest.mark.parametrize("tid,pid,col,expected", GOLDEN)
def test_golden_rating(ratings, tid, pid, col, expected):
    row = ratings[(ratings["tournament_id"] == tid) & (ratings["player_id"] == pid)]
    assert len(row) == 1, f"expected one row for {pid} in {tid}"
    assert int(row.iloc[0][col]) == expected


def test_deterministic_rebuild(ratings):
    from rating.pipeline import build_ratings
    from rating.versions import load_config

    again = build_ratings(load_config("v1"))
    for col in ("bat_rating", "bowl_rating"):
        a = ratings[col].astype("Float64").fillna(-1).tolist()
        b = again[col].astype("Float64").fillna(-1).tolist()
        assert a == b


def test_all_ratings_in_range(ratings):
    for col in ("bat_rating", "bowl_rating"):
        v = ratings[col].dropna()
        assert v.min() >= 0 and v.max() <= 99
