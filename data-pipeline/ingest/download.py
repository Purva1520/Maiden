"""Explicit downloader for Cricsheet archives.

Downloads must be explicit — nothing here runs as a side effect of building the
database. Uses only the standard library (urllib) to avoid extra dependencies.
"""

from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path

from core.logging_setup import get_logger

from .sources import ArchiveSpec

logger = get_logger(__name__)

_USER_AGENT = "maiden-data-pipeline/1.0 (+https://cricsheet.org)"


def download_archive(spec: ArchiveSpec, dest_dir: Path, *, force: bool = False) -> Path:
    """Download a single archive into dest_dir. Returns the local path.

    Skips the download if the file already exists unless force=True. Downloads to
    a temporary ``.part`` file first, then moves it into place so an interrupted
    download never leaves a corrupt archive behind.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / spec.filename

    if dest.exists() and not force:
        logger.info("%s already present (%s bytes) — skipping", spec.filename, dest.stat().st_size)
        return dest

    tmp = dest.with_suffix(dest.suffix + ".part")
    logger.info("Downloading %s -> %s", spec.url, dest)
    request = urllib.request.Request(spec.url, headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(request) as response, tmp.open("wb") as fh:  # noqa: S310
        shutil.copyfileobj(response, fh, length=1024 * 256)

    tmp.replace(dest)
    logger.info("Downloaded %s (%s bytes)", spec.filename, dest.stat().st_size)
    return dest


def download_all(specs: list[ArchiveSpec], dest_dir: Path, *, force: bool = False) -> list[Path]:
    return [download_archive(spec, dest_dir, force=force) for spec in specs]
