# Data

This tree holds Maiden's datasets, separated by processing stage. No cricket
data exists in Phase 0 — these directories are empty placeholders.

| Directory         | Meaning                                                         | Git policy                                  |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------- |
| `data/raw/`       | Original, externally sourced datasets (e.g. Cricsheet).        | **Ignored.** Large / licensed; not committed. |
| `data/processed/` | Generated, normalized/analytical datasets from the pipeline.   | **Ignored.** Regenerable build artifacts.     |
| `data/game/`      | Curated, game-ready datasets consumed by Maiden at runtime.    | Small curated files **may** be committed later (add explicit un-ignore rules in `.gitignore`). |

See [`docs/data-policy.md`](../docs/data-policy.md) for sourcing, licensing and
attribution rules.
