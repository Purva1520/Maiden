#!/usr/bin/env python3
"""Validate the calibrated simulation config (Phase 7, §57).

Checks required parameters exist, probabilities are valid, ODI and T20 (and their
phases) are present, and version metadata exists.

Usage:
    python scripts/validate_simulation_config.py
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG = REPO_ROOT / "data" / "game" / "simulation" / "simulation_config_v1.json"

OUTCOMES = ("DOT", "ONE", "TWO", "THREE", "FOUR", "SIX", "WICKET")
PHASES = ("POWERPLAY", "MIDDLE", "DEATH")


def main() -> int:
    if not CONFIG.exists():
        print(f"[ERROR] config not found: {CONFIG}")
        print("Run: pnpm --filter @maiden/simulator calibrate")
        return 2

    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    errors: list[str] = []

    for key in ("simulationVersion", "calibrationVersion", "formats"):
        if key not in cfg:
            errors.append(f"missing top-level key: {key}")

    for fmt in ("ODI", "T20"):
        model = cfg.get("formats", {}).get(fmt)
        if model is None:
            errors.append(f"missing format: {fmt}")
            continue
        base = model.get("base", {})
        total = 0.0
        for o in OUTCOMES:
            v = base.get(o)
            if not isinstance(v, (int, float)) or not (0.0 <= v <= 1.0):
                errors.append(f"{fmt}.base.{o} invalid: {v!r}")
            else:
                total += v
        if abs(total - 1.0) > 0.02:
            errors.append(f"{fmt}.base sums to {total:.3f}, expected ~1")
        phases = model.get("phaseMultipliers", {})
        for ph in PHASES:
            if ph not in phases:
                errors.append(f"{fmt}.phaseMultipliers.{ph} missing")
        for field in ("skill", "style", "matchState", "parRunRate"):
            if field not in model:
                errors.append(f"{fmt}.{field} missing")

    print("MAIDEN SIMULATION CONFIG VALIDATION")
    print("===================================")
    print(f"Config: {CONFIG}")
    print(f"simulationVersion: {cfg.get('simulationVersion')}")
    print(f"calibrationVersion: {cfg.get('calibrationVersion')}")
    print(f"calibratedAgainst: {cfg.get('calibratedAgainst')}")
    for fmt in ("ODI", "T20"):
        base = cfg.get("formats", {}).get(fmt, {}).get("base", {})
        print(f"  {fmt} base: " + ", ".join(f"{o}={base.get(o)}" for o in OUTCOMES))

    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  [ERROR] {e}")
        print("\nSTATUS: FAIL")
        return 1
    print("\nSTATUS: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
