# Data Policy

Maiden's data philosophy, sourcing rules and licensing obligations.

> **Phase 0 status:** _no data has been ingested._ This document sets the rules
> that later phases must follow.

## Sources (intended)

- **Ball-by-ball data:** [Cricsheet](https://cricsheet.org/) is the intended
  primary source of ball-by-ball match data, beginning in Phase 1. It is **not**
  downloaded in Phase 0.
- **Historical player & tournament information:** public historical/statistical
  sources (e.g. official records, reputable statistical databases).
- **Historical squad information:** some tournament squad lists may require
  **manual curation** where structured sources are unavailable.

## Ratings

- Maiden ratings (batting, bowling, era-normalized) are an **original,
  project-created rating system** (designed in Phase 5).
- **No video-game ratings are copied** from any commercial product. Maiden's
  ratings are derived only from historical statistical data via Maiden's own
  methodology.

## Attribution & licensing

- Preserve **source attribution** for every dataset used.
- Respect each dataset's **license** and terms of use (e.g. Cricsheet's license).
  Record the license and provenance alongside ingested data.
- Do not redistribute source data in violation of its license. Prefer committing
  only Maiden-derived, game-ready artifacts where licensing permits.

## Storage & Git rules

| Location          | Contents                                 | Committed?                                                                                                            |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `data/raw/`       | Original sourced datasets                | No — git-ignored (large/licensed).                                                                                    |
| `data/processed/` | Generated analytical/normalized datasets | No — regenerable artifacts.                                                                                           |
| `data/game/`      | Curated, game-ready datasets             | Small curated files may be committed intentionally (add explicit `.gitignore` un-ignore rules and record provenance). |

## Research vs Runtime

Data acquisition and analysis happen in the **Python pipeline** (`data-pipeline/`)
and **notebooks/** — offline, research-time. The browser game runtime only ever
consumes the curated `data/game/` outputs via `@maiden/game-data`. Raw sources
never reach the client (Principle 2 & 3 in [architecture.md](architecture.md)).
