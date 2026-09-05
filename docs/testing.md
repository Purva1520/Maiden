# Maiden Testing & Validation (Phase 12)

Maiden's quality system spans data, ratings, the simulator, the game engine, and
the frontend. This document is the map.

## Test pyramid

```
                 E2E / integration (few)
              domain + simulation (many)
        unit + data validation (fast, most)
```

Most tests are fast unit/domain tests; integration covers subsystem boundaries;
heavy Monte-Carlo runs live in `validate:deep`, not the CI-fast path.

## Where tests live

| Layer                                                                        | Location                                                    | Runner       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| Data pipeline, identity, stats                                               | `tests/data`, `tests/ratings`, `tests/integration`          | `pytest`     |
| Simulator (probabilities, innings, match, calibration, regression, extremes) | `packages/simulator/src/**/*.test.ts`                       | Vitest       |
| Game engine (XI builder, campaign, achievements, standings)                  | `packages/game-data/src/**`, `tests/team`, `tests/campaign` | Vitest       |
| Frontend (components, screens, controller, guards, save recovery)            | `apps/web/src/**/*.test.tsx`                                | Vitest + RTL |
| API                                                                          | `apps/api/src/*.test.ts`                                    | Vitest       |

## Determinism policy (§6, §171)

Every gameplay subsystem is deterministic: `same seed + same config + same
version → same output`. All gameplay randomness flows through `SeededRandom`
(`packages/simulator`); the only `Math.random` in production is the one-time
game-seed generation, which is then stored and persisted. Randomized/batch tests
must record their seed so any failure reproduces exactly.

## What is covered

- **Data**: tournament universe (ODI 1975–2023, T20 2007–2024), squad/identity
  integrity, roles, provenance (`pytest`, `validate_*.py`).
- **Ratings**: bounds 0–99, determinism, distribution, era-normalization,
  versioning.
- **Delivery model**: probabilities in [0,1] summing to 1 across every phase and
  format, rating influence, and the four rating extremes (0/0, 0/99, 99/0, 99/99).
- **Innings/match**: 0/0, all-out at 10 wickets, max-overs termination,
  target-reached termination, ties, strike rotation, bowler over-limits, scorecard
  and event-stream reconciliation, over notation, 300-innings property invariants,
  frozen regression results.
- **XI builder**: exactly 11, ≥1 keeper, ≥5 bowling options, top-order rule,
  duplicate-canonical rejection, captain, batting order, serialization.
- **Campaign**: fixtures (round-robin), standings + tie-breakers, qualification /
  elimination, knockout tie (better group standing), Champion / Invincible /
  Golden Invincible including the boundary cases where they diverge, serialization
  and deterministic replay.
- **Frontend**: playback controller transitions, event text, route guards
  (recovery not crash), corrupted-save recovery, key components, production build.

## Commands

```bash
pnpm typecheck            # strict TS across all packages
pnpm lint                 # ESLint
pnpm test                 # all Vitest suites (unit → simulation regression)
pnpm python:test          # pytest (data + ratings)
pnpm build                # production build (web + API)

pnpm validate:production   # ordered release gate (fast); non-zero on failure
pnpm validate:deep         # heavy: 12k-innings calibration regression + 100 campaigns
```

`validate:production` runs typecheck → lint → format → all JS tests → pytest →
database integrity (`PRAGMA`) → simulation-config validation → production build,
and stops on the first failure. `validate:deep` runs the calibration regression
(asserts STATUS: PASS against the Phase 7 envelope) and a 100-campaign smoke batch.

## Adding a regression test

When a bug is found: reproduce it from its seed, fix it in the correct layer
(data → ratings → model → engine → UI), add a test named for the behavior
(`stops the innings when the target is reached on the final legal ball`), and
re-run the gate. Never weaken a test to make CI green (§169).
