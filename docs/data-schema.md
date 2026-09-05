# Maiden Database Schema

The Maiden data pipeline produces a normalized SQLite database at
`data/processed/maiden.sqlite` (schema version **1**). This document describes
every table, its keys, and the relationships between them across Phase 1
(Ball-by-Ball Match Engine) and Phase 2 (Historical World Cup Tournament Universe).

Design principles: normalized (no giant denormalized delivery blob), loss-aware
(source detail preserved), and query-friendly (common joins stay simple).
Booleans are stored as `INTEGER` 0/1. Unknown values are `NULL` and are
distinguishable from genuine zeros/empties. Foreign keys are declared on every
relationship; enable enforcement at read time with `PRAGMA foreign_keys = ON`.

## ER diagram (textual)

```text
events ─┐
teams ──┼──< matches >──┬── match_dates
  │     │               ├── match_players >── players ──┐
  │     │               ├── match_officials             │
  │     │               └── innings ──< overs ──< deliveries ─┬── delivery_extras
  │     │                     │                                ├── delivery_wickets ──< wicket_fielders
  │     └─────────────────────┘ (batting team)                │      │
  │     deliveries.batter_id / non_striker_id / bowler_id ─────┘      └── player_out_id → players
  │
  │   Phase 2 (World Cup Universe):
  ├───< tournament_teams >── tournaments
  │                                │
  └───< tournament_squads >────────┘
              │
              └────────────────────────────────────────> players
```

## Tables

### `pipeline_metadata`

Key/value reproducibility metadata.

- **PK**: `key`
- Values include: `pipeline_version`, `schema_version`, `source`,
  `build_timestamp`, and per-format `source_archive_*`, `source_bytes_*`,
  `source_mtime_*`.

### `teams`

Canonical teams (source names normalized for whitespace only — identities are
**not** merged in Phase 1).

- **PK**: `team_id`
- `source_name`, `canonical_name` (UNIQUE), `display_name`

### `players`

Canonical players, anchored on Cricsheet's stable registry id.

- **PK**: `player_id`
- `registry_id` (Cricsheet person id, UNIQUE, nullable), `canonical_name`,
  `display_name`

### `events`

Competitions/series (source names preserved). `event_type` is `NULL` in Phase 1
(classification such as WORLD_CUP is a later phase).

- **PK**: `event_id`
- `source_name`, `event_name` (UNIQUE), `event_type`

### `matches`

One row per match. Preserves the source match id and enough metadata to trace
back to the archive.

- **PK**: `match_id` (Cricsheet match id = JSON file stem)
- Key columns: `source`, `source_file`, `format` (`ODI`/`T20`), `match_type`
  (raw), `gender`, `team_type`, `balls_per_over`, `overs`, `season`,
  `event_id`, `event_match_number`, `event_group`, `event_stage`, `venue`,
  `city`, `start_date`, `end_date`, `team_1_id`, `team_2_id`, toss
  (`toss_winner_id`, `toss_decision`, `toss_uncontested`), result
  (`outcome_winner_id`, `result_type`, `result_margin`, `result_by_innings`,
  `result_method`, `eliminator_winner_id`, `result_text`),
  `player_of_match_id`, and meta (`data_version`, `revision`, `created`).
- **FKs**: `event_id`→events; `team_1_id`,`team_2_id`,`toss_winner_id`,
  `outcome_winner_id`,`eliminator_winner_id`→teams; `player_of_match_id`→players.

`result_type` ∈ {`runs`, `wickets`, `innings`, `tie`, `draw`, `no result`,
`eliminator`, `other`}.

### `match_dates`

All dates of a match, ordered (a match may span multiple days).

- **PK**: (`match_id`, `date_order`) · **FK**: `match_id`→matches

### `match_players`

The players listed in each team's squad/XI for a match (from `info.players`).
Answers "who was listed for this match?" — nothing is inferred.

- **PK**: `match_player_id` · **UNIQUE**(`match_id`,`player_id`)
- **FKs**: `match_id`→matches, `team_id`→teams, `player_id`→players

### `match_officials`

Umpires / TV umpires / reserve umpires / match referees, by name (officials are
not modelled as players).

- **PK**: `match_official_id` · **FK**: `match_id`→matches

### `innings`

Ordered innings within a match (batting team, super-over/declared/forfeited
flags, target, penalty runs).

- **PK**: `innings_id` · **UNIQUE**(`match_id`,`innings_number`)
- **FKs**: `match_id`→matches, `team_id`→teams

### `overs`

Overs within an innings; `delivery_count` is the number of deliveries recorded.

- **PK**: `over_id` · **UNIQUE**(`innings_id`,`over_number`)
- **FK**: `innings_id`→innings

### `deliveries`

The ball-by-ball table (the largest). One row per recorded delivery.

- **PK**: `delivery_id` · **UNIQUE**(`over_id`,`delivery_number`)
- Columns: `batter_id`, `non_striker_id`, `bowler_id`, `batter_runs`,
  `extra_runs`, `total_runs`, `non_boundary`, `is_wicket`
- **FKs**: `over_id`→overs; `batter_id`,`non_striker_id`,`bowler_id`→players

### `delivery_extras`

Extras per delivery, one row per extra type (a delivery may carry several).

- **PK**: (`delivery_id`,`extra_type`) · **FK**: `delivery_id`→deliveries
- `extra_type` ∈ {`wides`, `noballs`, `byes`, `legbyes`, `penalty`}

### `delivery_wickets`

Wickets on a delivery (a delivery may dismiss more than one player).

- **PK**: `wicket_id` · **FKs**: `delivery_id`→deliveries, `player_out_id`→players
- `dismissal_kind`, `wicket_order`

### `wicket_fielders`

Fielders credited with a dismissal. Resolved to a `player_id` via the registry
where possible; substitutes keep only `fielder_name` (with `fielder_id` NULL).

- **PK**: `wicket_fielder_id` · **FKs**: `wicket_id`→delivery_wickets,
  `fielder_id`→players (nullable)

## Phase 2: World Cup Universe Tables

### `tournaments`

All 22 historical ICC World Cup editions (13 ODI + 9 Men's T20 World Cups).

- **PK**: `tournament_id` (e.g. `ODI_WC_1975`, `T20_WC_2007`)
- Columns: `year`, `format` (`ODI` | `T20`), `name`, `display_name`,
  `edition_number`, `status` (`completed`), `source` (`cricsheet` | `wikipedia` | `manual`)

### `tournament_teams`

Participating teams for each World Cup edition, mapped to canonical team IDs.

- **PK**: (`tournament_id`, `team_id`)
- Columns: `team_name`, `source`, `source_reference`
- **FKs**: `tournament_id`→tournaments, `team_id`→teams

### `tournament_squads`

Curated 15-player tournament squads for each participating nation, linked to canonical player identities.

- **PK**: (`tournament_id`, `team_id`, `player_id`)
- Columns: `role` (`BAT` | `BOWL` | `ALLROUNDER` | `WK`), `wicketkeeper` (0/1),
  `participated` (0/1), `squad_order`, `source`, `source_reference`,
  `source_notes`, `original_player_name`, `original_team_name`
- **FKs**: `tournament_id`→tournaments, `team_id`→teams, `player_id`→players

## Indexes

Created after bulk load for speed. Rationale:

| Index                                                                                                                            | Why                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `matches(start_date)`, `matches(format)`, `matches(event_id)`                                                                    | filter/sort matches by date, format, competition                 |
| `match_dates(match_id)`                                                                                                          | fetch a match's dates                                            |
| `match_players(match_id)`, `match_players(player_id)`                                                                            | squad lookups both directions (a match's XI; a player's matches) |
| `match_officials(match_id)`                                                                                                      | a match's officials                                              |
| `innings(match_id)`, `innings(team_id)`                                                                                          | a match's innings; a team's innings                              |
| `overs(innings_id)`                                                                                                              | an innings' overs                                                |
| `deliveries(over_id)`                                                                                                            | an over's deliveries (score reconstruction)                      |
| `deliveries(batter_id)`, `deliveries(non_striker_id)`, `deliveries(bowler_id)`                                                   | per-player batting/bowling scans                                 |
| `delivery_extras(delivery_id)`, `delivery_wickets(delivery_id)`, `delivery_wickets(player_out_id)`, `wicket_fielders(wicket_id)` | join child rows back to deliveries; dismissals by player         |
| `tournament_teams(tournament_id)`, `tournament_teams(team_id)`                                                                   | Phase 2: tournament team lookups                                 |
| `tournament_squads(tournament_id)`, `tournament_squads(team_id)`, `tournament_squads(player_id)`                                 | Phase 2: tournament squad lookups by edition, team, or player    |

(UNIQUE constraints also create supporting indexes, e.g. `match_players(match_id,
player_id)`.)

## Example queries

### Phase 1: Recent Matches

```sql
SELECT m.match_id, m.start_date, t1.display_name, t2.display_name, m.result_text
FROM matches m
JOIN teams t1 ON m.team_1_id = t1.team_id
JOIN teams t2 ON m.team_2_id = t2.team_id
WHERE m.format = 'ODI'
ORDER BY m.start_date DESC
LIMIT 10;
```

### Phase 2: Tournament Squad Query

```sql
SELECT
    t.display_name AS tournament,
    tm.display_name AS team,
    p.display_name AS player,
    ts.role,
    ts.wicketkeeper
FROM tournament_squads ts
JOIN tournaments t ON ts.tournament_id = t.tournament_id
JOIN teams tm ON ts.team_id = tm.team_id
JOIN players p ON ts.player_id = p.player_id
WHERE t.format = 'ODI' AND t.year = 2011 AND tm.display_name = 'India'
ORDER BY ts.squad_order;
```

See [`cricsheet-mapping.md`](cricsheet-mapping.md) for the JSON→column mapping.

## Phase 4 analytical outputs (Parquet, not SQLite)

Phase 4 derives analytical datasets **from** `maiden.sqlite` into Parquet under
`data/processed/` — they are not tables in the SQLite database:

- `player_tournament_stats.parquet` — one row per player × tournament × team
  (raw + derived + normalized batting/bowling; see the generated
  `feature_dictionary.json`).
- `tournament_baselines.parquet` / `era_baselines.parquet` — persisted metric
  distributions used for normalization.

Definitions and formulas: [`statistical-methodology.md`](statistical-methodology.md);
consumption guide: [`tournament-statistics.md`](tournament-statistics.md).
