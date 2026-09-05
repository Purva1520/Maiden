# Roadmap

Maiden is built in phases. Only **Phase 0** is implemented. Everything below it
is planned scope, not existing functionality.

| Phase | Name                              | Status  |
| ----- | --------------------------------- | ------- |
| 0     | Project Foundation                | ✅ Done |
| 1     | Cricsheet Data Pipeline           | ✅ Done |
| 2     | Historical World Cup Database     | ✅ Done |
| 3     | Player Identity & Normalization   | ✅ Done |
| 4     | Tournament Statistics & Era Norm. | ⏭️ Next |
| 5     | Maiden Rating System              | Planned |
| 6     | Cricket Simulation Engine         | Planned |
| 7     | Simulation Calibration            | Planned |
| 8     | XI Builder & Game Rules           | Planned |
| 9     | Campaign Engine                   | Planned |
| 10    | Frontend                          | Planned |
| 11    | Integration & Game Feel           | Planned |
| 12    | Testing, Balance & Production     | Planned |
| 13    | Optional Features                 | Planned |

## Phase 0 — Project Foundation (done)

Establishes the monorepo, toolchain, package boundaries, testing, linting,
formatting, environment configuration, documentation and CI scaffolding.

## Phase 1 — Cricsheet Data Pipeline (done)

A reproducible Python pipeline that turns raw Cricsheet ODI/T20 male JSON
archives into a normalized, validated SQLite database
(`data/processed/maiden.sqlite`): ingest → parse → clean → validate → export,
with human- and machine-readable ingestion reports. See
[`data-schema.md`](data-schema.md) and [`cricsheet-mapping.md`](cricsheet-mapping.md).

## Phase 2 — Historical World Cup Database (done)

Curated World Cup tournament universe covering all 22 historical tournaments
(13 ODI editions from 1975–2023, 9 Men's T20 editions from 2007–2024), 275
participating tournament-team mappings, and complete 15-player tournament squads
(3,341 squad records) with player roles, wicketkeeper designations, and participation
flags. Loaded into `tournaments`, `tournament_teams`, and `tournament_squads` with
full foreign key integrity, query API (`getSquad`, `get_tournament`, etc.),
and automated validation reporting (`data/processed/world_cup_report.json`).

## Phase 3 — Player Identity & Normalization (done)

Canonical identity layer resolving every player reference (matches, deliveries,
tournament squads) to one stable `player_id` — anchored on the Cricsheet Register,
with aliases, external identifiers, an audit log, manual overrides, and a review
queue. Conservative resolution hierarchy (override → identifier → exact → alias →
context → REVIEW) that never force-merges ambiguous names. Also normalizes teams,
tournaments, dates, and roles. See [`player-identity.md`](player-identity.md).

## Phase 4 — Tournament Statistics & Era Normalization (next)

Not started. Will compute per-tournament batting/bowling statistics from the
canonical match data and normalize them across eras. Builds on the Phase 3
canonical identities.

## Game vision (future)

The eventual game will let a player:

1. Choose ODI or T20.
2. Roll for historical World Cup editions/teams.
3. Build a Playing XI from players who actually featured in those tournaments.
4. Use Maiden's own tournament/era-normalized batting & bowling ratings.
5. Simulate complete matches ball-by-ball.
6. Play a campaign.
7. Become **Invincible** by winning every campaign match.
8. Achieve **Golden Invincible** by winning every match by a "thrashing" margin.

These are documented here for direction only; none are built yet.
