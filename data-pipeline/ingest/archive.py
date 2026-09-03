"""Safe discovery and streaming of Cricsheet ZIP archive members.

Match JSON files are read one at a time directly from the ZIP (never extracting
the whole archive into memory) so a large dataset stays memory-friendly.
"""

from __future__ import annotations

import json
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.logging_setup import get_logger

logger = get_logger(__name__)


@dataclass
class RawMatch:
    """A single raw match JSON read from an archive."""

    match_id: str  # Cricsheet match id (the JSON filename stem)
    source_file: str  # archive member path, e.g. "1000887.json"
    data: dict[str, Any]  # parsed JSON


def _is_match_member(name: str) -> bool:
    # Cricsheet JSON archives contain "<id>.json" files plus a README.txt.
    if not name.endswith(".json"):
        return False
    # Guard against unsafe/nested paths.
    return "/" not in name and "\\" not in name


def count_matches(archive_path: Path) -> int:
    with zipfile.ZipFile(archive_path) as zf:
        return sum(1 for n in zf.namelist() if _is_match_member(n))


def iter_raw_matches(archive_path: Path) -> Iterator[RawMatch]:
    """Yield RawMatch objects from an archive, one JSON file at a time.

    A member that fails to parse as JSON is skipped with a warning rather than
    aborting the whole archive; the caller records it as a parse error.
    """
    if not archive_path.exists():
        raise FileNotFoundError(f"Archive not found: {archive_path}")

    with zipfile.ZipFile(archive_path) as zf:
        members = sorted(n for n in zf.namelist() if _is_match_member(n))
        logger.info("Found %d match files in %s", len(members), archive_path.name)
        for name in members:
            match_id = name[: -len(".json")]
            try:
                data = json.loads(zf.read(name))
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                logger.warning("Skipping unreadable member %s: %s", name, exc)
                yield RawMatch(
                    match_id=match_id,
                    source_file=name,
                    data={"__parse_error__": str(exc)},
                )
                continue
            yield RawMatch(match_id=match_id, source_file=name, data=data)
