"""Phase 4 statistics validation & reporting.

Sanity checks (non-negative stats, percentiles in range, unique keys),
reconciliation of captured batter runs vs source deliveries (§57/§58), and
per-tournament coverage. Produces human-readable + machine-readable reports.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

# Normalized percentile columns must lie in [0, 100].
_PCT_SUFFIXES = ("_tourn_pct", "_era_pct")


@dataclass
class StatsReport:
    status: str = "PASS"
    build_timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    odi_tournaments: int = 0
    t20_tournaments: int = 0
    total_tournaments: int = 0
    player_tournament_records: int = 0
    with_batting: int = 0
    without_batting: int = 0
    with_bowling: int = 0
    without_bowling: int = 0
    coverage_complete: int = 0
    coverage_partial: int = 0
    coverage_insufficient: int = 0
    tournament_baselines: int = 0
    era_baselines: int = 0
    normalized_feature_columns: int = 0
    null_batting_average: int = 0
    null_bowling_economy: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    per_tournament: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "build_timestamp": self.build_timestamp,
            "tournaments": {
                "odi": self.odi_tournaments,
                "t20": self.t20_tournaments,
                "total": self.total_tournaments,
            },
            "player_tournament_records": self.player_tournament_records,
            "batting": {"with_data": self.with_batting, "no_opportunity": self.without_batting},
            "bowling": {"with_data": self.with_bowling, "no_opportunity": self.without_bowling},
            "coverage": {
                "complete": self.coverage_complete,
                "partial": self.coverage_partial,
                "insufficient": self.coverage_insufficient,
            },
            "normalization": {
                "tournament_baselines": self.tournament_baselines,
                "era_baselines": self.era_baselines,
                "normalized_feature_columns": self.normalized_feature_columns,
            },
            "null_values": {
                "batting_average": self.null_batting_average,
                "bowling_economy": self.null_bowling_economy,
            },
            "validation": {"errors": len(self.errors), "warnings": len(self.warnings)},
            "errors": self.errors,
            "warnings": self.warnings,
            "per_tournament": self.per_tournament,
        }

    def render_text(self) -> str:
        lines = [
            "MAIDEN PHASE 4 STATISTICS REPORT",
            "================================",
            "",
            "World Cup tournaments processed",
            "-------------------------------",
            f"ODI: {self.odi_tournaments}",
            f"T20: {self.t20_tournaments}",
            f"Total: {self.total_tournaments}",
            "",
            "Player-tournament records",
            "-------------------------",
            f"Total: {self.player_tournament_records}",
            "",
            "Batting records",
            "---------------",
            f"With batting data: {self.with_batting}",
            f"No batting opportunity: {self.without_batting}",
            "",
            "Bowling records",
            "---------------",
            f"With bowling data: {self.with_bowling}",
            f"No bowling opportunity: {self.without_bowling}",
            "",
            "Coverage",
            "--------",
            f"Complete: {self.coverage_complete}",
            f"Partial: {self.coverage_partial}",
            f"Insufficient: {self.coverage_insufficient}",
            "",
            "Normalization",
            "-------------",
            f"Tournament baselines: {self.tournament_baselines}",
            f"Era baselines: {self.era_baselines}",
            f"Normalized feature columns: {self.normalized_feature_columns}",
            "",
            "Per-tournament",
            "--------------",
            f"{'tournament':<14}{'matches':>8}{'players':>8}{'bat_inns':>9}"
            f"{'runs':>8}{'wkts':>7}  coverage",
        ]
        for t in self.per_tournament:
            lines.append(
                f"{t['tournament_id']:<14}{t['matches']:>8}{t['players']:>8}"
                f"{t['bat_innings']:>9}{t['runs']:>8}{t['wickets']:>7}  {t['coverage']}"
            )
        lines += [
            "",
            f"Validation errors: {len(self.errors)}",
            f"Reconciliation warnings: {len(self.warnings)}",
        ]
        if self.warnings:
            lines.append("")
            for w in self.warnings:
                lines.append(f"  [WARNING] {w}")
        if self.errors:
            lines.append("")
            for e in self.errors:
                lines.append(f"  [ERROR] {e}")
        lines += ["", f"STATUS: {self.status}"]
        return "\n".join(lines)

    def write(self, json_path: Path, txt_path: Path) -> None:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(self.to_dict(), indent=2) + "\n", encoding="utf-8")
        txt_path.write_text(self.render_text() + "\n", encoding="utf-8")


def generate_report(
    conn: sqlite3.Connection,
    frames: dict[str, pd.DataFrame],
) -> StatsReport:
    r = StatsReport()
    df = frames["player_stats"]
    cov = frames["coverage"]

    r.total_tournaments = int(df["tournament_id"].nunique())
    r.odi_tournaments = int(df[df["format"] == "ODI"]["tournament_id"].nunique())
    r.t20_tournaments = int(df[df["format"] == "T20"]["tournament_id"].nunique())
    r.player_tournament_records = int(len(df))
    r.with_batting = int((df["bat_innings"] > 0).sum())
    r.without_batting = int((df["bat_innings"] == 0).sum())
    r.with_bowling = int((df["bowl_innings"] > 0).sum())
    r.without_bowling = int((df["bowl_innings"] == 0).sum())
    r.coverage_complete = int((cov["status"] == "COMPLETE").sum())
    r.coverage_partial = int((cov["status"] == "PARTIAL").sum())
    r.coverage_insufficient = int((cov["status"] == "INSUFFICIENT").sum())
    r.tournament_baselines = int(len(frames["tournament_baselines"]))
    r.era_baselines = int(len(frames["era_baselines"]))
    r.normalized_feature_columns = int(
        sum(1 for c in df.columns if c.endswith(("_tourn_pct", "_tourn_z", "_era_pct", "_era_z")))
    )
    r.null_batting_average = int(df["bat_average"].isna().sum())
    r.null_bowling_economy = int(df["bowl_economy"].isna().sum())

    # --- sanity checks (errors) ---
    if df.empty:
        r.errors.append("player_stats is empty")
    neg = df[(df["bat_runs"] < 0) | (df["bowl_runs_conceded"] < 0) | (df["bowl_wickets"] < 0)]
    if len(neg):
        r.errors.append(f"{len(neg)} rows with negative counts")
    for col in [c for c in df.columns if c.endswith(_PCT_SUFFIXES)]:
        bad = df[(df[col] < 0) | (df[col] > 100)]
        if len(bad):
            r.errors.append(f"{len(bad)} out-of-range values in {col}")
    dupes = df.duplicated(subset=["tournament_id", "team_id", "player_id"]).sum()
    if dupes:
        r.errors.append(f"{int(dupes)} duplicate (tournament, team, player) rows")

    # --- coverage warnings ---
    for _, c in cov.iterrows():
        if c["status"] != "COMPLETE":
            r.warnings.append(f"{c['tournament_id']}: coverage {c['status']}")

    # --- reconciliation (captured batter runs vs source, §57/§58) ---
    covered = {c["tournament_id"] for _, c in cov.iterrows() if c["status"] != "INSUFFICIENT"}
    total_runs = (
        pd.read_sql_query(
            """
        SELECT tm.tournament_id, SUM(d.batter_runs) AS total_runs
        FROM deliveries d
        JOIN overs o        ON d.over_id = o.over_id
        JOIN innings i      ON o.innings_id = i.innings_id
        JOIN tourn_match tm ON i.match_id = tm.match_id
        WHERE i.is_super_over = 0
        GROUP BY tm.tournament_id
        """,
            conn,
        )
        .set_index("tournament_id")["total_runs"]
        .to_dict()
    )
    captured = df.groupby("tournament_id")["bat_runs"].sum().to_dict()

    per = []
    for tid, c in cov.set_index("tournament_id").iterrows():
        sub = df[df["tournament_id"] == tid]
        per.append(
            {
                "tournament_id": tid,
                "matches": int(c["matches_available"]),
                "players": int(len(sub)),
                "bat_innings": int(sub["bat_innings"].sum()),
                "runs": int(sub["bat_runs"].sum()),
                "wickets": int(sub["bowl_wickets"].sum()),
                "coverage": c["status"],
                "runs_capture_ratio": round(captured.get(tid, 0) / total_runs[tid], 3)
                if tid in total_runs and total_runs[tid]
                else None,
            }
        )
        # A fully-covered tournament should capture ~all runs via its squads.
        if tid in covered and tid in total_runs and total_runs[tid]:
            ratio = captured.get(tid, 0) / total_runs[tid]
            if c["status"] == "COMPLETE" and ratio < 0.98:
                r.warnings.append(
                    f"{tid}: only {ratio:.0%} of batter runs captured by curated squads "
                    f"(missing squad players?)"
                )
    r.per_tournament = sorted(per, key=lambda x: x["tournament_id"])

    r.status = "PASS" if not r.errors else "REVIEW"
    return r
