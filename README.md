# MAIDEN

_Cricket through the ages._

Maiden is a historical cricket strategy/simulation game. Roll for historical
World Cup editions, draft a Playing XI from the players who actually featured in
those tournaments, and simulate complete matches ball-by-ball — then try to go
**Invincible** across a campaign.

> **Current phase: Phase 1 — Cricsheet Data Pipeline.**
> A reproducible Python pipeline turns raw Cricsheet archives into a normalized
> SQLite database:
>
> ```text
> Raw Cricsheet archives → Python ingestion pipeline → SQLite normalized database
> (odis_male_json.zip,      (ingest → parse → clean →   (data/processed/maiden.sqlite)
>  t20s_male_json.zip)       validate → export)
> ```
>
> Gameplay, simulation, ratings, World Cup squad curation and the game UI are
> **not implemented yet**. See [`docs/roadmap.md`](docs/roadmap.md).

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

## Roadmap

Phase 0 established the project foundation; Phase 1 adds the Cricsheet data
pipeline. The full phase plan (historical database, rating system, simulation
engine, campaign, frontend) is in [`docs/roadmap.md`](docs/roadmap.md).

## Data attribution

Match data is sourced from [Cricsheet](https://cricsheet.org/), licensed under the
**Open Data Commons Attribution License (ODC-By) v1.0**. Attribution and license
notices must be preserved for any redistribution of derived datasets. See
[`docs/data-policy.md`](docs/data-policy.md).

## License

Project code: TBD.
