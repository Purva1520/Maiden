# Cricsheet → Maiden field mapping

How the Cricsheet JSON (data_version 1.2.0) maps to the Maiden schema. This
reflects the actual parser (`data-pipeline/parsers/`) and writer
(`data-pipeline/export/`).

Top-level JSON keys: `meta`, `info`, `innings`.

## Match metadata (`info`, `meta`)

| Cricsheet JSON                                | Maiden                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| _filename stem_ (`1000887.json`)              | `matches.match_id`, `matches.source_file`                                  |
| `info.match_type`                             | `matches.match_type`; canonicalized → `matches.format` (`ODI`/`T20`)       |
| `info.gender`                                 | `matches.gender`                                                           |
| `info.team_type`                              | `matches.team_type`                                                        |
| `info.balls_per_over`                         | `matches.balls_per_over`                                                   |
| `info.overs`                                  | `matches.overs`                                                            |
| `info.season`                                 | `matches.season`                                                           |
| `info.venue` / `info.city`                    | `matches.venue` / `matches.city`                                           |
| `info.dates[]`                                | `match_dates(date, date_order)`; min/max → `matches.start_date`/`end_date` |
| `info.teams[0]` / `[1]`                       | `matches.team_1_id` / `team_2_id` → `teams`                                |
| `info.event.name`                             | `events.event_name`; `matches.event_id`                                    |
| `info.event.match_number` / `group` / `stage` | `matches.event_match_number` / `event_group` / `event_stage`               |
| `info.player_of_match[0]`                     | `matches.player_of_match_id` → `players`                                   |
| `meta.data_version` / `revision` / `created`  | `matches.data_version` / `revision` / `created`                            |

## Toss (`info.toss`)

| Cricsheet JSON          | Maiden                                  |
| ----------------------- | --------------------------------------- |
| `info.toss.winner`      | `matches.toss_winner_id` → `teams`      |
| `info.toss.decision`    | `matches.toss_decision` (`bat`/`field`) |
| `info.toss.uncontested` | `matches.toss_uncontested`              |

## Outcome (`info.outcome`)

| Cricsheet JSON                                   | Maiden                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `info.outcome.winner`                            | `matches.outcome_winner_id` → `teams`                                   |
| `info.outcome.by.runs`                           | `matches.result_type='runs'`, `result_margin`                           |
| `info.outcome.by.wickets`                        | `matches.result_type='wickets'`, `result_margin`                        |
| `info.outcome.by.innings` (+`by.runs`)           | `matches.result_type='innings'`, `result_by_innings=1`, `result_margin` |
| `info.outcome.result` (`tie`/`draw`/`no result`) | `matches.result_type`                                                   |
| `info.outcome.method` (`D/L`)                    | `matches.result_method`                                                 |
| `info.outcome.eliminator`                        | `matches.eliminator_winner_id` → `teams` (`result_type='eliminator'`)   |
| _derived_                                        | `matches.result_text` (human-readable summary)                          |

## People (`info.players`, `info.registry`, `info.officials`)

| Cricsheet JSON                                                         | Maiden                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `info.registry.people` (name → id)                                     | `players.registry_id` (identity anchor); name→player_id map per match |
| `info.players[team][]`                                                 | `match_players(match_id, team_id, player_id, playing_xi=1)`           |
| `info.officials.{umpires,tv_umpires,reserve_umpires,match_referees}[]` | `match_officials(role, official_name, official_order)`                |

Player references throughout deliveries are **names**; they are resolved to
`player_id` via the match registry (Cricsheet's stable person id). Player
identity is therefore consistent within the dataset without any fuzzy matching.

## Innings (`innings[]`)

| Cricsheet JSON                           | Maiden                                     |
| ---------------------------------------- | ------------------------------------------ |
| _array order_                            | `innings.innings_number` (1-based)         |
| `innings[].team`                         | `innings.team_id` → `teams` (batting team) |
| `innings[].super_over`                   | `innings.is_super_over`                    |
| `innings[].declared` / `forfeited`       | `innings.is_declared` / `is_forfeited`     |
| `innings[].target.runs` / `target.overs` | `innings.target_runs` / `target_overs`     |
| `innings[].penalty_runs.pre` / `.post`   | `innings.penalty_pre` / `penalty_post`     |

## Overs (`innings[].overs[]`)

| Cricsheet JSON    | Maiden                                     |
| ----------------- | ------------------------------------------ |
| `overs[].over`    | `overs.over_number` (0-based, as recorded) |
| _len(deliveries)_ | `overs.delivery_count`                     |

## Deliveries (`overs[].deliveries[]`)

| Cricsheet JSON                                             | Maiden                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| _array index_                                              | `deliveries.delivery_number` (0-based)                        |
| `deliveries[].batter`                                      | `deliveries.batter_id` → `players`                            |
| `deliveries[].non_striker`                                 | `deliveries.non_striker_id` → `players`                       |
| `deliveries[].bowler`                                      | `deliveries.bowler_id` → `players`                            |
| `deliveries[].runs.batter`                                 | `deliveries.batter_runs`                                      |
| `deliveries[].runs.extras`                                 | `deliveries.extra_runs`                                       |
| `deliveries[].runs.total`                                  | `deliveries.total_runs`                                       |
| `deliveries[].runs.non_boundary`                           | `deliveries.non_boundary`                                     |
| `deliveries[].extras.{wides,noballs,byes,legbyes,penalty}` | `delivery_extras(extra_type, runs)`                           |
| `deliveries[].wickets[].player_out`                        | `delivery_wickets.player_out_id` → `players`                  |
| `deliveries[].wickets[].kind`                              | `delivery_wickets.dismissal_kind`                             |
| `deliveries[].wickets[].fielders[].name`                   | `wicket_fielders.fielder_name` (+ `fielder_id` if resolvable) |
| `deliveries[].wickets[].fielders[].substitute`             | `wicket_fielders.is_substitute`                               |

Fields not consumed in Phase 1 (e.g. `deliveries[].review`, `deliveries[].replacements`,
`innings[].powerplays`, `deliveries[].actual_delivery`) remain available in the
source archive; they were intentionally not modelled to keep the schema focused.
