# tests/

Top-level home for **cross-cutting** and Python pipeline tests, organized by
concern:

| Directory            | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `tests/data/`        | Data pipeline & environment tests (Python / pytest). |
| `tests/ratings/`     | Future Maiden rating-system tests (Phase 5).         |
| `tests/simulator/`   | Future end-to-end simulator tests (Phase 6+).        |
| `tests/integration/` | Future cross-layer integration tests.                |

Phase 0 contains only a pytest environment smoke test in `tests/data/`. Unit
tests that belong to a specific TypeScript package live **next to their source**
inside that package (e.g. `packages/shared/src/*.test.ts`) and run via Vitest.
