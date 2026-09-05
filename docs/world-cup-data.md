# World Cup Data (Phase 2)

Maiden's canonical historical World Cup universe: tournament editions,
participating teams, and tournament squads. Built from curated source files into
`data/processed/maiden.sqlite` and queried via the Phase 2 API.

## Supported editions (22 total)

**ODI (13):** 1975, 1979, 1983, 1987, 1992, 1996, 1999, 2003, 2007, 2011, 2015,
2019, 2023.

**T20 (9):** 2007, 2009, 2010, 2012, 2014, 2016, 2021, 2022, 2024.

Tournament IDs are stable, deterministic and human-readable: `ODI_WC_<year>` /
`T20_WC_<year>` (e.g. `ODI_WC_2011`). No other editions are in scope for Phase 2.

## Tables

See [`data-schema.md`](data-schema.md) for columns. In short:

- `tournaments` — one row per edition.
- `tournament_teams` — which teams played each edition (references `teams`).
- `tournament_squads` — squad members per (tournament, team), referencing
  canonical `players`.

## Definitions (do not conflate)

- **Squad** — a player selected to the official tournament squad.
- **Participated** — the player actually appeared in ≥1 official tournament
  match. `participated = false` is valid and must be preserved (a selected player
  who never played is **not** removed).
- **Source** — provenance category, exactly one of `cricsheet` | `wikipedia` |
  `manual` (lowercase).
- **Maiden player** — a canonical historical identity (see
  [`player-identity.md`](player-identity.md)); Phase 2 references players by
  `player_id`, never by raw name.

## Roles

Every squad member has one canonical role: `BAT`, `BOWL`, `ALLROUNDER`, `WK`.
Source terminology ("Batsman", "Fast bowler", "Leg-spinner", "Wicketkeeper-batsman"
…) is normalized to these four (see `cleaning/roles.py`). Fine-grained bowling
style is **not** encoded in the role.

## Wicketkeeper policy

`wicketkeeper` is a separate boolean from `role`. `role = WK` generally implies
`wicketkeeper = true`, but the two are stored independently (gameplay role vs
historical capability). Validation **flags** contradictions rather than silently
rewriting them.

## Participation policy

For modern tournaments with adequate Cricsheet coverage, participation should be
cross-checked against actual match appearances; for older editions (1975–1999 and
sparsely-covered events) it relies on historical/manual curation. Missing
Cricsheet data is **never** treated as proof of non-participation.

> **Current status / known limitation.** Participation is presently taken from the
> curated source and is **not yet cross-validated against Cricsheet appearances**;
> the vast majority of records are `participated = true`. Wiring the Cricsheet
> cross-check (match a tournament to its Cricsheet event, aggregate appearances by
> canonical `player_id`, and flag discrepancies for review) is planned. This does
> not block later phases but should be completed for full historical accuracy.

## Source policy

Squad lists come from official tournament records and reputable historical
references (primarily Wikipedia tournament-squad pages), with manual curation for
older editions. **Not used:** blogs, unsourced fan sites, scraped game databases,
video-game ratings, or Kaggle as an authoritative source. Every squad record
carries `source` and (where available) `source_reference` for auditability.

## Curated source files

Human-reviewable, Git-diffable, deterministically sorted:

```
data/game/world_cups/
├── tournaments.json      # the 22 editions
├── teams.json            # tournament ↔ team mappings
└── curated_squads.json   # squad records (the source of truth)
```

`maiden.sqlite` is a **generated artifact** — edit the JSON, then rebuild. Never
hand-edit the database.

## Known coverage limitations

Not every edition has a complete squad for every participating team yet. Four
editions currently hold only a partial set of teams and require further historical
curation:

| Edition  | Teams that played | Teams with squads |
| -------- | ----------------- | ----------------- |
| ODI 2003 | 14                | 2                 |
| ODI 2023 | 10                | 2                 |
| T20 2007 | 12                | 2                 |
| T20 2024 | 20                | 2                 |

`validate_world_cups.py` reports these under **Coverage Gaps**. Per the project's
data-quality principle, missing squads are reported, **not fabricated**.

## Commands

```bash
python scripts/generate_world_cup_data.py   # (re)generate curated JSON (if used)
python scripts/build_world_cup_database.py   # load Phase 2 tables into maiden.sqlite
python scripts/validate_world_cups.py        # validate + write world_cup_report.*
```

Reports: `data/processed/world_cup_report.json` and `world_cup_report.txt`.

## Query API

`data-pipeline/normalization/query.py`:

```python
from normalization.query import getSquad, get_tournament, get_tournament_teams, list_tournaments

getSquad("ODI", 2011, "India")   # -> [{player, player_id, role, wicketkeeper, participated, squad_order}, ...]
get_tournament("T20", 2007)      # -> tournament metadata
get_tournament_teams("ODI", 2011)
list_tournaments()               # -> all 22
```

Inputs are normalized (case-insensitive format/team). Invalid format, year, or
team raises `ValueError` with a helpful message.
