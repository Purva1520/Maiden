# Campaign Configuration Reference (Phase 9)

## 1. Overview

The Maiden campaign configuration file defines all competition parameters, point rewards, tie-breakers, and format-specific thrashing rules.

Canonical file location:
`data/game/campaign/campaign_rules_v1.json`

---

## 2. Configuration Schema

```json
{
  "version": "v1.0.0",
  "points": {
    "win": 2,
    "tie": 1,
    "loss": 0
  },
  "tieBreakerOrder": ["POINTS", "RUN_DIFFERENTIAL", "WINS", "TEAM_ID"],
  "ODI": {
    "groupTeams": 8,
    "qualifiers": 4,
    "matchesPerTeam": 7,
    "thrashing": {
      "winByRuns": 50,
      "winByWickets": 6,
      "minBallsRemaining": 30
    }
  },
  "T20": {
    "groupTeams": 8,
    "qualifiers": 4,
    "matchesPerTeam": 7,
    "thrashing": {
      "winByRuns": 30,
      "winByWickets": 6,
      "minBallsRemaining": 24
    }
  }
}
```

---

## 3. Field Definitions

### Meta & Points

- `version` (`string`): Semantic version of the campaign ruleset. Must match `CAMPAIGN_RULES_VERSION` constant (`v1.0.0`).
- `points.win` (`number`): Points awarded to the match winner (default: `2`).
- `points.tie` (`number`): Points awarded to each team in a tied match (default: `1`).
- `points.loss` (`number`): Points awarded to the match loser (default: `0`).
- `tieBreakerOrder` (`string[]`): Prioritized sequence of tie-breaker attributes for group standings.

### Format-Specific Rules (`ODI` and `T20`)

- `groupTeams` (`number`): Total number of teams in the tournament group stage (standard: `8`).
- `qualifiers` (`number`): Number of teams qualifying for the knockout semifinals (standard: `4`).
- `matchesPerTeam` (`number`): Number of group-stage matches played by each team in single round-robin (standard: `7`).
- `thrashing.winByRuns` (`number`): Minimum victory margin in runs for a win by batting first to qualify as a Thrashing (`50` for ODI, `30` for T20).
- `thrashing.winByWickets` (`number`): Minimum victory margin in wickets for a win by chasing to qualify as a Thrashing (`6` for both formats).
- `thrashing.minBallsRemaining` (`number`): Minimum balls remaining in the innings when chasing target is reached (`30` for ODI = 5 overs; `24` for T20 = 4 overs).

---

## 4. Immutability & Versioning Constraints

1. **Deterministic Stability**: Existing campaign rules versions must not be modified in place. Any adjustments to points, qualification thresholds, or thrashing metrics must increment the version number (`campaign_rules_v2.json`).
2. **Format Segregation**: Rules configurations maintain explicit format separation (`ODI` vs `T20`) to preserve calibrated format mechanics established in Phase 7.
