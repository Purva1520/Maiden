# Maiden World Cup Campaign Engine (Phase 9)

## 1. Overview

The Maiden Campaign Engine orchestrates a complete fictional World Cup tournament above the limited-overs cricket simulation engine (Phase 6/7) and the Playing XI builder (Phase 8).

A player's finalized `MaidenTeam` enters an 8-team tournament universe featuring 7 dynamically drawn, legal historical World Cup opponent teams from the curated historical dataset. The campaign simulates every ball deterministically, tracks comprehensive group-stage standings, orchestrates knockout semifinals and final, and evaluates endgame achievements.

```
       Finalized Maiden XI (Phase 8)
                     │
                     ▼
       ┌───────────────────────────────┐
       │     Tournament Setup          │
       │  - Draw 7 Historical Opponents│
       │  - Generate 28 Round-Robin    │
       │    Fixtures across 7 Rounds   │
       │  - Initialize 0-State Table   │
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │   Stage 1: Group Stage (7 Rds)│
       │  - 4 Matches per Round        │
       │  - 1 User Match + 3 Background│
       │  - Re-sort Standings Table    │
       └──────────────┬────────────────┘
                      │
               Top 4 Qualify?
              ┌───────┴───────┐
              │ NO            │ YES
              ▼               ▼
      [ELIMINATED]    ┌───────────────────────────────┐
                      │    Stage 2: Semifinals        │
                      │  - SF 1: 1st vs 4th           │
                      │  - SF 2: 2nd vs 3rd           │
                      │  - Tie Resolution by Group Pos│
                      └──────────────┬────────────────┘
                                     │
                               User Won SF?
                              ┌──────┴──────┐
                              │ NO          │ YES
                              ▼             ▼
                      [ELIMINATED]    ┌───────────────────────────────┐
                                      │     Stage 3: The Final        │
                                      │  - Finalist 1 vs Finalist 2   │
                                      │  - Championship Resolution    │
                                      └──────────────┬────────────────┘
                                                     │
                                                     ▼
                                      ┌───────────────────────────────┐
                                      │     Achievements & Result     │
                                      │  - Champion                   │
                                      │  - Invincible                 │
                                      │  - Golden Invincible          │
                                      └───────────────────────────────┘
```

---

## 2. Competition Structure

The tournament structure is standardized across ODI and T20 formats:

| Parameter                    | Value                               | Reference                  |
| :--------------------------- | :---------------------------------- | :------------------------- |
| **Total Teams**              | 8 teams (1 User Team + 7 Opponents) | `campaign_rules_v1.json`   |
| **Group Matches**            | 28 matches total (circle method)    | 7 rounds × 4 matches/round |
| **Matches per Team**         | 7 matches (1 per round)             | Every opponent faced once  |
| **Qualifiers**               | Top 4 teams                         | Advance to Semifinals      |
| **Semifinal 1**              | 1st place vs 4th place              | Higher seed hosts          |
| **Semifinal 2**              | 2nd place vs 3rd place              | Higher seed hosts          |
| **Final**                    | Winner SF 1 vs Winner SF 2          | Championship match         |
| **Total Tournament Matches** | 31 matches                          | 28 group + 2 SF + 1 Final  |

---

## 3. Opponent Generation

Opponents are selected from canonical World Cup squads (`curated_squads.json`). For each campaign:

1. Candidate teams for the target format (`ODI` or `T20`) are shuffled deterministically using the campaign seed.
2. 7 distinct historical teams are drawn.
3. For each historical squad, a legal Playing XI is constructed adhering to Maiden XI constraints:
   - Exactly 11 players.
   - At least 1 designated Wicketkeeper (`wicketkeeper === true`).
   - At least 5 viable bowling options (`role === 'BOWL' | 'ALLROUNDER'` or `bowlRating >= 30`).
   - At least 2 top-order capable players (`role === 'BAT' | 'WK'`).
   - Deduplicated by canonical player identity (`playerId`).
4. Opponent XIs are adapted to engine-compatible `SimulatorTeam` structures with ratings mapped from Phase 5 player cards. Ratings are attached via the same `(tournamentId, team)` surname + first-initial bridge used for the user pool (`team/ratings.ts`), so opponent difficulty emerges from real historical player ratings rather than uniform role defaults. Pre-~2000 editions have no Phase 5 ratings (no ball-by-ball source data) and fall back to role-based ratings — see [team-building.md](team-building.md#3-player-pool--historical-card-identity).

---

## 4. Schedule & Background Simulation

- **Circle Method Scheduling**: Generates the 28 group fixtures ensuring no team plays twice in the same round, no duplicate head-to-head fixtures occur, and the user faces all 7 opponents across rounds 1 to 7.
- **Deterministic Match Seeds**: Every fixture receives a deterministic seed derived from the campaign seed, match number, and stage via `deriveMatchSeed()`.
- **Authentic Background Simulation**: All matches—both user matches and concurrent background matches—are simulated using the Phase 6/7 `simulateMatch()` engine. No scores or standings are fabricated.
- **Calibrated Engine**: Match execution loads the Phase 7 calibrated config (`simulation_config_v1.json` via `team/simConfig.ts`), so campaign scores follow the calibrated ODI/T20 distributions. Each `CampaignMatchRecord` preserves the `simulationVersion` and `configVersion` used, so future engine changes do not silently reinterpret old campaigns.

---

## 5. Standings & Tie-Breakers

Group standings are maintained and re-sorted after every completed match.

### Points System

- **Win**: 2 points
- **Tie**: 1 point
- **Loss**: 0 points

### Deterministic Tie-Breaker Hierarchy

When two or more teams finish with identical points, positions are resolved in strict priority order:

1. **Points** (descending)
2. **Run Differential** (`runsFor - runsAgainst`, descending)
3. **Total Wins** (descending)
4. **Team ID** (ascending, deterministic tie-break fallback)

---

## 6. Knockout Progression & Tie Resolution

- **Semifinals**:
  - `sf_1`: 1st place vs 4th place.
  - `sf_2`: 2nd place vs 3rd place.
- **Tie Resolution**: If a knockout match ends in a tie, Maiden resolves the winner in favor of the team with the superior group-stage rank (lower position number).
- **Championship**: The final match determines the World Cup Champion.

---

## 7. Endgame Achievements

Achievements are evaluated cleanly without state side-effects:

| Achievement            | Requirement                                                                                                                                  |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **World Cup Champion** | User team wins the tournament Final.                                                                                                         |
| **Invincible**         | User team wins **every single required tournament match** (all 7 group matches + Semifinal + Final = 9 wins) without a single defeat or tie. |
| **Golden Invincible**  | User team is **Invincible** AND **every single victory satisfies the Thrashing rule**.                                                       |

### Format-Specific Thrashing Criteria

A victory qualifies as a "Thrashing" under format rules:

- **ODI Thrashing**:
  - Win by runs: Margin $\ge 50$ runs, OR
  - Win by wickets: Margin $\ge 6$ wickets AND $\ge 30$ balls remaining.
- **T20 Thrashing**:
  - Win by runs: Margin $\ge 30$ runs, OR
  - Win by wickets: Margin $\ge 6$ wickets AND $\ge 24$ balls remaining.

---

## 8. State Machine & Serialization

Campaign state is immutable and serializable to JSON:

- `createCampaign(userTeam, format, seed)`: Initializes a campaign in `NOT_STARTED` status.
- `startCampaign(state)`: Draws opponents, builds group fixtures, transitions to `GROUP_STAGE`.
- `playNextMatch(state)`: Advances one stage unit (1 group round or 1 knockout round).
- `playEntireCampaign(state)`: Runs tournament to completion or elimination.
- `serializeCampaign(state)` / `deserializeCampaign(json)`: Guarantees zero-drift state replay.
- `validateCampaign(state)`: Reconciles match records with final results and standings.
