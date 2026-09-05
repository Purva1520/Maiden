# Maiden Frontend (Phase 10)

The playable Maiden game: a React app (`apps/web`) over a stateless Fastify API
(`apps/api`) that exposes the Phase 6–9 engine. The frontend is **presentation
only** — every cricket and game rule lives in `@maiden/game-data` and
`@maiden/simulator`, and is executed server-side.

## Running

```bash
pnpm install
pnpm dev            # web :5173 + API :3000 (parallel)
# open http://localhost:5173
```

`VITE_API_BASE_URL` (default `http://localhost:3000`) points the web app at the
API. See [`.env.example`](../.env.example).

## Why an API boundary

The simulator is browser-safe, but the data loaders and campaign engine read the
filesystem (`curated_squads.json`, ratings, campaign rules). Rather than ship
Node-only code to the browser, the API runs the engine and the browser holds the
**canonical serializable state** and posts it back for each transition. The web
bundle imports domain **types only** (erased at build time), so no `node:fs`
enters the client — verified by `pnpm --filter @maiden/web build`.

```
React (apps/web)  ──fetch──▶  Fastify (apps/api)  ──▶  @maiden/game-data + @maiden/simulator
 screens/components            stateless routes          roll · validate · finalize · campaign
 app state + localStorage      (state in → state out)    (fs data + Phase 7 calibrated config)
```

## API endpoints (stateless)

| Method | Path                                             | Purpose                                     |
| ------ | ------------------------------------------------ | ------------------------------------------- |
| GET    | `/api/config`                                    | formats, editions, team + campaign rules    |
| POST   | `/api/game/create`                               | new `MaidenGameState` (format, seed)        |
| POST   | `/api/game/roll`                                 | deterministic historical roll + player pool |
| POST   | `/api/game/select` · `/remove` · `/replace`      | draft mutations                             |
| POST   | `/api/game/captain` · `/batting-order`           | XI configuration                            |
| POST   | `/api/game/validate`                             | structured `XIValidationResult`             |
| POST   | `/api/game/finalize`                             | immutable `MaidenTeam`                      |
| POST   | `/api/campaign/create` · `/start` · `/play-next` | campaign lifecycle                          |

Each mutation takes the current state and returns the next state; the server
keeps no session. A played campaign round returns the user's `MatchResult`
(with its full event stream) inside the campaign state for playback.

## Screens & routes

`/` Home · `/format` Format · `/roll` Roll · `/draft` Draft · `/xi` Playing XI ·
`/campaign` Campaign · `/match` Match · `/scorecard` Scorecard · `/result` Result.

Every route reads and writes the one canonical app state
([`src/state/store.tsx`](../apps/web/src/state/store.tsx)); screens redirect when
their prerequisites are missing (e.g. `/campaign` before a finalized XI → `/draft`).

## Components

Reusable, presentation-focused (`apps/web/src/components`): `PlayerCard`,
`RollCard`, `PlayerPool`, `XIBuilder`, `TeamValidation`, `Scoreboard`,
`BatterCard`, `BowlerCard`, `BallFeed`, `Scorecard`, `CampaignMap`, `Standings`,
`ResultScreen`, `Achievement`, plus `Layout` (top bar + progress) and `Feedback`
(loading / error).

## Match playback

`simulateMatch` runs once (server-side); the browser replays the immutable event
stream. [`useMatchPlayback`](../apps/web/src/hooks/useMatchPlayback.ts) moves a
cursor over the deliveries (next / auto-play / pause / 0.5–4× / skip) and
[`matchView.ts`](../apps/web/src/lib/matchView.ts) derives the live scoreboard,
batters, bowler and feed. The result is never re-simulated.

## State & persistence

The app state (format, seed, draft state, finalized XI, campaign state, current
match) is persisted to `localStorage` under `maiden_save_v1` with a schema
version; corrupt or version-mismatched saves are discarded and the game starts
fresh. Large delivery-event arrays are stripped if storage runs low.

## Design system

A small token-based system in [`styles/app.css`](../apps/web/src/styles/app.css):
editorial serif display, tabular-figure stats, an ink + parchment/gold palette,
restrained motion honoring `prefers-reduced-motion`, and responsive layouts
(desktop dashboard → single-column mobile).

## Presentation layer (Phase 11 — game feel)

A dedicated presentation layer under `src/presentation/` turns the raw event
stream into a paced, readable experience — without ever changing an outcome. The
match result stays authoritative; the layer only decides _when_ to reveal and
_what_ to emphasize.

- **`useMatchPresentation`** — one state-machine controller with a single timer
  (`INTRO → BALL → OVER_BREAK / INNINGS_BREAK → COMPLETE`). The transition logic is
  a pure module (`presentation/match/cursor.ts`) so it is fully unit-tested.
- **Event-aware timing** (`presentation/match/timing.ts`) — dots pass quickly,
  boundaries and wickets breathe; ordinary events compress harder at 2×/4×.
- **Event text** (`presentation/match/eventText.ts`) — concise, game-like copy
  (`DOT`, `+1`, `FOUR!`, `SIX!`, `WICKET!`) plus factual dismissals and milestones
  (fifty / century / five-for). No commentary, no invented fielders.
- **Components** — `DeliveryReveal` (over.ball · bowler → batter · outcome ·
  progress), `EventBanner` (wicket / milestone flash), `OverBreak`,
  `InningsBreak`, `MatchIntro`.
- **Historical identity & rarity** (`presentation/players/historicalIdentity.ts`)
  — `HistoricalBadge` (World Cup / year) on every card, and a documented,
  **presentation-only** `LEGEND` tier (elite Phase 5 rating). Rarity never affects
  ratings, legality, or outcomes.

The controller reveals each delivery from the immutable stream and inserts
over / innings / match-complete transitions. Skipping to the result advances the
cursor to completion and shows the canonical final state — it never re-simulates.

## Testing

`pnpm --filter @maiden/web test` — Vitest + React Testing Library over pure
formatters, the match-view derivation, the presentation cursor transitions and
event text, and key components/screens, using the deterministic fixtures in
`src/dev-fixtures/`. Domain (Phase 5–9) tests remain untouched.
