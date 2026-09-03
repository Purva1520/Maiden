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
│   ├── raw/          # Original sourced datasets (git-ignored)
│   ├── processed/    # Generated analytical datasets (git-ignored)
│   └── game/         # Curated game-ready datasets
├── data-pipeline/    # Python pipeline (ingest → cleaning → normalization →
│   │                 #   ratings → validation → export)
│   ├── ingest/
│   ├── cleaning/
│   ├── normalization/
│   ├── ratings/
│   ├── validation/
│   └── export/
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

### data-pipeline (Python) — _foundation only_

Offline, research-time data processing, staged as **ingest → cleaning →
normalization → ratings → validation → export**. **Current:** package skeleton,
scientific stack (pandas/numpy/scipy) and pytest wired up. **Future:** Cricsheet
ingestion (Phase 1) through the original Maiden rating system (Phase 5).

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
