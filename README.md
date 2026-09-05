# MAIDEN

_Cricket through the ages._

Maiden is a historical cricket strategy/simulation game. Roll for historical
World Cup editions, draft a Playing XI from the players who actually featured in
those tournaments, and simulate complete matches ball-by-ball — then try to go
**Invincible** across a campaign.

> **Current phase: Phase 2 — Historical World Cup Database (Complete).**
> Phase 1 (Cricsheet Data Pipeline) and Phase 2 (Curated World Cup Universe) are
> fully implemented. All 22 historical ODI and T20 World Cups, 275 tournament-team
> mappings, and 3,341 curated squad records are normalized and validated in
> `data/processed/maiden.sqlite`.
>
> Player ratings, simulation engine, campaign mode, and frontend follow in
> subsequent phases. See [`docs/roadmap.md`](docs/roadmap.md).

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

## Roadmap

Phase 0 established the project foundation, Phase 1 delivered the Cricsheet match
pipeline, and Phase 2 delivered the historical World Cup database. The full phase
plan (identity resolution, ratings, simulation engine, campaign, frontend) is in
[`docs/roadmap.md`](docs/roadmap.md).

## Data attribution

Match data is sourced from [Cricsheet](https://cricsheet.org/), licensed under the
**Open Data Commons Attribution License (ODC-By) v1.0**. Attribution and license
notices must be preserved for any redistribution of derived datasets. See
[`docs/data-policy.md`](docs/data-policy.md).

## License

Project code: TBD.
