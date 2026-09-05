# MAIDEN

_Cricket through the ages._

Maiden is a historical cricket strategy/simulation game. Roll for historical
World Cup editions, draft a Playing XI from the players who actually featured in
those tournaments, and simulate complete matches ball-by-ball — then try to go
**Invincible** across a campaign.

> **Current phase: Phase 4 — Tournament Statistics & Era Normalization (Complete).**
> Phases 1–3 build a canonical `maiden.sqlite` (matches, World Cup universe,
> player identities). Phase 4 adds a reproducible statistics pipeline producing
> `data/processed/player_tournament_stats.parquet` — raw + null-aware derived
> batting/bowling figures with tournament- and era-relative normalized features,
> plus persisted baselines. **Phase 5 (Maiden Rating System) is next.**
>
> Ratings, simulation engine, campaign mode, and frontend follow in subsequent
> phases. See [`docs/roadmap.md`](docs/roadmap.md),
> [`docs/statistical-methodology.md`](docs/statistical-methodology.md), and
> [`docs/tournament-statistics.md`](docs/tournament-statistics.md).

## Tech stack

- **Monorepo:** pnpm workspaces
- **Language:** TypeScript (strict), Python
- **Web:** React 19 + Vite
- **API:** Fastify
- **Testing:** Vitest (TS), pytest (Python)
- **Quality:** ESLint + Prettier (TS), Ruff (Python)

## Repository structure

```text
apps/web           React + Vite web app (Phase 0 smoke-test page)
apps/api           Fastify API (health endpoint)
packages/shared    Cross-app TypeScript types & utils
packages/simulator Cricket simulation engine (placeholder)
packages/game-data Curated game-data access layer (placeholder)
packages/ui        Reusable UI components (placeholder)
data/              raw archives / processed maiden.sqlite / game datasets
data-pipeline/     Python pipeline: ingest → parsers → cleaning → validation → export
notebooks/         Research notebooks
tests/             Cross-cutting & Python tests (incl. pipeline + fixtures)
docs/              Architecture, development, data policy, schema, mapping, roadmap
scripts/           Setup, download & build scripts
```

See [`docs/architecture.md`](docs/architecture.md) for details.

## Setup

Requires Node 26 (see [`.nvmrc`](.nvmrc)), pnpm ≥ 11, and Python ≥ 3.12.

```bash
pnpm install                 # JS/TS dependencies
cp .env.example .env         # local environment
./scripts/setup-python.sh    # Python venv + pipeline (pip install -e .[dev])
```

Full instructions: [`docs/development.md`](docs/development.md).

## Commands

```bash
pnpm dev            # start the web app (http://localhost:5173)
pnpm dev:api        # start the API   (http://localhost:3000)
pnpm build          # build web + api
pnpm typecheck      # type-check all packages
pnpm test           # run Vitest suites
pnpm lint           # ESLint
pnpm format         # Prettier (write)
pnpm python:test    # run pytest
```

### Data pipeline (Phase 1)

```bash
python scripts/download_cricsheet.py     # download ODI + T20 archives (explicit)
python scripts/build_database.py         # build data/processed/maiden.sqlite
python scripts/build_database.py --format odi   # ODI only (or t20 | all)
python scripts/validate_database.py      # validate + sample queries
```

The pipeline produces `data/processed/maiden.sqlite` plus `ingestion_report.json`
/ `ingestion_report.txt`. See [`docs/data-schema.md`](docs/data-schema.md) and
[`docs/cricsheet-mapping.md`](docs/cricsheet-mapping.md).

### World Cup database (Phase 2)

```bash
python scripts/generate_world_cup_data.py   # generate curated JSON datasets
python scripts/build_world_cup_database.py  # load tournaments, teams, squads into DB
python scripts/validate_world_cups.py       # validate DB integrity & report
```

The World Cup pipeline updates `data/processed/maiden.sqlite` with the 22 tournaments,
275 teams, and 3,341 squad records, and produces `data/processed/world_cup_report.json`
/ `world_cup_report.txt`.

### Player identity (Phase 3)

```bash
python scripts/resolve_players.py --dry-run  # simulate identity resolution
python scripts/resolve_players.py            # migrate DB to canonical player ids
python scripts/validate_identity.py          # FK + identity integrity checks
```

See [`docs/player-identity.md`](docs/player-identity.md).

### Tournament statistics (Phase 4)

```bash
python scripts/build_tournament_stats.py     # -> player_tournament_stats.parquet + baselines
python scripts/validate_tournament_stats.py  # validate outputs & reconciliation
```

See [`docs/statistical-methodology.md`](docs/statistical-methodology.md).

### Full build order

The database is built in sequence — **run these in order** (each builds on the
previous):

```bash
python scripts/download_cricsheet.py         # 1. fetch Cricsheet archives (once)
python scripts/build_database.py             # 2. Phase 1: matches/deliveries
python scripts/build_world_cup_database.py   # 3. Phase 2: World Cup universe
python scripts/resolve_players.py            # 4. Phase 3: canonical identities
python scripts/build_tournament_stats.py     # 5. Phase 4: statistics parquet
```

Then `validate_world_cups.py`, `validate_identity.py`, and
`validate_tournament_stats.py` to verify.

## Roadmap

Phase 0 established the project foundation, Phase 1 delivered the Cricsheet match
pipeline, Phase 2 delivered the historical World Cup database, and Phase 3 added
the canonical player-identity layer. Phase 4 (Tournament Statistics & Era
Normalization) is next. Full plan in [`docs/roadmap.md`](docs/roadmap.md).

## Data attribution

Match data is sourced from [Cricsheet](https://cricsheet.org/), licensed under the
**Open Data Commons Attribution License (ODC-By) v1.0**. Attribution and license
notices must be preserved for any redistribution of derived datasets. See
[`docs/data-policy.md`](docs/data-policy.md).

## License

Project code: TBD.
