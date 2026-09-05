# Maiden — Known Limitations (v1)

Genuine, current limitations of the shipped game. These are deliberate v1
scoping decisions, not bugs. Each is designed so the unsupported state is
**impossible or explicit**, never silently broken.

## Cricket mechanics not modelled

- **Extras (wides, no-balls, byes, leg-byes)** — not implemented. The simulator's
  outcome space is `DOT, 1, 2, 3, 4, 6, W`. Calibration folds the real-world extras
  contribution into the scoring outcomes so aggregate **totals** match history
  (documented Phase 7 v1 simplification). Every delivery is therefore a legal ball.
- **Super Over** — not implemented. A tied regulation match stays a **TIE**
  (`result.type === 'TIE'`). In the campaign, a tied knockout is resolved by the
  documented Maiden rule — **the higher group-stage seed advances** — not by a Super
  Over. This is a Maiden game rule, not a universal cricket rule.
- **Retired hurt** — not implemented. A batter is only ever removed by a wicket;
  the game never represents retired-hurt as a dismissal.
- **Dismissal detail** — the v1 engine credits every wicket to the bowler
  (`Batter b Bowler`); catchers, run-outs, stumpings and other dismissal types are
  not modelled, and the UI never invents them.

## Ratings & data

- **Pre-~2000 editions are unrated.** Phase 5 ratings derive from Cricsheet
  ball-by-ball data, which begins ~2000. Older World Cup squads (1975–1999) have no
  non-null ratings and fall back to role-based ratings in the simulator; those cards
  show "unrated" in the UI.
- **Squad-curation coverage.** A few historical tournaments have incomplete squads
  (surfaced by `validate_world_cups.py`); this is a curation gap, not a code fault.

## Frontend / persistence

- **A Node API server is required.** The engine reads the filesystem, so the
  browser talks to the Fastify API (`apps/api`); the game is not a pure static site.
- **Save compatibility.** Saves are versioned (`maiden_save_v1`, schema v1). A save
  with a mismatched schema version is **discarded and the game starts fresh** — there
  is no silent migration (pre-release policy). Corrupt saves recover the same way.
- **Ball-by-ball replay after refresh.** Delivery-event streams are stripped from
  `localStorage` to stay under quota, so a match viewed _after a page refresh_ shows
  the result/scorecard directly rather than replaying ball-by-ball. Live-played
  matches replay fully.

## Balance

Campaign balance is **calibrated, not final** (the Phase 9 balance pass is
deferred). Difficulty emerges from real historical ratings and the Phase 7
calibration — there is no rubber-banding and no hidden bonuses. See
[`balance.md`](balance.md).
