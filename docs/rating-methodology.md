# Maiden Rating Methodology (Phase 5, v1)

How Maiden turns Phase 4 statistical features into `batRating` and `bowlRating`
on a **0–99** scale. Ratings are **retrospective historical evaluations** (not
forecasts, §80): the model may use the full historical distribution to place a
tournament performance in context.

> Ratings are Maiden's own model, generated from public historical performance
> data. No commercial-game ratings are copied; there are **no per-player
> hardcoded ratings, no fame/legend/team/career bonuses, and no simulation
> feedback** (§2/§3/§59/§60/§61/§91).

## Input contract

The model consumes `data/processed/player_tournament_stats.parquet` (Phase 4) —
one row per player × tournament × team — and never re-derives raw statistics
(§7). Ratings are per **player × tournament × format**, so the same player has
different cards for different tournaments (§4/§6).

## Latent score

For each skill the latent is a **weighted mean of blended percentile features**:

1. **Blend** each metric's Phase 4 tournament and era percentiles (both already
   direction-corrected, higher = better): `blended = 0.5·tourn_pct + 0.5·era_pct`
   over whichever are available (§16).
2. **Weighted mean** across the selected features, renormalizing the weights over
   the features that are non-null for that row (a null feature is dropped, never
   treated as 0, §45).
3. **Shrinkage** toward the population median percentile (50) by sample size:
   `latent_shrunk = w·latent + (1−w)·50`, `w = innings / (innings + k)`, `k = 3`.
   This damps extreme ratings from tiny samples without a hidden penalty (§21/§22);
   both the raw and shrunk latents are preserved.

Only players who batted (`bat_innings > 0`) get a batting latent; only players who
bowled get a bowling latent. Unobserved skills are **null**, never invented (§46/§66).

### Features and weights (v1)

Chosen for low redundancy (correlated volume/rate/quality facets are not all
double-counted, §13). Weights are explicit and versioned in
`data/game/ratings/batting_v1.json` / `bowling_v1.json`.

| Skill | Feature                | ODI weight | T20 weight | Rationale                                                       |
| ----- | ---------------------- | ---------- | ---------- | --------------------------------------------------------------- |
| Bat   | `bat_runs_per_innings` | 0.30       | 0.30       | per-innings productivity                                        |
| Bat   | `bat_average`          | 0.28       | 0.16       | runs per dismissal (quality)                                    |
| Bat   | `bat_strike_rate`      | 0.22       | 0.34       | scoring speed — weighted higher in T20                          |
| Bat   | `bat_runs`             | 0.20       | 0.20       | contextual impact/volume (capped so volume can't dominate, §20) |
| Bowl  | `bowl_economy`         | 0.28       | 0.40       | run restriction — dominant in T20                               |
| Bowl  | `bowl_wickets`         | 0.27       | 0.25       | wicket-taking impact                                            |
| Bowl  | `bowl_average`         | 0.25       | 0.20       | runs per wicket                                                 |
| Bowl  | `bowl_strike_rate`     | 0.20       | 0.15       | balls per wicket                                                |

Excluded from v1 (documented): `bat_boundary_rate` (≈ strike rate),
`bowl_wickets_per_innings` (≈ wickets), milestone counts (fifties/hundreds/
five-fors/maidens) — all correlated with included features.

Format weights differ deliberately (§62): T20 rewards strike rate/economy more.

## Calibration (latent → 0–99)

Method `normal_quantile` (`calibration_v1.json`). Within each **(format, skill)
population, pooled across all tournaments** (cross-era comparable, not per-
tournament forced to 99, §26/§27; separate per format, §28):

```
p = (rank − 0.5) / N                     # Hazen plotting position of latent_shrunk
rating = clip(round(mean + sd · Φ⁻¹(p)), 0, 99)     # mean = 52, sd = 15
```

This is monotonic (higher latent → higher rating), deterministic (ties share a
rank), and produces a game-like spread: median ≈ 52, elite (90+) rare, only the
single best of each population near 99, and no clustering. Ratings are integers
only at the final step (§47); the 0–99 clip count is reported (§48).

## Missing data & unobserved skills

`null ≠ 0` throughout (§45). A specialist batter has `bowlRating = null`; a
specialist bowler has `batRating = null`; a player who neither batted nor bowled
gets both null. `bat_rating_status` / `bowl_rating_status` ∈ {FULL, LOW_SAMPLE,
UNOBSERVED}; confidence ∈ {HIGH, MEDIUM, LOW, UNOBSERVED} is metadata that does
not alter the displayed rating (§65).

## Model comparison

Three candidate latent formulations were compared (see
`notebooks/05_rating_model_comparison.ipynb`): (A) weighted era z-scores,
(B) robust (median/IQR) z-scores, (C) weighted blended percentiles. **C was
chosen** for v1: it is bounded and interpretable, naturally era-fair (percentiles
already remove the scoring environment), robust to skew, and stable — without the
unbounded-tail sensitivity of raw z-scores. Calibration then imposes the final
normal-shaped 0–99 scale.

## Versioning & reproducibility

Every card carries `rating_model_version`, `statistics_version`,
`normalization_version`, `calibration_version`. Given the Phase 4 parquet + the
committed config, the pipeline is fully deterministic (no randomness, no external
calls). A new model is `v2`, never an overwrite of `v1` (§76).

## Outputs

`player_ratings.parquet`, `ratings_v1.json` (cards), the `player_ratings` SQLite
table (added without touching other layers), and the rating/distribution reports.
Latent scores are preserved for auditability and future recalibration (§38).

## Known limitations

- Ratings inherit Phase 4 coverage: PARTIAL/INSUFFICIENT tournaments yield fewer
  or no cards; only World Cup squads are rated (Phase 2 population).
- `mean`/`sd` calibration targets are reasonable but tunable; the distribution
  report is the tool for adjusting them.
- Confidence is exposed but does not (yet) adjust the displayed rating.
- v1 is intentionally a transparent statistical model, not ML (§77).
