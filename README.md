# MAIDEN

_Cricket through the ages._

Maiden is a historical cricket strategy/simulation game. Roll for historical
World Cup editions, draft a Playing XI from the players who actually featured in
those tournaments, and simulate complete matches ball-by-ball — then try to go
**Invincible** across a campaign.

> **Current phase: Phase 0 — Project Foundation.**
> This repository is a clean technical **skeleton**. Gameplay, simulation,
> ratings and historical data systems are **not implemented yet**. See
> [`docs/roadmap.md`](docs/roadmap.md).

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
data/              raw / processed / game datasets (empty in Phase 0)
data-pipeline/     Python pipeline: ingest → … → export (skeleton)
notebooks/         Research notebooks
tests/             Cross-cutting & Python tests
docs/              Architecture, development, data policy, roadmap
scripts/           Setup & maintenance scripts
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

## Roadmap

Phase 0 establishes the project foundation. The full phase plan (Cricsheet
pipeline, historical database, rating system, simulation engine, campaign,
frontend) is in [`docs/roadmap.md`](docs/roadmap.md).

## License

TBD.
