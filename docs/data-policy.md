# Data Policy

Maiden's data philosophy, sourcing rules and licensing obligations.

> **Phase 1 status:** Cricsheet male ODI and T20 ball-by-ball data is ingested by
> the data pipeline into `data/processed/maiden.sqlite`. Raw archives and the
> generated database are git-ignored (not redistributed via this repository).

## Cricsheet license (the data we use)

Cricsheet data is released under the **Open Data Commons Attribution License
(ODC-By) v1.0**. Obligations we follow:

- **Attribution:** any public use of the dataset — or works produced from it —
  must attribute Cricsheet (https://cricsheet.org/) as specified by ODC-By.
- **Keep notices intact:** license and attribution notices on the original
  dataset must be preserved for any use or redistribution of the dataset or
  derived works.
- We do **not** redistribute the raw Cricsheet archives through this repository
  (they are git-ignored). Should Maiden ever distribute a derived dataset, the
  ODC-By attribution/license notice must accompany it.

This is a summary of the documented source terms, not legal advice or a legal
conclusion beyond those terms.

## Sources (intended)

- **Ball-by-ball data:** [Cricsheet](https://cricsheet.org/) is the primary
  source of ball-by-ball match data (ingested in Phase 1; male ODI + T20).
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
