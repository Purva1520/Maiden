"""Cricsheet Player Register downloader, parser, and loader.

Ingests Cricsheet's official Register files:
  - people.csv: master list mapping 8-char hex identifiers to names and external keys
    (cricinfo, bcci, etc.)
  - names.csv: alternate and variant names for people in the register

Section 4 & 24 rules:
* Uses Cricsheet Register as a primary identity signal when available.
* Ingests identifiers and name variations into the identity layer.
* Preserves source provenance ('cricsheet', 'Cricsheet Register').
"""

from __future__ import annotations

import csv
import shutil
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from cleaning.names import normalize_name_for_matching, normalize_person_name
from core import config
from core.logging_setup import get_logger

logger = get_logger(__name__)

REGISTER_PEOPLE_URL = "https://cricsheet.org/register/people.csv"
REGISTER_NAMES_URL = "https://cricsheet.org/register/names.csv"
_USER_AGENT = "maiden-data-pipeline/1.0 (+https://cricsheet.org)"


@dataclass
class RegisterPerson:
    """A person represented in the Cricsheet Register."""

    identifier: str  # Cricsheet hex person ID, e.g. 'b4a23876'
    name: str  # Standard name, e.g. 'Sachin Tendulkar'
    unique_name: str  # Unique disambiguated name, e.g. 'SR Tendulkar'
    external_ids: dict[str, str] = field(default_factory=dict)  # type -> value
    aliases: set[str] = field(default_factory=set)  # set of raw alias strings


@dataclass
class RegisterData:
    """Indexed in-memory view of the Cricsheet Register."""

    people_by_id: dict[str, RegisterPerson] = field(default_factory=dict)
    # Maps normalized name -> list of candidate RegisterPersons (for ambiguity detection)
    people_by_normalized_name: dict[str, list[RegisterPerson]] = field(default_factory=dict)
    # Maps (id_type, id_value) -> RegisterPerson
    people_by_external_id: dict[tuple[str, str], RegisterPerson] = field(default_factory=dict)


def download_register(
    dest_dir: Path | None = None,
    *,
    force: bool = False,
) -> tuple[Path, Path]:
    """Download people.csv and names.csv into dest_dir (defaults to data/raw/register).

    Returns:
        (people_path, names_path)
    """
    dest = dest_dir or (config.RAW_DIR / "register")
    dest.mkdir(parents=True, exist_ok=True)

    people_file = dest / "people.csv"
    names_file = dest / "names.csv"

    for url, path in ((REGISTER_PEOPLE_URL, people_file), (REGISTER_NAMES_URL, names_file)):
        if path.exists() and not force:
            logger.debug("%s already present (%d bytes) — skipping", path.name, path.stat().st_size)
            continue

        tmp = path.with_suffix(path.suffix + ".part")
        logger.info("Downloading %s -> %s", url, path)
        request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(request) as response, tmp.open("wb") as fh:  # noqa: S310
            shutil.copyfileobj(response, fh, length=1024 * 256)
        tmp.replace(path)
        logger.info("Downloaded %s (%d bytes)", path.name, path.stat().st_size)

    return people_file, names_file


def load_register(
    dest_dir: Path | None = None,
    *,
    download_if_missing: bool = True,
    force_download: bool = False,
) -> RegisterData:
    """Load and index Cricsheet Register CSVs.

    Returns an indexed ``RegisterData`` instance.
    """
    dest = dest_dir or (config.RAW_DIR / "register")
    people_file = dest / "people.csv"
    names_file = dest / "names.csv"

    if (
        not people_file.exists() or not names_file.exists() or force_download
    ) and download_if_missing:
        try:
            download_register(dest, force=force_download)
        except Exception as err:
            logger.warning("Failed to download Cricsheet Register: %s", err)
            if not people_file.exists():
                return RegisterData()

    if not people_file.exists():
        logger.warning("Cricsheet Register people.csv not found at %s", people_file)
        return RegisterData()

    reg = RegisterData()

    # 1. Parse people.csv
    with people_file.open("r", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            ident = row.get("identifier", "").strip()
            if not ident:
                continue
            name = normalize_person_name(row.get("name", ""))
            unique_name = normalize_person_name(row.get("unique_name", ""))

            # Extract external keys (key_cricinfo, key_bcci, etc.)
            ext_ids: dict[str, str] = {}
            for col, val in row.items():
                if col.startswith("key_") and val and val.strip():
                    key_type = col.replace("key_", "")
                    ext_ids[key_type] = val.strip()

            person = RegisterPerson(
                identifier=ident,
                name=name,
                unique_name=unique_name,
                external_ids=ext_ids,
            )
            person.aliases.add(name)
            if unique_name and unique_name != name:
                person.aliases.add(unique_name)

            reg.people_by_id[ident] = person

            # Index external IDs
            for id_type, id_val in ext_ids.items():
                reg.people_by_external_id[(id_type, id_val)] = person

    # 2. Parse names.csv (alternate names)
    if names_file.exists():
        with names_file.open("r", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                ident = row.get("identifier", "").strip()
                alt_name = normalize_person_name(row.get("name", ""))
                if ident in reg.people_by_id and alt_name:
                    reg.people_by_id[ident].aliases.add(alt_name)

    # 3. Build normalized name index for all aliases
    for person in reg.people_by_id.values():
        for alias in person.aliases:
            norm = normalize_name_for_matching(alias)
            if not norm:
                continue
            candidates = reg.people_by_normalized_name.setdefault(norm, [])
            if person not in candidates:
                candidates.append(person)

    logger.info(
        "Loaded Cricsheet Register: %d people, %d unique normalized names",
        len(reg.people_by_id),
        len(reg.people_by_normalized_name),
    )
    return reg
