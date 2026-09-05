#!/usr/bin/env python3
"""Build the historical calibration reference distributions (Phase 7).

Reads maiden.sqlite and writes:
    data/processed/historical_calibration.parquet          (per-innings rows)
    data/processed/historical_calibration_summary.json     (ODI/T20 summary)
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from calibration.historical import build  # noqa: E402
from core import config  # noqa: E402
from core.logging_setup import configure_logging, get_logger  # noqa: E402

logger = get_logger("historical_calibration")


def main() -> int:
    configure_logging()
    if not config.DB_PATH.exists():
        logger.error("Database not found: %s", config.DB_PATH)
        return 2
    conn = sqlite3.connect(config.DB_PATH)
    try:
        logger.info("Computing historical calibration distributions...")
        result = build(conn)
    finally:
        conn.close()

    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    parquet = config.PROCESSED_DIR / "historical_calibration.parquet"
    result["innings"].to_parquet(parquet, index=False)
    summary_path = config.PROCESSED_DIR / "historical_calibration_summary.json"
    summary_path.write_text(json.dumps(result["summary"], indent=2) + "\n", encoding="utf-8")

    for fmt, s in result["summary"]["formats"].items():
        logger.info(
            "%s: %d full innings | score mean=%.1f rr=%.2f wkt/100=%.2f 4/100=%.2f 6/100=%.2f chase=%.1f%%",
            fmt,
            s["innings_count"],
            s["score"]["mean"],
            s["run_rate"]["mean"],
            s["wicket_rate"]["mean"],
            s["four_rate"]["mean"],
            s["six_rate"]["mean"],
            (s["chase"]["success_rate"] or 0) * 100,
        )
    logger.info("Wrote %s and %s", parquet, summary_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
