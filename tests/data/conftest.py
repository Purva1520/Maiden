"""Shared fixtures for the data-pipeline test suite."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURE_DIR = Path(__file__).parent / "cricsheet"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


@pytest.fixture
def odi_json() -> dict:
    return load_fixture("sample_odi.json")


@pytest.fixture
def t20_json() -> dict:
    return load_fixture("sample_t20.json")
