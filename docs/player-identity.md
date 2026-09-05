# Player Identity & Entity Resolution (Phase 3)

Maiden's canonical identity layer. Every player reference across the dataset
(Cricsheet matches, deliveries, tournament squads) resolves to exactly one
canonical `player_id` — or is explicitly flagged for review. Different spellings,
initials, and source identifiers collapse to one identity **without incorrectly
merging different people**.

> **Prime directive:** a false merge is worse than an unresolved identity. When
> evidence is insufficient, the resolver returns `REVIEW`, never a guess.

## Canonical player ID

Deterministic, stable, URL/DB-safe slug derived from the name, e.g.
`sachin_tendulkar`, `ms_dhoni`, `s_sreesanth`. Names are **attributes/aliases** —
the `player_id` is the identity key and stays stable even if the display name
changes. Slug collisions between two distinct Cricsheet register people are
disambiguated with an id suffix rather than merged.

## Tables

See [`data-schema.md`](data-schema.md). Summary:

- `players` — canonical identities (`player_id`, `canonical_name`, `display_name`,
  `cricsheet_id`, `country_id`, `active_from/to`).
- `player_aliases` — known name variants (`normalized_alias`, `source`).
- `player_identifiers` — external ids (`(identifier_type, identifier_value)`
  unique); primarily Cricsheet register ids.
- `player_resolution_log` — audit trail of every resolution (raw name, method,
  status, confidence, reason).
- `team_aliases`, `tournament_aliases` — normalization for teams and tournaments.

## Source of truth

The **Cricsheet Player Register** (`people.csv` / `names.csv`, fetched to
`data/raw/register/`) seeds the canonical catalog and supplies stable identifiers
and name variations. Historical players absent from the Register get a
Maiden-generated identity backed by source evidence. The Register is a strong
signal, not a substitute for validation.

## Normalization vs entity resolution (kept separate)

- **Normalization** (`cleaning/names.py`): text → comparison form.
  `"S. Tendulkar"` → `"s tendulkar"`. Diacritics stripped for matching only; the
  canonical display spelling is preserved exactly (`José María` stays `José María`).
- **Entity resolution** (`normalization/identity.py`): comparison form + context
  → a canonical player. Normalization alone never establishes identity.

## Resolution hierarchy

Applied in order (first match wins); each stage records method + confidence:

1. **Manual override** (`RESOLVED_MANUAL`) — exact or contextual entry in the
   override file.
2. **Identifier** (`RESOLVED_IDENTIFIER`) — Cricsheet register id match. HIGH.
3. **Exact name** (`RESOLVED_EXACT`) — unique normalized canonical/display name
   (single-initial + surname is _not_ treated as exact). HIGH.
4. **Alias** (`RESOLVED_ALIAS`) — unique alias / initial-surname match. HIGH.
5. **Context** (`RESOLVED_CONTEXT`) — disambiguated by team + year among
   candidates. MEDIUM.
6. **Review** (`REVIEW`) — multiple viable candidates remain; queued, never
   merged.

Fuzzy/candidate matching only _generates_ candidates; a high similarity score is
never sufficient on its own. Resolution is deterministic — equal evidence ⇒
`REVIEW`, not a random pick.

### Worked examples

```
"S. Tendulkar" → norm "s tendulkar" → RESOLVED_ALIAS/IDENTIFIER → sachin_tendulkar
"A Khan"       → norm "a khan"      → 2+ candidates             → REVIEW (not merged)
"Sreesanth" + "S Sreesanth" (same team) → both → s_sreesanth (one identity)
```

## Manual overrides

`data/game/identity/player_alias_overrides.json` — version-controlled, human-
editable. Two forms: exact `overrides` (name → `player_id`) and
`contextual_overrides` (name + team/year → `player_id`). Manual identity
decisions live here, never buried in code.

## Review queue

Ambiguous references are written to `data/processed/player_identity_review.json`
with raw name, source, team, year, and candidate ids. Resolve by adding an entry
to the override file and re-running — do not edit generated reports as truth.

## Migration & integrity

`resolve_players.py` builds a **new** database (never mutating the known-good one
in place), remaps every player reference — `deliveries.batter_id/bowler_id/
non_striker_id`, `match_players.player_id`, `tournament_squads.player_id`,
`matches.player_of_match_id`, wickets/fielders — from Phase 1 integer ids to
canonical slugs, runs `PRAGMA foreign_key_check`, backs up, and swaps atomically.

Two safety mechanisms:

- **Squad merges** — if two curated squad rows resolve to the same canonical
  player within a team, they are merged (flags OR-ed, WK role preferred) and
  recorded in `data/processed/squad_merges.json` rather than crashing.
- **Unresolved fallback** — any unresolved reference maps to an
  `unresolved_<id>` placeholder player so foreign keys always hold; it is tracked
  in the review queue.

`validate_identity.py` fails if any player still has a numeric (Phase 1) id — i.e.
if the migration has not been applied — so a passing run means Phase 3 is truly in
effect.

## Other normalization

- **Roles** (`cleaning/roles.py`) → `BAT | BOWL | ALLROUNDER | WK`; unknown roles
  raise. Bowling style is not encoded; roles are not inferred from scorecards.
- **Teams** (`cleaning/teams.py`) → canonical name + `team_aliases`; historically
  distinct teams are never merged on name similarity.
- **Tournaments** (`cleaning/tournaments.py`) → canonical `*_WC_<year>` using
  name + year + format (never name alone).
- **Dates** (`cleaning/dates.py`) → `YYYY-MM-DD`, explicit formats only (no
  locale-dependent day/month swaps); multi-date matches preserved.

## Commands

```bash
python scripts/resolve_players.py --dry-run   # simulate; write no changes
python scripts/resolve_players.py             # migrate DB to canonical ids (atomic)
python scripts/validate_identity.py           # FK + identity integrity checks
python scripts/normalize_data.py --demo       # demo the normalization utilities
```

Reports: `player_identity_report.{json,txt}`, `player_identity_review.json`,
`squad_merges.json` (all under `data/processed/`).

## Known limitations

- **Ambiguous reviews:** a small number of references (currently ~10) remain in
  `REVIEW` by design — resolve via the override file when adjudicated.
- **Participation** is not yet cross-validated against Cricsheet appearances (see
  [`world-cup-data.md`](world-cup-data.md)).
