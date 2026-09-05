# Roadmap

Maiden is built in phases. Only **Phase 0** is implemented. Everything below it
is planned scope, not existing functionality.

| Phase | Name                              | Status  |
| ----- | --------------------------------- | ------- |
| 0     | Project Foundation                | ✅ Done |
| 1     | Cricsheet Data Pipeline           | ✅ Done |
| 2     | Historical World Cup Database     | ✅ Done |
| 3     | Player Identity & Normalization   | ✅ Done |
| 4     | Tournament Statistics & Era Norm. | ✅ Done |
| 5     | Maiden Rating System              | ✅ Done |
| 6     | Cricket Simulation Engine         | ✅ Done |
| 7     | Simulation Calibration            | ⏭️ Next |
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

## Phase 4 — Tournament Statistics & Era Normalization (done)

Reproducible statistics pipeline producing `player_tournament_stats.parquet`
(one row per player × tournament × team) with raw batting/bowling figures,
null-aware derived metrics, participation/coverage/sample metadata, and
tournament- and era-relative normalized features (percentile + z, direction-
corrected). Also persists `tournament_baselines.parquet` and
`era_baselines.parquet`. Raw and normalized values are kept side by side and
missing data is never imputed. See
[`statistical-methodology.md`](statistical-methodology.md) and
[`tournament-statistics.md`](tournament-statistics.md). No Maiden ratings yet.

## Phase 5 — Maiden Rating System (done)

Versioned, reproducible v1 rating model that turns the Phase 4 normalized
features into 0–99 `batRating` / `bowlRating` per player × tournament × format.
Interpretable weighted-percentile latent (tournament + era blend) with sample-
size shrinkage, mapped to 0–99 by cross-era, format-specific normal-quantile
calibration. No per-player ratings, fame/team/career bonuses, or simulation
feedback. Outputs `ratings_v1.json`, `player_ratings.parquet`, and a
`player_ratings` SQLite table. See
[`rating-methodology.md`](rating-methodology.md).

## Phase 6 — Cricket Simulation Engine (done)

Standalone, seeded, offline limited-overs simulator (`packages/simulator`):
delivery → innings → match. A probabilistic delivery model driven by Phase 5
`batRating`/`bowlRating` plus phase, format and chase-state modifiers; strike and
bowler rotation; full batting/bowling scorecards, fall of wickets and a structured
event stream; ODI and T20. `pnpm simulate` plays a complete match from the CLI.
See [`simulation-methodology.md`](simulation-methodology.md) and
[`simulation-config.md`](simulation-config.md).

## Phase 7 — Simulation Calibration (done)

The Phase 6 delivery model is fitted to the project's own Cricsheet history
(broad men's ODI + T20 population, not WC-only). Iterative proportional fitting
tunes each format's base outcome distribution so aggregate mean score / run rate /
wicket / four / six rates match history; ODI and T20 are calibrated separately.
Aggregate relative error fell from 1.967 → 0.047 (ODI) and 1.319 → 0.044 (T20)
over 12,000 innings/format. The engine **loads** the calibrated numbers from
`data/game/simulation/simulation_config_v1.json` (not hardcoded); rating
differentiation and Phase 6 determinism are preserved. Reproduce with
`pnpm --filter @maiden/simulator calibrate` and validate with
`python scripts/validate_simulation_config.py`. See
[`simulation-methodology.md`](simulation-methodology.md#calibration-phase-7).

## Phase 8 — XI Builder, Roll & Game Rules (done)

Seeded historical roll, combined player pool, draft with structured validation
(11 players · ≥1 keeper · ≥5 bowling options · top-order cover · one card per
canonical player), captain, batting order, and a simulation-ready `MaidenTeam`
handed to the Phase 6/7 engine. Lives in `packages/game-data/src/team`. See
[`team-building.md`](team-building.md).

## Phase 9 — Campaign Engine (done)

A finalized XI runs a full World Cup campaign: deterministic historical
opponents, a genuinely-simulated round-robin group stage, standings and
qualification, semifinals, final, and the Champion / Invincible / Golden
Invincible achievements. Lives in `packages/game-data/src/campaign`. See
[`campaign.md`](campaign.md).

## Phase 10 — Playable Frontend (done)

The browser game: a React app (`apps/web`) over a stateless Fastify API
(`apps/api`) exposing the Phase 6–9 engine. Full loop — roll → draft → campaign →
ball-by-ball match → result — with localStorage persistence. React is
presentation only; all rules stay in the engine. See
[`frontend.md`](frontend.md).

## Phase 11 — Integration & Game Feel (done)

A presentation layer (`apps/web/src/presentation`) that paces the match from the
real event stream: a single-timer controller (`useMatchPresentation`) with
event-aware timing, delivery reveals (over.ball · bowler → batter · outcome),
distinct wicket / boundary / milestone feedback, over and innings transitions, a
match intro with toss, historical badges on every card, and a presentation-only
Legend tier. Outcomes are never changed. See
[`frontend.md`](frontend.md#presentation-layer-phase-11--game-feel).

## Phase 12 — Balance, Testing & Production (done)

The release gate. Edge-case, property, extreme-rating, corrupted-save and
route-guard tests; a randomness audit (all gameplay seeded); a dependency audit
(0 known advisories); and two orchestrated commands — `pnpm validate:production`
(fast ordered gate) and `pnpm validate:deep` (12k-innings calibration regression +
100-campaign batch). Release docs: [`testing.md`](testing.md),
[`balance.md`](balance.md), [`known-limitations.md`](known-limitations.md),
[`debugging.md`](debugging.md), [`release-checklist.md`](release-checklist.md).
Maiden is deterministic, calibrated, tested, and reproducible.

## Beyond v1 — (future)

Candidate work: audio, richer campaign-map animation, a finalized balance pass,
Super Over / extras / additional dismissal types, and save migration.

## Game vision (future)

Maiden lets a player choose ODI or T20, roll for historical World Cup
editions/teams, build a Playing XI from players who actually featured in those
tournaments (using Maiden's era-normalized ratings), simulate complete matches
ball-by-ball, play a campaign, and try to become **Invincible** (win every
campaign match) — or **Golden Invincible** (win every match by a "thrashing"
margin). Phases 1–10 make this playable end-to-end; later phases refine it.
