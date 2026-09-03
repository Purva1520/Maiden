# Roadmap

Maiden is built in phases. Only **Phase 0** is implemented. Everything below it
is planned scope, not existing functionality.

| Phase | Name                              | Status         |
| ----- | --------------------------------- | -------------- |
| 0     | Project Foundation                | ✅ Done        |
| 1     | Cricsheet Data Pipeline           | ✅ **Current** |
| 2     | Historical World Cup Database     | Planned        |
| 3     | Player Identity & Normalization   | Planned        |
| 4     | Tournament Statistics & Era Norm. | Planned        |
| 5     | Maiden Rating System              | Planned        |
| 6     | Cricket Simulation Engine         | Planned        |
| 7     | Simulation Calibration            | Planned        |
| 8     | XI Builder & Game Rules           | Planned        |
| 9     | Campaign Engine                   | Planned        |
| 10    | Frontend                          | Planned        |
| 11    | Integration & Game Feel           | Planned        |
| 12    | Testing, Balance & Production     | Planned        |
| 13    | Optional Features                 | Planned        |

## Phase 0 — Project Foundation (done)

Establishes the monorepo, toolchain, package boundaries, testing, linting,
formatting, environment configuration, documentation and CI scaffolding.

## Phase 1 — Cricsheet Data Pipeline (current)

A reproducible Python pipeline that turns raw Cricsheet ODI/T20 male JSON
archives into a normalized, validated SQLite database
(`data/processed/maiden.sqlite`): ingest → parse → clean → validate → export,
with human- and machine-readable ingestion reports. **No ratings, era
normalization, World Cup squad curation, simulation, campaign or game UI is
implemented** — those remain in later phases. See
[`data-schema.md`](data-schema.md) and [`cricsheet-mapping.md`](cricsheet-mapping.md).

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
