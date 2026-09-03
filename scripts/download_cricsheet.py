#!/usr/bin/env python3
"""Explicitly download the Cricsheet archives used by the Maiden pipeline.

Usage:
    python scripts/download_cricsheet.py                # ODI + T20
    python scripts/download_cricsheet.py --format odi   # ODI only
    python scripts/download_cricsheet.py --format t20   # T20 only
    python scripts/download_cricsheet.py --force        # re-download

Downloads are explicit — nothing here runs as a side effect of building the DB.
Data license: ODC-By v1.0 (see docs/data-policy.md).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make the data-pipeline packages importable regardless of install state.
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from core import config  # noqa: E402
from core.logging_setup import configure_logging, get_logger  # noqa: E402
from ingest.download import download_all  # noqa: E402
from ingest.sources import archives_for  # noqa: E402

logger = get_logger("download")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Download Cricsheet archives.")
    parser.add_argument("--format", default="all", choices=["odi", "t20", "all"])
    parser.add_argument("--force", action="store_true", help="re-download even if present")
    args = parser.parse_args(argv)

    configure_logging()
    specs = archives_for(args.format)
    logger.info("Destination: %s", config.RAW_DIR)
    paths = download_all(specs, config.RAW_DIR, force=args.force)
    for p in paths:
        logger.info("Ready: %s (%s bytes)", p, p.stat().st_size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
