# Maiden — Deterministic Debugging

Maiden is fully deterministic, so almost any gameplay bug can be reproduced from a
handful of values. When something looks wrong, capture the **debug context**, not
a screen recording.

## Debug context

```ts
interface MaidenDebugContext {
  gameVersion: string; // app version
  simulationVersion: string; // e.g. "v1"  (config.simulationVersion)
  configVersion: string; // calibrated config version (config.calibrationVersion)
  rulesVersion: string; // campaign_rules_v1 version
  dataVersion: string; // ratings / data artifact version
  seed: number; // the game seed (drives roll + all match seeds)
  campaignId?: string; // `campaign_<format>_<seed>`
  matchSeed?: number; // fixture.matchSeed for the specific match
}
```

Every `MatchResult` already carries `seed`, `simulationVersion` and
`configVersion`; every `CampaignMatchRecord` carries `matchSeed`,
`simulationVersion` and `configVersion`. The game seed lives in the app state and
is persisted, so it survives a refresh.

## Seed derivation

```
game seed  ──▶ roll (SeededRandom(seed))            → historical teams + pool
game seed  ──▶ campaign (seed reused as campaignId)  → opponents, fixtures
campaign seed + matchNumber + stage ──▶ deriveMatchSeed() → per-fixture matchSeed
matchSeed  ──▶ simulateMatch()                       → the exact ball-by-ball result
```

Same seed + same versions → identical roll, opponents, fixtures, match seeds,
results and achievements.

## Reproducing a match

The simulator CLI replays any match from a seed:

```bash
pnpm simulate --format odi --seed 849273 --full   # full scorecard
pnpm simulate --format t20 --seed 42
```

To reproduce a specific campaign fixture, take its `matchSeed` from the
`CampaignMatchRecord` (visible in the persisted campaign state) and run the
simulator with that seed and the two teams. The result is identical.

## Reproducing a draft / campaign

```bash
pnpm draft                 # deterministic roll + auto-built legal XI + handoff
pnpm campaign              # a full deterministic campaign
pnpm exec tsx scripts/run_campaign_batch.ts   # 100 seeded campaigns + report
```

## What NOT to do

- Don't debug from pixels — get the seed and versions.
- Don't add a per-player or per-team patch to "fix" a result; fix the responsible
  layer (data → ratings → model → engine). See [`balance.md`](balance.md) and
  [`testing.md`](testing.md).
- Production errors surface as friendly recovery states; technical detail stays in
  logs, never in the user-facing UI.
