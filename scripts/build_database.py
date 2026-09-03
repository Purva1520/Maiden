#!/usr/bin/env python3
"""Build the normalized Maiden SQLite database from Cricsheet archives.

Usage:
    python scripts/build_database.py                 # ODI + T20
    python scripts/build_database.py --format odi
    python scripts/build_database.py --format t20
    python scripts/build_database.py --format all

Requires the archives to be present in data/raw/cricsheet/ (run
download_cricsheet.py first). The build rebuilds from scratch and atomically
replaces data/processed/maiden.sqlite only on success.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core.logging_setup import configure_logging, get_logger  # noqa: E402
from core.pipeline import build_database  # noqa: E402

logger = get_logger("build")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the Maiden SQLite database.")
    parser.add_argument("--format", default="all", choices=["odi", "t20", "all"])
    args = parser.parse_args(argv)

    configure_logging()
    try:
        report = build_database(args.format)
    except FileNotFoundError as exc:
        logger.error("%s", exc)
        return 2

    print()
    print(report.render_text())
    return 0 if report.status == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
