"""Phase 0 smoke tests for the Python data pipeline environment.

These prove the toolchain is wired up correctly — the scientific stack imports
and computes, and each pipeline stage package is importable. They deliberately
do NOT test any real data processing, which does not exist yet.
"""

import importlib

import numpy as np
import pandas as pd
import scipy


def test_scientific_stack_available() -> None:
    assert np.array([1, 2, 3]).sum() == 6
    assert pd.Series([1, 2, 3]).mean() == 2
    assert hasattr(scipy, "__version__")


def test_pipeline_stage_packages_importable() -> None:
    for stage in ("ingest", "cleaning", "normalization", "ratings", "validation", "export"):
        module = importlib.import_module(stage)
        assert module.__doc__ is not None
