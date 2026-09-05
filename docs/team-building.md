# Maiden Team Building & XI Construction (Phase 8)

This document describes the core game mechanics, data contracts, validation rules, and simulation handoff for building a Maiden Playing XI.

---

## 1. Core Architecture & Philosophy

Maiden is not "pick the 11 highest-rated players." It is:

> **Build the strongest legal cricket XI from a constrained historical pool.**

The player makes strategic decisions balancing:

- Batting depth & top-order stability
- Bowling depth (≥ 5 bowling options required by the engine)
- Specialist wicketkeeper inclusion
- Batting order placement (openers, middle order, all-rounders, tail)
- Captaincy

```
FORMAT + SEED
      ↓
SEEDED ROLL (3 Historical Teams)
      ↓
COMBINED HISTORICAL PLAYER POOL
      ↓
SELECT / REMOVE / REPLACE
      ↓
BUILD XI (11 Players)
      ↓
VALIDATE (Hard Constraints + Soft Warnings)
      ↓
CAPTAIN + BATTING ORDER + BOWLING OPTIONS
      ↓
FINALIZE XI (Immutable MaidenTeam)
      ↓
SIMULATOR HANDOFF (Phase 6/7 Engine)
```

---

## 2. Seeded Roll Mechanic

A Maiden match begins with format selection (`ODI` or `T20`) and a deterministic numerical seed.

### Roll Configuration

```ts
export interface RollConfig {
  readonly numberOfTeams: number; // default: 3
  readonly allowDuplicateHistoricalTeam: boolean; // default: false
  readonly allowDuplicatePlayerAcrossRolls: boolean; // default: true
}
```

### Randomness & Determinism

All rolls use `SeededRandom` (`mulberry32`) from `@maiden/simulator`. No calls to unseeded `Math.random()` are made. The same format, configuration, and seed produce identical rolled teams every time.

### Historical Roll Universe

The roll universe is drawn strictly from the canonical Phase 2 database (`data/game/world_cups/`):

- **ODI World Cups**: 1975, 1979, 1983, 1987, 1992, 1996, 1999, 2003, 2007, 2011, 2015, 2019, 2023.
- **T20 World Cups**: 2007, 2009, 2010, 2012, 2014, 2016, 2021, 2022, 2024.

Invalid editions (such as ODI 2024 or T20 2019) cannot be rolled. The roll system identifies: `tournamentId`, `year`, `format`, `teamName`, and `displayName`.

---

## 3. Player Pool & Historical Card Identity

The rolled teams generate an eligible player pool:

```
rolled historical squads → all squad members → canonical player IDs → player-tournament cards
```

### Historical Card Identity

A Maiden player card represents a player **in a specific historical tournament**:

- `cardId = ${playerId}__${tournamentId}` (e.g. `sachin_tendulkar__ODI_WC_2003`)
- `playerId = slugify(playerName)` (canonical person identity)

If a player appears in multiple rolled historical editions (e.g. Tendulkar in India 2003 and India 2011), both cards appear in the pool with their respective historical tournament context and ratings.

### Duplicate Identity Constraint

A user may only select **one card per canonical real-world player** in a final XI (`allowDuplicateCanonicalPlayer = false`). Attempting to draft both Tendulkar 2003 and Tendulkar 2011 triggers domain error `DUPLICATE_PLAYER`.

### Participation Rule

By default, all canonical squad members of rolled teams belong to the pool (`participated` flag preserved for metadata).

### Rating Attachment (`team/ratings.ts`)

Each card's `batRating` / `bowlRating` come from the Phase 5 ratings (`data/processed/ratings_v1.json`). The curated squads store full display names ("David Warner") while the ratings store Cricsheet scorecard names ("DA Warner"), so ratings are joined **within each `(tournamentId, team)` group** by surname + first initial (`resolveCardRating`), not by a naive full-name slug. This recovers ~98% of cards to a rating row and every available non-null rating (a bare slug join reached only ~12%). When no confident match exists, the card keeps `null` ratings and the simulator adapter applies role-based fallbacks.

**Known limitation — pre-~2000 editions are unrated.** Phase 5 ratings derive from Cricsheet ball-by-ball data, which begins around 2000. Older World Cup editions (e.g. ODI 1975–1999) therefore have no non-null ratings even with a correct join, and those cards fall back to role-based ratings in the simulator. Rolls that land on early editions will show players as "unrated".

---

## 4. Playing XI Hard Constraints & Validation

The validator (`validateXI()`) returns a structured result separating hard constraints from soft warnings.

### Hard Constraints (Must Pass)

1. **Player Count**: Exactly **11 players** (`XI_TOO_SMALL` / `XI_TOO_LARGE`).
2. **Wicketkeeper**: At least **1 wicketkeeper** (`NO_WICKETKEEPER`). Determined via canonical metadata `wicketkeeper === true`.
3. **Bowling Options**: At least **5 bowling options** (`INSUFFICIENT_BOWLING_OPTIONS`).
4. **Top-Order Coverage**: At least **2 top-order capable players** (`INSUFFICIENT_TOP_ORDER`).
5. **No Duplicate Identity**: All 11 players must have unique canonical `playerId` values (`DUPLICATE_PLAYER`).
6. **Captain**: Exactly 1 captain selected, who must belong to the selected XI (`INVALID_CAPTAIN`).
7. **Batting Order**: Exactly 11 positions, matching the selected XI with no missing or duplicate players (`INVALID_BATTING_ORDER`).

### Bowling Option Definition

`isBowlingOption(player)` is the centralized source of truth:

```ts
export function isBowlingOption(player: PlayerCard): boolean {
  if (player.role === 'BOWL' || player.role === 'ALLROUNDER') return true;
  if (player.bowlRating !== null && player.bowlRating >= 30) return true;
  return false;
}
```

### Top-Order Capable Definition

`isTopOrderCapable(player)` is the centralized source of truth:

```ts
export function isTopOrderCapable(player: PlayerCard): boolean {
  return player.role === 'BAT' || player.role === 'WK';
}
```

---

## 5. Captain & Batting Order

### Captaincy

Any selected XI player may be designated as captain. Captaincy is stored as `captainId: string` (card reference) and does not artificially inflate ratings in Phase 8.

### Batting Order (1–11)

- When players are selected, `createDefaultBattingOrder` provides a cricket-sensible starting order using role awareness (openers/top order → middle order/wicketkeeper → all-rounders → specialist bowlers/tail).
- Users can adjust order via `swapPlayers(order, a, b)`, `movePlayer(order, from, to)`, or `setBattingOrder(order, newOrder)`.
- Reordering maintains completeness and validity.

---

## 6. Formation Metadata

The composition of the XI is captured in `XIFormation`:

```ts
export interface XIFormation {
  readonly topOrder: readonly string[]; // positions 1-2
  readonly middleOrder: readonly string[]; // positions 3-5
  readonly lowerOrder: readonly string[]; // positions 6-7
  readonly tail: readonly string[]; // positions 8-11
  readonly wicketkeepers: readonly string[];
  readonly bowlingOptions: readonly string[];
  readonly specialistBowlers: readonly string[];
  readonly allRounders: readonly string[];
}
```

---

## 7. State Machine & Serialization

The game follows a strict, serializable state machine:

```
ROLL_PENDING → DRAFTING → XI_IN_PROGRESS → READY
```

- `createGame(format, seed)` → `ROLL_PENDING`
- `rollTeams(state)` → `DRAFTING`
- `selectPlayerInDraft(state, cardId)` → `XI_IN_PROGRESS`
- `finalizeXI(state)` → `READY`
- `resetDraft(state)` → resets selection while preserving format and roll.

The entire state is pure JSON and serializable via `serializeGameState()` and `deserializeGameState()`.

---

## 8. Simulator Handoff (Phase 6/7 Integration)

The team builder produces a finalized `MaidenTeam` and hands it off to Phase 6 `simulateMatch()` via an isolated simulation adapter:

```
MaidenTeam
    ↓
toSimulatorTeam() [team/adapter.ts]
    ↓
Simulator Team (PlayerContext[])
    ↓
simulateMatch({ format, teamA, teamB, seed })
```

The adapter ensures:

- Rating fallbacks for unobserved skills so the simulator receives valid 0–99 ratings without crashing.
- Bowlers are identified by `bowlRating: number`, and non-bowlers have `bowlRating: null`.
- Engine independence is strictly preserved.

The handoff loads the **calibrated** Phase 7 config (`data/game/simulation/simulation_config_v1.json` via `team/simConfig.ts`) and passes it to `simulateMatch`, so drafted and campaign matches run on the calibrated ODI/T20 model rather than the uncalibrated Phase 6 baseline. It falls back to `DEFAULT_SIMULATION_CONFIG` if the file is absent.
