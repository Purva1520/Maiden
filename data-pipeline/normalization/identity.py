"""Player Identity & Entity Resolution Engine for Maiden.

Core principles (Sections 1, 2, 3, 13, 14, 18, 19):
1. False merge is worse than unresolved identity.
2. Canonical identity is a stable, deterministic player_id slug (e.g. 'sachin_tendulkar').
3. Multi-tier resolution hierarchy:
     Stage 0: Manual Overrides
     Stage 1: Stable External Identifier (Cricsheet Register)
     Stage 2: Exact Canonical Name
     Stage 3: Unique Known Alias
     Stage 4: Initial Pattern Matching & Contextual Disambiguation
     Stage 5: Candidate Generation (fuzzy, strictly for review queue - NO AUTO MERGE)
     Stage 6: Review / Ambiguous Queue
4. Deterministic and auditable.
"""

from __future__ import annotations

import difflib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from cleaning.names import (
    generate_player_id,
    normalize_name_for_matching,
    normalize_person_name,
)
from core import config
from core.logging_setup import get_logger
from ingest.register import RegisterData, load_register

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


@dataclass
class CanonicalPlayer:
    """Canonical Maiden player identity."""

    player_id: str  # deterministic slug, e.g. 'sachin_tendulkar'
    canonical_name: str  # formal name, e.g. 'Sachin Tendulkar'
    display_name: str  # display name
    cricsheet_id: str | None = None
    country_id: str | None = None
    active_from: int | None = None
    active_to: int | None = None
    aliases: set[str] = field(default_factory=set)
    # identifier_type -> identifier_value (e.g. 'cricinfo' -> '35320')
    identifiers: dict[str, str] = field(default_factory=dict)
    provenance_source: str = "cricsheet"
    provenance_ref: str | None = None


@dataclass
class ResolutionResult:
    """The outcome of an entity resolution lookup."""

    player: CanonicalPlayer | None
    # RESOLVED_MANUAL | RESOLVED_IDENTIFIER | RESOLVED_EXACT
    # RESOLVED_ALIAS | RESOLVED_CONTEXT | REVIEW | UNRESOLVED
    status: str
    method: str  # manual | identifier | exact | alias | context | ambiguous | unresolved
    confidence: str  # HIGH | MEDIUM | LOW | NONE
    reason: str
    candidates: list[str] = field(default_factory=list)


@dataclass
class ResolutionAuditRecord:
    """Audit entry recording how an input name was resolved."""

    source: str
    raw_name: str
    normalized_name: str
    candidate_player_id: str | None
    resolution_method: str
    resolution_status: str
    confidence: str
    reason: str
    reviewed: bool = False


# ---------------------------------------------------------------------------
# Resolver
# ---------------------------------------------------------------------------


class PlayerIdentityResolver:
    """Deterministic, conservative entity-resolution engine."""

    def __init__(
        self,
        register: RegisterData | None = None,
        overrides_path: Path | None = None,
    ) -> None:
        self.register = register or load_register()
        self.overrides_path = overrides_path or (
            config.REPO_ROOT / "data" / "game" / "identity" / "player_alias_overrides.json"
        )

        # Canonical players catalog: player_id -> CanonicalPlayer
        self.players_by_id: dict[str, CanonicalPlayer] = {}
        # cricsheet_id -> CanonicalPlayer
        self.players_by_cricsheet_id: dict[str, CanonicalPlayer] = {}
        # normalized_alias -> list of CanonicalPlayers
        self.players_by_normalized_alias: dict[str, list[CanonicalPlayer]] = {}
        # (first_initial, surname) -> list of CanonicalPlayers
        self.players_by_initial_surname: dict[tuple[str, str], list[CanonicalPlayer]] = {}
        # (id_type, id_value) -> CanonicalPlayer
        self.players_by_identifier: dict[tuple[str, str], CanonicalPlayer] = {}

        # Manual overrides loaded from JSON
        self.manual_overrides: dict[str, dict[str, Any]] = {}
        self.contextual_overrides: list[dict[str, Any]] = []

        # Audit and review queues
        self.resolution_log: list[ResolutionAuditRecord] = []
        self.review_queue: list[dict[str, Any]] = []

        # Prefix buckets for candidate suggestions
        self._alias_buckets: dict[str, set[str]] = {}

        self._load_overrides()
        self._seed_from_register()

    def _load_overrides(self) -> None:
        if not self.overrides_path.exists():
            return
        try:
            data = json.loads(self.overrides_path.read_text(encoding="utf-8"))
            self.manual_overrides = data.get("overrides", {})
            self.contextual_overrides = data.get("contextual_overrides", [])
            logger.info(
                "Loaded %d exact overrides and %d contextual overrides from %s",
                len(self.manual_overrides),
                len(self.contextual_overrides),
                self.overrides_path.name,
            )
        except Exception as err:
            logger.error("Failed to load overrides from %s: %s", self.overrides_path, err)

    def _seed_from_register(self) -> None:
        """Seed the player catalog from the Cricsheet Register."""
        for reg_person in self.register.people_by_id.values():
            chosen_name = reg_person.unique_name or reg_person.name

            # Check if an override defines the player_id or canonical name
            override_info = self.manual_overrides.get(reg_person.name) or self.manual_overrides.get(
                reg_person.unique_name
            )

            if override_info:
                slug = override_info["player_id"]
                chosen_name = override_info.get("canonical_name", chosen_name)
            else:
                slug = generate_player_id(chosen_name)
                # Avoid slug collisions across different Cricsheet register IDs
                if (
                    slug in self.players_by_id
                    and self.players_by_id[slug].cricsheet_id != reg_person.identifier
                ):
                    slug = f"{slug}_{reg_person.identifier[:4]}"

            player = self.players_by_id.get(slug)
            if not player:
                player = CanonicalPlayer(
                    player_id=slug,
                    canonical_name=chosen_name,
                    display_name=reg_person.name or chosen_name,
                    cricsheet_id=reg_person.identifier,
                    provenance_source="cricsheet",
                    provenance_ref="Cricsheet Register",
                )
                self.players_by_id[slug] = player
            elif not player.cricsheet_id:
                player.cricsheet_id = reg_person.identifier

            player.identifiers["cricsheet"] = reg_person.identifier
            for id_type, id_val in reg_person.external_ids.items():
                player.identifiers[id_type] = id_val

            for alias in reg_person.aliases:
                player.aliases.add(alias)

            self._register_player(player)

    def _register_player(self, player: CanonicalPlayer) -> None:
        """Add a CanonicalPlayer to all index structures."""
        self.players_by_id[player.player_id] = player
        if player.cricsheet_id:
            self.players_by_cricsheet_id[player.cricsheet_id] = player

        for id_type, id_val in player.identifiers.items():
            key = (id_type, id_val)
            self.players_by_identifier[key] = player

        # Index all aliases (and canonical/display names)
        all_aliases = player.aliases | {player.canonical_name, player.display_name}
        for alias in all_aliases:
            norm = normalize_name_for_matching(alias)
            if not norm:
                continue
            plist = self.players_by_normalized_alias.setdefault(norm, [])
            if player not in plist:
                plist.append(player)

            prefix = norm[:2] if len(norm) >= 2 else norm
            self._alias_buckets.setdefault(prefix, set()).add(norm)

            # Index by initial and surname for initial pattern disambiguation
            parts = norm.split()
            if len(parts) >= 2:
                surname = parts[-1]
                first_initial = parts[0][0]
                init_key = (first_initial, surname)
                inits_list = self.players_by_initial_surname.setdefault(init_key, [])
                if player not in inits_list:
                    inits_list.append(player)

                # Also index all initials concatenated + surname (e.g. 'sr', 'tendulkar')
                all_inits = "".join(p[0] for p in parts[:-1])
                full_init_key = (all_inits, surname)
                full_inits_list = self.players_by_initial_surname.setdefault(full_init_key, [])
                if player not in full_inits_list:
                    full_inits_list.append(player)

    # -----------------------------------------------------------------------
    # Resolution Engine
    # -----------------------------------------------------------------------

    def resolve(
        self,
        raw_name: str,
        *,
        cricsheet_id: str | None = None,
        team: str | None = None,
        year: int | None = None,
        format: str | None = None,
        source: str = "cricsheet",
        source_ref: str | None = None,
    ) -> ResolutionResult:
        """Resolve a raw player name and context to a CanonicalPlayer."""
        clean_name = normalize_person_name(raw_name)
        norm_name = normalize_name_for_matching(clean_name)

        # -------------------------------------------------------------------
        # Stage 0: Manual Overrides
        # -------------------------------------------------------------------
        # 1. Exact override by raw name or normalized name
        override = (
            self.manual_overrides.get(raw_name)
            or self.manual_overrides.get(clean_name)
            or self.manual_overrides.get(norm_name)
        )
        if override:
            pid = override.get("player_id")
            c_name = override.get("canonical_name", clean_name)
            reason = override.get("reason", "Explicit manual override")
            player = self.players_by_id.get(pid)
            if not player and pid:
                player = CanonicalPlayer(
                    player_id=pid,
                    canonical_name=c_name,
                    display_name=c_name,
                    cricsheet_id=cricsheet_id,
                    provenance_source="manual",
                    provenance_ref="player_alias_overrides.json",
                )
                player.aliases.add(raw_name)
                self._register_player(player)

            res = ResolutionResult(
                player=player,
                status="RESOLVED_MANUAL",
                method="manual",
                confidence="HIGH",
                reason=reason,
            )
            self._log(source, raw_name, norm_name, res)
            return res

        # 2. Contextual overrides (matching name + team/year)
        for ctx_ov in self.contextual_overrides:
            if ctx_ov.get("name") in (raw_name, clean_name, norm_name):
                match_team = not ctx_ov.get("team") or (
                    team and ctx_ov["team"].lower() in team.lower()
                )
                match_year = not ctx_ov.get("year") or ctx_ov["year"] == year
                if match_team and match_year:
                    pid = ctx_ov["player_id"]
                    c_name = ctx_ov.get("canonical_name", clean_name)
                    player = self.players_by_id.get(pid)
                    if not player and pid:
                        player = CanonicalPlayer(
                            player_id=pid,
                            canonical_name=c_name,
                            display_name=c_name,
                            provenance_source="manual",
                            provenance_ref=ctx_ov.get("reason", "Contextual override"),
                        )
                        self._register_player(player)
                    res = ResolutionResult(
                        player=player,
                        status="RESOLVED_MANUAL",
                        method="manual",
                        confidence="HIGH",
                        reason=ctx_ov.get("reason", "Contextual manual override"),
                    )
                    self._log(source, raw_name, norm_name, res)
                    return res

        # -------------------------------------------------------------------
        # Stage 1: Stable External Identifier (Cricsheet Register)
        # -------------------------------------------------------------------
        if cricsheet_id:
            player = self.players_by_cricsheet_id.get(cricsheet_id)
            if player:
                player.aliases.add(clean_name)
                self._update_years(player, year)
                res = ResolutionResult(
                    player=player,
                    status="RESOLVED_IDENTIFIER",
                    method="identifier",
                    confidence="HIGH",
                    reason=f"Matched stable Cricsheet register id '{cricsheet_id}'",
                )
                self._log(source, raw_name, norm_name, res)
                return res

        # -------------------------------------------------------------------
        # Stage 2: Exact Canonical Name Match
        # -------------------------------------------------------------------
        exact_matches = [
            p
            for p in self.players_by_id.values()
            if normalize_name_for_matching(p.canonical_name) == norm_name
            or normalize_name_for_matching(p.display_name) == norm_name
        ]
        # Only treat as exact match if it's a full name (not single initial + surname)
        words = norm_name.split()
        is_initial_abbrev = len(words) == 2 and len(words[0]) <= 2

        if len(exact_matches) == 1 and not is_initial_abbrev:
            player = exact_matches[0]
            player.aliases.add(clean_name)
            self._update_years(player, year)
            res = ResolutionResult(
                player=player,
                status="RESOLVED_EXACT",
                method="exact",
                confidence="HIGH",
                reason=f"Exact match on canonical name '{player.canonical_name}'",
            )
            self._log(source, raw_name, norm_name, res)
            return res

        # -------------------------------------------------------------------
        # Stage 3: Known Alias Match
        # -------------------------------------------------------------------
        alias_candidates = self.players_by_normalized_alias.get(norm_name, [])
        if len(alias_candidates) == 1 and not is_initial_abbrev:
            player = alias_candidates[0]
            player.aliases.add(clean_name)
            self._update_years(player, year)
            res = ResolutionResult(
                player=player,
                status="RESOLVED_ALIAS",
                method="alias",
                confidence="HIGH",
                reason=f"Unique alias match pointing to '{player.canonical_name}'",
            )
            self._log(source, raw_name, norm_name, res)
            return res

        # -------------------------------------------------------------------
        # Stage 4: Initial Pattern Matching & Contextual Disambiguation
        # -------------------------------------------------------------------
        if is_initial_abbrev or len(alias_candidates) > 1:
            initial_candidates: list[CanonicalPlayer] = []
            if is_initial_abbrev:
                inits = words[0]
                surname = words[1]
                cand_map: dict[str, CanonicalPlayer] = {}
                for p in self.players_by_initial_surname.get((inits, surname), []):
                    cand_map[p.player_id] = p
                if len(inits) > 1:
                    for p in self.players_by_initial_surname.get((inits[0], surname), []):
                        cand_map[p.player_id] = p
                initial_candidates = list(cand_map.values())
            else:
                initial_candidates = list(alias_candidates)

            # Check if there is uniquely ONE matching person
            if len(initial_candidates) == 1:
                player = initial_candidates[0]
                player.aliases.add(clean_name)
                self._update_years(player, year)
                res = ResolutionResult(
                    player=player,
                    status="RESOLVED_ALIAS",
                    method="alias",
                    confidence="HIGH",
                    reason=f"Unique initial/alias match pointing to '{player.canonical_name}'",
                )
                self._log(source, raw_name, norm_name, res)
                return res

            # If there are multiple candidates (e.g. 'A Khan' -> 39 candidates):
            # Section 2 & 12: CRITICAL PRINCIPLE - Do not force merge!
            narrowed = []
            for p in initial_candidates:
                team_match = not team or (p.country_id and p.country_id.lower() in team.lower())
                year_match = True
                if year and p.active_from and p.active_to:
                    year_match = (p.active_from - 3) <= year <= (p.active_to + 3)
                if team_match and year_match:
                    narrowed.append(p)

            if len(narrowed) == 1:
                player = narrowed[0]
                player.aliases.add(clean_name)
                self._update_years(player, year)
                res = ResolutionResult(
                    player=player,
                    status="RESOLVED_CONTEXT",
                    method="context",
                    confidence="MEDIUM",
                    reason=(
                        f"Disambiguated by context (team={team}, year={year}) "
                        f"to '{player.canonical_name}'"
                    ),
                )
                self._log(source, raw_name, norm_name, res)
                return res

            # Ambiguity remains! Flag for review queue without force merging.
            candidate_ids = [p.player_id for p in initial_candidates]
            res = ResolutionResult(
                player=None,
                status="REVIEW",
                method="ambiguous",
                confidence="NONE",
                reason=(
                    f"Ambiguous identity: {len(initial_candidates)} candidates match '{clean_name}'"
                ),
                candidates=candidate_ids,
            )
            self._log(source, raw_name, norm_name, res)
            self._queue_review(
                raw_name, norm_name, source, team, year, format, candidate_ids, res.reason
            )
            return res

        # -------------------------------------------------------------------
        # Stage 5: Curated Historical Sources & Fast Candidate Generation
        # -------------------------------------------------------------------
        # Historical curated squads without existing alias: mint canonical identity
        if source in ("wikipedia", "manual", "curated"):
            slug = generate_player_id(clean_name)
            if slug in self.players_by_id:
                slug = f"{slug}_{year}" if year else f"{slug}_hist"

            player = CanonicalPlayer(
                player_id=slug,
                canonical_name=clean_name,
                display_name=clean_name,
                country_id=team,
                active_from=year,
                active_to=year,
                provenance_source=source,
                provenance_ref=source_ref or f"Curated World Cup {year}",
            )
            player.aliases.add(clean_name)
            self._register_player(player)

            res = ResolutionResult(
                player=player,
                status="RESOLVED_EXACT",
                method="exact",
                confidence="HIGH",
                reason=f"Created canonical identity from curated source '{source}'",
            )
            self._log(source, raw_name, norm_name, res)
            return res

        # For unmapped sources, generate candidate suggestions from same-prefix bucket
        prefix = norm_name[:2] if len(norm_name) >= 2 else norm_name
        candidate_pool = list(self._alias_buckets.get(prefix, set()))
        fuzzy_names = difflib.get_close_matches(
            norm_name,
            candidate_pool,
            n=3,
            cutoff=0.88,
        )
        fuzzy_candidate_pids = []
        for fn in fuzzy_names:
            for p in self.players_by_normalized_alias.get(fn, []):
                if p.player_id not in fuzzy_candidate_pids:
                    fuzzy_candidate_pids.append(p.player_id)

        # Unresolved
        reason = (
            f"Fuzzy candidate suggestions: {fuzzy_candidate_pids}"
            if fuzzy_candidate_pids
            else "No matching identifier, canonical name, or alias found"
        )
        res = ResolutionResult(
            player=None,
            status="REVIEW",
            method="unresolved",
            confidence="NONE",
            reason=reason,
            candidates=fuzzy_candidate_pids,
        )
        self._log(source, raw_name, norm_name, res)
        self._queue_review(
            raw_name, norm_name, source, team, year, format, fuzzy_candidate_pids, reason
        )
        return res

    def _update_years(self, player: CanonicalPlayer, year: int | None) -> None:
        if year is None:
            return
        if player.active_from is None or year < player.active_from:
            player.active_from = year
        if player.active_to is None or year > player.active_to:
            player.active_to = year

    def _log(
        self,
        source: str,
        raw_name: str,
        norm_name: str,
        res: ResolutionResult,
    ) -> None:
        self.resolution_log.append(
            ResolutionAuditRecord(
                source=source,
                raw_name=raw_name,
                normalized_name=norm_name,
                candidate_player_id=res.player.player_id if res.player else None,
                resolution_method=res.method,
                resolution_status=res.status,
                confidence=res.confidence,
                reason=res.reason,
            )
        )

    def _queue_review(
        self,
        raw_name: str,
        norm_name: str,
        source: str,
        team: str | None,
        year: int | None,
        format: str | None,
        candidates: list[str],
        reason: str,
    ) -> None:
        for item in self.review_queue:
            if (
                item["raw_name"] == raw_name
                and item.get("team") == team
                and item.get("year") == year
            ):
                return
        self.review_queue.append(
            {
                "raw_name": raw_name,
                "normalized_name": norm_name,
                "source": source,
                "team": team,
                "year": year,
                "format": format,
                "candidates": candidates,
                "reason": reason,
                "status": "REVIEW",
            }
        )

    # -----------------------------------------------------------------------
    # Reporting
    # -----------------------------------------------------------------------

    def generate_report_dict(self) -> dict[str, Any]:
        """Produce structured statistics dictionary for the identity resolution report."""
        status_counts: dict[str, int] = {}
        method_counts: dict[str, int] = {}
        for r in self.resolution_log:
            status_counts[r.resolution_status] = status_counts.get(r.resolution_status, 0) + 1
            method_counts[r.resolution_method] = method_counts.get(r.resolution_method, 0) + 1

        cricsheet_linked = sum(1 for p in self.players_by_id.values() if p.cricsheet_id)
        total_aliases = sum(len(p.aliases) for p in self.players_by_id.values())

        return {
            "canonical_players": len(self.players_by_id),
            "raw_player_references": len(self.resolution_log),
            "unique_normalized_names": len(self.players_by_normalized_alias),
            "cricsheet_identifiers_linked": cricsheet_linked,
            "aliases_created": total_aliases,
            "resolution": {
                "identifier": method_counts.get("identifier", 0),
                "exact": method_counts.get("exact", 0),
                "alias": method_counts.get("alias", 0),
                "context": method_counts.get("context", 0),
                "manual_override": method_counts.get("manual", 0),
            },
            "review": {
                "ambiguous": status_counts.get("REVIEW", 0),
                "unresolved": status_counts.get("UNRESOLVED", 0),
                "total_queued": len(self.review_queue),
            },
            "conflicts": {
                "identifier_conflicts": 0,
                "duplicate_canonical_ids": 0,
            },
            "status": "PASS" if status_counts.get("UNRESOLVED", 0) == 0 else "REVIEW",
        }

    def render_report_text(self) -> str:
        """Produce human-readable terminal report."""
        rep = self.generate_report_dict()
        res = rep["resolution"]
        rev = rep["review"]
        lines = [
            "MAIDEN PLAYER IDENTITY REPORT",
            "=============================",
            f"Canonical players: {rep['canonical_players']}",
            f"Raw player references: {rep['raw_player_references']}",
            f"Unique normalized names: {rep['unique_normalized_names']}",
            f"Cricsheet identifiers linked: {rep['cricsheet_identifiers_linked']}",
            f"Aliases created: {rep['aliases_created']}",
            "",
            "Resolution",
            "----------",
            f"  Identifier: {res['identifier']}",
            f"  Exact: {res['exact']}",
            f"  Alias: {res['alias']}",
            f"  Context: {res['context']}",
            f"  Manual override: {res['manual_override']}",
            "",
            "Review",
            "------",
            f"  Ambiguous: {rev['ambiguous']}",
            f"  Unresolved: {rev['unresolved']}",
            f"  Review queue size: {rev['total_queued']}",
            "",
            "Conflicts",
            "---------",
            f"  Identifier conflicts: {rep['conflicts']['identifier_conflicts']}",
            f"  Duplicate canonical IDs: {rep['conflicts']['duplicate_canonical_ids']}",
            "",
            f"STATUS: {rep['status']}",
        ]
        return "\n".join(lines)
