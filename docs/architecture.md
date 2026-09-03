# Architecture

Maiden is a single Git **monorepo** containing the web app, the API, shared
TypeScript packages, the simulation engine, the game-data access layer, and a
Python data pipeline. This document describes the layout and the responsibility
of each layer.

> **Current vs Future.** Phase 0 establishes structure only. Sections marked
> _Future_ describe intended responsibilities that are **not implemented yet**.

## Repository layout

```text
maiden/
├── apps/
│   ├── web/          # React + Vite web application
│   └── api/          # Fastify HTTP API
├── packages/
│   ├── shared/       # Cross-application TypeScript types & utilities
│   ├── simulator/    # Cricket simulation engine (placeholder)
│   ├── game-data/    # Curated game-data access layer (placeholder)
│   └── ui/           # Reusable UI components (placeholder)
├── data/
│   ├── raw/          # Original sourced archives, e.g. raw/cricsheet/*.zip (git-ignored)
│   ├── processed/    # maiden.sqlite + ingestion_report.* (git-ignored)
│   └── game/         # Curated game-ready datasets
├── data-pipeline/    # Python pipeline (ingest → parsers → cleaning →
│   │                 #   validation → export)
│   ├── core/         # config, logging, build orchestration
│   ├── ingest/       # sources, downloader, ZIP streaming
│   ├── parsers/      # Cricsheet JSON → intermediate model
│   ├── cleaning/     # name/date/format normalization
│   ├── normalization/# (reserved for Phase 3+)
│   ├── ratings/      # (reserved for Phase 5)
│   ├── validation/   # data-quality checks + ingestion report
│   └── export/       # SQLite schema + buffered writer
├── notebooks/        # Exploratory Jupyter notebooks (research)
├── tests/            # Cross-cutting & Python pipeline tests
├── docs/             # Documentation (this directory)
└── scripts/          # Setup & maintenance scripts
```

## Toolchain

- **Package manager:** pnpm workspaces (`apps/*`, `packages/*`).
- **Language:** TypeScript (strict) for all JS/TS code; Python for the pipeline.
- **Web:** React 19 + Vite.
- **API:** Fastify.
- **Testing:** Vitest (TS), pytest (Python).
- **Quality:** ESLint + Prettier (TS), Ruff (Python).

No heavyweight monorepo framework (Nx/Turborepo/Bazel) is used. Internal packages
are consumed directly as TypeScript source (their `exports` point at `src/`), so
the dev server and tests need no pre-build step. Each package is type-checked and
tested independently; the root aggregates these with `pnpm -r`.

## Layers

### apps/web (React + Vite) — _minimal in Phase 0_

The player-facing web client. **Current:** a smoke-test page proving the app
launches and can import a workspace package. **Future:** the full Maiden UI —
roll, draft, XI builder, scoreboard, match feed, campaign map (Phase 10).

### apps/api (Fastify) — _minimal in Phase 0_

The HTTP backend. **Current:** configuration loading and a `GET /health`
endpoint returning `{ "status": "ok" }`. **Future:** endpoints for players,
tournaments, squads, matches, ratings and campaigns (later phases).

### packages/shared

Genuinely cross-application types and utilities. **Current:** a health/status
type and helper used to verify workspace imports. **Future:** shared domain
types once the Maiden data model is finalized. Deliberately kept near-empty now.

### packages/simulator — _placeholder_

Future home of the ball-by-ball cricket simulation engine (Phase 6+). **Current:**
an architectural placeholder with a trivial smoke-test export. When randomness is
introduced it must be **seeded and reproducible** (see Principle 6 below).

### packages/game-data — _placeholder_

Typed access layer for curated, game-ready datasets produced by the Python
pipeline. **Current:** placeholder. **Future:** loads `data/game/` artifacts.

### packages/ui — _placeholder_

Reusable visual components / design system. **Current:** placeholder. **Future:**
the Maiden component library (Phase 10).

### data-pipeline (Python) — _Phase 1 implemented_

Offline, research-time data processing, staged as **ingest → parsers → cleaning →
validation → export**. **Current (Phase 1):** a reproducible Cricsheet pipeline
that reads male ODI/T20 JSON archives and produces a normalized, validated
`data/processed/maiden.sqlite` with human- and machine-readable ingestion
reports. Entry points: `scripts/download_cricsheet.py`, `scripts/build_database.py`,
`scripts/validate_database.py`. See [`data-schema.md`](data-schema.md) and
[`cricsheet-mapping.md`](cricsheet-mapping.md). **Future:** player identity
reconciliation (Phase 3), era normalization (Phase 4) and the original Maiden
rating system (Phase 5). The `normalization/` and `ratings/` packages are
reserved placeholders for that work.

### data/

Datasets separated by processing stage — see [`../data/README.md`](../data/README.md)
and [`data-policy.md`](data-policy.md).

## Architectural principles

1. **Separation of concerns** — web UI, API, simulation, game data and the
   historical data pipeline are distinct layers.
2. **Data ≠ Game logic** — sourced data is never tightly coupled to UI code.
3. **Research ≠ Runtime** — Python analytics is separate from the browser game
   runtime.
4. **Small dependencies** — libraries are added only when genuinely required.
5. **Future-proof, not overengineered** — clean boundaries, no imaginary systems.
6. **Deterministic foundations** — the simulator will require seeded, reproducible
   randomness; nothing here makes that harder to add later.
7. **Documentation is part of the product** — this `docs/` tree is maintained
   alongside the code.
