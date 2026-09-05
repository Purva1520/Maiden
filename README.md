# MAIDEN

_Cricket through the ages._

Maiden is a historical cricket strategy/simulation game. Roll for historical
World Cup editions, draft a Playing XI from the players who actually featured in
those tournaments, and simulate complete matches ball-by-ball — then try to go
**Invincible** across a campaign.

> **Current phase: Phase 12 — Balance, Testing & Production (Complete).**
> Phases 1–5 build a canonical `maiden.sqlite`, the statistics parquet, and 0–99
> player ratings. Phase 6 adds a seeded offline simulator (`packages/simulator`),
> Phase 7 calibrates it against real ODI/T20 history, Phase 8 adds the roll + XI
> builder and Phase 9 the World Cup campaign engine (`packages/game-data`).
> **Phase 10 is the actual game**: a React frontend (`apps/web`) over a stateless
> Fastify API (`apps/api`) that exposes the Phase 6–9 engine. Play the whole loop
> in the browser — roll → draft → campaign → ball-by-ball match → Champion /
> Invincible / Golden Invincible. **Phase 11** adds the game-feel layer: an
> event-paced match reveal (`14.5 · Warne to Tendulkar · FOUR!`), wicket / boundary
> / milestone feedback, over and innings transitions, and historical player
> identity. **Phase 12** is the release gate — edge-case/property/determinism
> tests, a clean dependency audit, and `pnpm validate:production` /
> `validate:deep`. Run the game with **`pnpm dev`** (starts web + API).
>
> See [Playing Maiden](#playing-maiden-frontend) below, [`docs/roadmap.md`](docs/roadmap.md),
> [`docs/frontend.md`](docs/frontend.md), and [`docs/testing.md`](docs/testing.md).

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

## Playing Maiden (frontend)

**Quickest start** — one command that installs, launches web + API, and opens the
browser:

```bash
./start.sh      # macOS / Linux
start.bat       # Windows (double-click or run in a terminal)
```

Or manually:

```bash
pnpm install
pnpm dev          # web on :5173, API on :3000
# open http://localhost:5173
```

The browser game plays the full loop: **Home → Format → Roll → Draft → Playing XI
→ Campaign → Match (ball-by-ball) → Scorecard → Result**, ending in Champion,
Invincible, or Golden Invincible. An in-progress game is saved to `localStorage`
(`maiden_save_v1`) and resumes on refresh.

Architecture (all cricket/game rules stay in the Phase 6–9 engine; React is
presentation only):

```
apps/web  (React 19 + Vite)         apps/api  (Fastify)
  screens / components         →      /api/roll, /api/game/*,           →   @maiden/game-data
  canonical app state (§9)            /api/campaign/{create,start,play-next}   @maiden/simulator
  localStorage persistence            (stateless: client holds the state)     (fs data + calibrated config)
```

The web bundle never imports Node-only engine code — it holds the serializable
game/campaign state and posts it to the API for each transition. Configure the
API URL with `VITE_API_BASE_URL` (default `http://localhost:3000`). Full detail:
[`docs/frontend.md`](docs/frontend.md).

## Commands

```bash
pnpm dev            # start the game: web (http://localhost:5173) + API (:3000)
pnpm dev:web        # web dev server only
pnpm dev:api        # API only
pnpm simulate       # simulate a full ODI match and print the scorecard
pnpm draft          # CLI: roll + build a legal XI + hand off to the simulator
pnpm campaign       # CLI: run a full campaign
pnpm --filter @maiden/simulator calibrate   # re-fit the calibrated config from history
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

### Player ratings (Phase 5)

```bash
python scripts/generate_ratings.py --version v1   # -> ratings_v1.json + player_ratings.parquet
python scripts/validate_ratings.py                # range/null/determinism checks
```

See [`docs/rating-methodology.md`](docs/rating-methodology.md).

### Full build order

The database is built in sequence — **run these in order** (each builds on the
previous):

```bash
python scripts/download_cricsheet.py         # 1. fetch Cricsheet archives (once)
python scripts/build_database.py             # 2. Phase 1: matches/deliveries
python scripts/build_world_cup_database.py   # 3. Phase 2: World Cup universe
python scripts/resolve_players.py            # 4. Phase 3: canonical identities
python scripts/build_tournament_stats.py     # 5. Phase 4: statistics parquet
python scripts/generate_ratings.py --version v1  # 6. Phase 5: ratings
```

Then `validate_world_cups.py`, `validate_identity.py`,
`validate_tournament_stats.py`, and `validate_ratings.py` to verify.

## Roadmap

Phase 0 established the project foundation, Phase 1 delivered the Cricsheet match
pipeline, Phase 2 delivered the historical World Cup database, and Phase 3 added
the canonical player-identity layer. Phase 4 delivered tournament statistics and
era normalization, Phase 5 the player ratings, Phase 6 the ball-by-ball simulation
engine, and Phase 7 calibrated that engine against historical ODI/T20
distributions. Phase 8 is next. Full plan in [`docs/roadmap.md`](docs/roadmap.md).

## Data attribution

Match data is sourced from [Cricsheet](https://cricsheet.org/), licensed under the
**Open Data Commons Attribution License (ODC-By) v1.0**. Attribution and license
notices must be preserved for any redistribution of derived datasets. See
[`docs/data-policy.md`](docs/data-policy.md).

## License

Project code: TBD.
