# Tournament Statistics Dataset (Phase 4)

How to consume `data/processed/player_tournament_stats.parquet`. Formulas and
conventions are in [`statistical-methodology.md`](statistical-methodology.md); a
machine-readable field dictionary is generated at
`data/processed/feature_dictionary.json`.

## Files

| File                                 | Contents                                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| `player_tournament_stats.parquet`    | One row per player × tournament × team (raw + derived + normalized). |
| `tournament_baselines.parquet`       | Per-tournament distribution of each normalized metric (long form).   |
| `era_baselines.parquet`              | Per-era pooled distribution of each metric.                          |
| `tournament_stats_report.{json,txt}` | Coverage, counts, reconciliation, status.                            |
| `tournament_stats_manifest.json`     | Versions, timestamp, formats, feature count.                         |
| `feature_dictionary.json`            | Description of every column.                                         |

## Column groups (prefixes)

- **identity**: `tournament_id, year, format, team_id, team_name, player_id,
player_name, era_id`.
- **participation**: `squad_member, participated, batted, bowled,
matches_played, role, wicketkeeper`.
- **raw batting**: `bat_innings, bat_runs, bat_balls, bat_dismissals,
bat_not_outs, bat_fours, bat_sixes, bat_highest, bat_fifties, bat_hundreds`.
- **derived batting**: `bat_average, bat_strike_rate, bat_runs_per_innings,
bat_boundary_rate, bat_boundary_runs`.
- **raw bowling**: `bowl_innings, bowl_balls, bowl_runs_conceded, bowl_wickets,
bowl_maidens, bowl_five_wickets`.
- **derived bowling**: `bowl_economy, bowl_average, bowl_strike_rate,
bowl_wickets_per_innings, bowl_overs_display`.
- **quality**: `tournament_coverage_status, batting_data_quality,
bowling_data_quality, batting_sample_status, bowling_sample_status`.
- **normalized**: `{metric}_tourn_pct`, `{metric}_tourn_z`, `{metric}_era_pct`,
  `{metric}_era_z` — percentile/z, tournament- and era-relative, direction so
  **higher = better**.

## Loading

```python
import pandas as pd
stats = pd.read_parquet("data/processed/player_tournament_stats.parquet")

stats[
    (stats["player_id"] == "sachin_tendulkar")
    & (stats["tournament_id"] == "ODI_WC_2003")
][["bat_runs", "bat_average", "bat_strike_rate", "bat_runs_tourn_pct"]]
```

Remember: `bat_average` / `bowl_economy` etc. are **null** (not 0) when undefined;
percentiles are null for players who did not bat/bowl. Always check
`tournament_coverage_status` and the `*_sample_status` before treating a
normalized value as meaningful.

## Commands

```bash
python scripts/build_tournament_stats.py            # build (ODI + T20)
python scripts/build_tournament_stats.py --format t20
python scripts/validate_tournament_stats.py         # validate outputs
```

## Notebooks

`notebooks/01_tournament_statistics.ipynb` … `04_normalization_validation.ipynb`
explore/visualize the outputs. They are for analysis only — all production logic
lives in `data-pipeline/normalization/stats/` and `data-pipeline/validation/`.
