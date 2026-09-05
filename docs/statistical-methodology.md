# Statistical Methodology (Phase 4)

The methodological contract for Maiden's tournament statistics and era
normalization. Phase 5 (ratings) consumes these definitions. Output:
`data/processed/player_tournament_stats.parquet` (one row per player × tournament
× team), plus `tournament_baselines.parquet` and `era_baselines.parquet`.

`statistics_schema_version = 1`, `normalization_version = 1`.

## Population (who gets a row)

The population is the Phase 2 `tournament_squads` (canonical historical squads).
A selected player who never batted or bowled is still represented, with explicit
participation/coverage/sample metadata — **missing opportunity is never turned
into zero performance** (§7/§8/§30). Super-over innings are excluded from all
figures.

Participation states are kept distinct: `squad_member`, `participated` (Phase 2
flag), `batted` (≥1 batting innings), `bowled` (≥1 bowling innings),
`matches_played` (distinct XI appearances).

## Tournament → match mapping

Each Maiden World Cup maps to explicit `(event_name, year)` selectors verified
against the database (`normalization/stats/config.TOURNAMENT_EVENTS`), never by
fuzzy name matching (§60/§61). Cricsheet men's coverage begins in 2002, so the
1975–1999 ODI World Cups have **no** ball-by-ball data and are reported
`INSUFFICIENT` — their Phase 2 curated squads remain valid regardless (§62/§63).

## Batting definitions

| Metric                         | Definition                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `bat_runs`                     | Σ runs off the bat (excludes wides, byes, leg-byes).                                                                |
| `bat_innings`                  | Innings the player came to the crease (appeared as batter, non-striker, or was dismissed).                          |
| `bat_balls`                    | Deliveries faced as striker **excluding wides** (no-balls, byes, leg-byes count).                                   |
| `bat_dismissals`               | Times out — every wicket of the batter **except** retirements (run outs count).                                     |
| `bat_not_outs`                 | `bat_innings − bat_dismissals`.                                                                                     |
| `bat_fours` / `bat_sixes`      | Deliveries where `batter_runs == 4/6` and the run is a boundary (`non_boundary = 0`), distinct from runs run (§15). |
| `bat_highest`                  | Max single-innings score; **null** if never batted.                                                                 |
| `bat_fifties` / `bat_hundreds` | Innings with `50 ≤ score < 100` / `score ≥ 100` (a century is 1 hundred, 0 fifties).                                |
| `bat_average`                  | `bat_runs / bat_dismissals`; **null** when 0 dismissals (§13).                                                      |
| `bat_strike_rate`              | `bat_runs / bat_balls × 100`; **null** when 0 balls (§14).                                                          |
| `bat_runs_per_innings`         | `bat_runs / bat_innings`; null when 0 innings.                                                                      |
| `bat_boundary_rate`            | `(fours + sixes) / bat_balls`; null when 0 balls.                                                                   |

## Bowling definitions

| Metric               | Definition                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bowl_balls`         | Legal balls = deliveries **excluding wides and no-balls** (§21).                                                                        |
| `bowl_overs_display` | Cricket notation from `bowl_balls` (29 → "4.5" = 4 overs + 5 balls); display only.                                                      |
| `bowl_runs_conceded` | `batter_runs + wides + no-balls` charged to the bowler; **byes, leg-byes and penalties are not** (§22).                                 |
| `bowl_wickets`       | Bowler-credited only: caught, bowled, lbw, caught and bowled, stumped, hit wicket. Run outs and retirements are **not** credited (§23). |
| `bowl_innings`       | Innings in which the player bowled ≥1 delivery.                                                                                         |
| `bowl_maidens`       | Overs with 0 charged runs and ≥1 legal ball.                                                                                            |
| `bowl_five_wickets`  | Innings with ≥5 bowler-credited wickets (per innings, not per tournament, §27).                                                         |
| `bowl_economy`       | `bowl_runs_conceded × 6 / bowl_balls`; **null** when 0 balls (computed from balls, not decimal overs, §24).                             |
| `bowl_average`       | `bowl_runs_conceded / bowl_wickets`; **null** when 0 wickets (§25).                                                                     |
| `bowl_strike_rate`   | `bowl_balls / bowl_wickets`; **null** when 0 wickets (§26).                                                                             |

## Null policy

Undefined ratios are **null**, never 0 (§52/§83). "Did not bat" (`bat_innings = 0`,
`bat_average = null`, `bat_highest = null`) is distinct from "batted and scored 0".
No silent imputation.

## Baselines (the environment)

Per tournament, for each normalized metric, the distribution over the qualifying
player population (players for whom the metric is defined) is persisted:
`count, mean, median, std, q10, q25, q50, q75, q90` (§36/§37). Distributions —
not just means — so percentile, z-score and robust z-score are all supported. A
population below `BASELINE_MIN_POPULATION` (8) is flagged `INSUFFICIENT`.

Delivery-weighted **environment** metrics (batting run rate, boundary rate,
economy) are computed from aggregate totals so a few small-sample players cannot
distort them (§53), and are used for era analysis.

## Eras

Configurable per-format windows (`ERA_DEFINITIONS`) — **not** final rating eras
(§38/§40). Current windows: ODI 2000s/2010s/2020s, T20 2007–2012 / 2013–2018 /
2019–2024. Era baselines pool the distribution across the window's tournaments.

## Normalization

Never across format (§44). For each metric we add tournament- and era-relative
features:

- `{metric}_tourn_pct`, `{metric}_era_pct` — empirical percentile within the
  group (0–100).
- `{metric}_tourn_z`, `{metric}_era_z` — z-score from the group mean/std.

All are **direction-corrected** so **higher always means better**: for economy,
bowling average and bowling strike rate (lower is better) the orientation is
flipped (§42). Normalization is computed only over players who batted/bowled
(§30); players with no opportunity get null, never a misleading value. Raw
columns are never overwritten (§43/§50). Sample-size and coverage metadata are
preserved so Phase 5 can decide how to weight small samples (§45–47) — **no
hidden small-sample penalty is applied here** (§47/§104).

## Sample size & coverage

- `batting_sample_status` / `bowling_sample_status`: `NONE` (0 innings) / `LOW`
  (1–2) / `VALID` (≥3). Thresholds configurable.
- `tournament_coverage_status`: `COMPLETE` (all participating teams present in the
  matched match data) / `PARTIAL` / `INSUFFICIENT` (no ball-by-ball data).
- `batting_data_quality` / `bowling_data_quality` follow tournament coverage.

## Reconciliation

For covered tournaments the report records the fraction of total batter runs
captured by the curated-squad population (`runs_capture_ratio`). Values below 1.0
mean the Phase 2 curated squads do not include every player who appeared (a known
Phase 2 squad-completeness limitation, surfaced not hidden, §57/§58).

## Known limitations

- 1975–1999 ODI World Cups: no Cricsheet ball-by-ball data (`INSUFFICIENT`).
- Several editions are `PARTIAL` (some teams' matches absent from the main event
  grouping, e.g. Afghanistan's 2015 games).
- Curated squads capture ~70–90% of run production in fully-covered tournaments;
  the remainder comes from participants not in the curated 15-man squads.
- Validated spot-check: Sachin Tendulkar, ODI 2003 → 673 runs / 11 innings / avg
  61.2, matching the historical scorecard.
