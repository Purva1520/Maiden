# Development

How to set up Maiden locally and run the day-to-day commands.

## Prerequisites

| Tool    | Version           | Notes                                               |
| ------- | ----------------- | --------------------------------------------------- |
| Node.js | 26 (see `.nvmrc`) | `nvm use` picks it up automatically.                |
| pnpm    | ≥ 11              | Recommended: enable via Corepack (bundled w/ Node). |
| Python  | ≥ 3.12 (3.14 dev) | For the data pipeline.                              |
| Git     | any recent        |                                                     |

### Installing pnpm

pnpm ships with Node via Corepack:

```bash
corepack enable pnpm
```

If Corepack cannot write to the global bin directory, install the shim into a
user-writable directory that is on your `PATH`, e.g.:

```bash
corepack enable --install-directory ~/.local/bin pnpm
```

## First-time setup

```bash
# 1. JavaScript / TypeScript dependencies
pnpm install

# 2. Environment file
cp .env.example .env

# 3. Python virtual environment + pipeline (creates .venv, installs deps)
./scripts/setup-python.sh
```

The Python step is equivalent to:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

`.venv/` and `.env` are git-ignored.

## Node commands (run from the repo root)

| Command             | What it does                                                 |
| ------------------- | ------------------------------------------------------------ |
| `pnpm install`      | Install all workspace dependencies.                          |
| `pnpm dev`          | Start the web app dev server (`@maiden/web`).                |
| `pnpm dev:api`      | Start the API in watch mode (`@maiden/api`).                 |
| `pnpm build`        | Build all packages that define a `build` script (web + api). |
| `pnpm typecheck`    | Type-check every workspace package.                          |
| `pnpm test`         | Run all Vitest suites across the workspace.                  |
| `pnpm lint`         | ESLint over `apps/` and `packages/`.                         |
| `pnpm lint:fix`     | ESLint with autofix.                                         |
| `pnpm format`       | Prettier — write.                                            |
| `pnpm format:check` | Prettier — check only (used in CI).                          |

## Python commands

| Command                    | What it does                                  |
| -------------------------- | --------------------------------------------- |
| `pnpm python:test`         | Run pytest (`.venv/bin/python -m pytest`).    |
| `pnpm python:lint`         | Ruff lint over `data-pipeline/` and `tests/`. |
| `pnpm python:format`       | Ruff format — write.                          |
| `pnpm python:format:check` | Ruff format — check only.                     |

You can also activate the venv and run the tools directly (`pytest`, `ruff …`).

## Data pipeline (Phase 1)

Turns raw Cricsheet archives into `data/processed/maiden.sqlite`. Downloads are
**explicit** — building never downloads as a side effect.

```bash
# 1. Download the archives (into data/raw/cricsheet/). Explicit, ~31 MB total.
python scripts/download_cricsheet.py                 # ODI + T20
python scripts/download_cricsheet.py --format odi    # or: t20 | all
python scripts/download_cricsheet.py --force         # re-download

# 2. Build the normalized database (rebuilds from scratch; atomic replace).
python scripts/build_database.py                     # ODI + T20
python scripts/build_database.py --format odi        # or: t20 | all

# 3. Validate an existing database (+ sample queries).
python scripts/validate_database.py
python scripts/validate_database.py --db data/processed/maiden.sqlite
```

Equivalent pnpm wrappers exist: `pnpm data:download`, `pnpm data:build`,
`pnpm data:validate`.

Outputs (all under `data/processed/`, git-ignored):

- `maiden.sqlite` — the normalized database (schema version 1)
- `ingestion_report.json` — machine-readable metrics
- `ingestion_report.txt` — human-readable report

The build is transaction-safe: it writes to a temporary database and only
atomically replaces `maiden.sqlite` after validation passes, so a failed build
never corrupts a known-good database. Enable foreign keys when querying:
`PRAGMA foreign_keys = ON;`.

Schema and mapping: [`data-schema.md`](data-schema.md),
[`cricsheet-mapping.md`](cricsheet-mapping.md).

## Notes on placeholder commands

Several packages are Phase 0 **placeholders** (`simulator`, `game-data`, `ui`).
They define `typecheck` and `test` scripts (which pass), but intentionally have
no `build` step because they are consumed as source. `pnpm build` therefore only
builds `@maiden/web` and `@maiden/api`. This is by design, not an omission.
