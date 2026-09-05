# Maiden — Balance

Balance in Maiden is **emergent and calibrated**, never scripted. Difficulty comes
from real Phase 5 player ratings and the Phase 7 delivery calibration. There is no
rubber-banding, no adaptive difficulty, and no hidden player or team bonus (audited
in Phase 12 §92/§93).

## Calibration envelope (Phase 7)

The simulator's aggregate distributions are fitted to the project's own Cricsheet
history and are re-checked by `pnpm validate:deep` (12,000 innings/format, neutral
teams). Accepted envelope (aggregate relative error < 0.15):

| Metric      | ODI (hist → sim) | T20 (hist → sim) |
| ----------- | ---------------- | ---------------- |
| Mean score  | 239 → ~240       | 143 → ~144       |
| Run rate    | 5.11 → ~5.1      | 7.41 → ~7.4      |
| Wicket /100 | 2.98 → ~3.0      | 6.20 → ~6.3      |
| Four /100   | 7.24 → ~7.2      | 9.54 → ~9.6      |
| Six /100    | 1.40 → ~1.4      | 4.28 → ~4.2      |

Aggregate relative error: ODI ≈ 0.05, T20 ≈ 0.04.

## Rating differentiation

Calibration tunes only the neutral baseline; the skill matchup is untouched, so
ratings create **meaningful but stochastic** differences (asserted in
`calibration.test.ts`): elite batting out-scores weak batting against the same
attack, and elite bowling concedes less — without making elite XIs unbeatable.

## Campaign difficulty (indicative)

From the 100-campaign smoke batch (`scripts/run_campaign_batch.ts`), a greedily
auto-built user XI qualifies above the 8-team coinflip baseline (ratings matter)
and wins the tournament a minority of the time. Exact rates depend on the roll.
This is an indicative smoke test, **not** a finalized balance target — the Phase 9
balance pass is deferred.

## Changing balance (policy)

If a balance metric moves outside its envelope, fix the **responsible layer** and
re-run `pnpm validate:deep`:

1. **Data** — a wrong historical squad/rating → fix curation (`data/`), never a
   frontend or engine exception.
2. **Ratings** — a model problem → fix normalization / rating model / calibration
   (Phase 5), never a per-player hardcode (`if (player === 'X') …`).
3. **Delivery model** — scoring/wicket rates off → re-run Phase 7 calibration
   (`pnpm --filter @maiden/simulator calibrate`), which rewrites the versioned
   `simulation_config_v1.json`.
4. **Campaign** — structure/qualification → edit `campaign_rules_v1.json`.

Every balance change must be documented, versioned, tested, and reproducible. Never
add "if the user is losing/winning, adjust the odds" logic (§128–§131).
