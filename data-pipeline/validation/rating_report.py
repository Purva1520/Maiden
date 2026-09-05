"""Phase 5 rating reports & validation.

Produces the rating distribution report, a top-rated review, an era breakdown,
and validation (range, null policy, format separation). Uses actual computed
values only.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

_PCTS = [10, 25, 50, 75, 90, 95, 99]


def _dist(s: pd.Series) -> dict:
    v = s.dropna().astype(float)
    d = {"count": int(v.size)}
    if v.size:
        d.update(
            min=float(v.min()),
            max=float(v.max()),
            mean=round(float(v.mean()), 2),
            median=float(v.median()),
            std=round(float(v.std(ddof=1)), 2) if v.size > 1 else 0.0,
            n_zero=int((v == 0).sum()),
            n_99=int((v == 99).sum()),
        )
        for p in _PCTS:
            d[f"p{p}"] = float(v.quantile(p / 100))
    return d


@dataclass
class RatingReport:
    model_version: str = ""
    statistics_version: str = ""
    normalization_version: str = ""
    calibration_version: str = ""
    populations: dict = field(default_factory=dict)
    distributions: dict = field(default_factory=dict)
    unobserved: dict = field(default_factory=dict)
    low_sample: dict = field(default_factory=dict)
    top: dict = field(default_factory=dict)
    era: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    status: str = "PASS"

    def to_dict(self) -> dict:
        return {
            "model_version": self.model_version,
            "statistics_version": self.statistics_version,
            "normalization_version": self.normalization_version,
            "calibration_version": self.calibration_version,
            "populations": self.populations,
            "distributions": self.distributions,
            "unobserved": self.unobserved,
            "low_sample": self.low_sample,
            "validation": {"errors": len(self.errors)},
            "errors": self.errors,
            "status": self.status,
        }

    def render_text(self) -> str:
        lines = [
            "MAIDEN RATING SYSTEM — V1",
            "==========================",
            "",
            "Model",
            "-----",
            f"Version: {self.model_version}",
            f"Statistics version: {self.statistics_version}",
            f"Normalization version: {self.normalization_version}",
            f"Calibration version: {self.calibration_version}",
            "",
            "Population (rated cards)",
            "------------------------",
        ]
        for key, n in self.populations.items():
            lines.append(f"{key}: {n}")
        for key, d in self.distributions.items():
            lines += ["", f"{key}", "-" * len(key)]
            if d.get("count"):
                lines.append(
                    f"count={d['count']} min={d['min']:.0f} max={d['max']:.0f} "
                    f"mean={d['mean']} median={d['median']:.0f} "
                    f"p90={d['p90']:.0f} p99={d['p99']:.0f} 99s={d['n_99']} 0s={d['n_zero']}"
                )
        for key, players in self.top.items():
            lines += ["", f"Top {key}", "-" * (4 + len(key))]
            for i, (name, tid, r) in enumerate(players, 1):
                lines.append(f"{i:>2}. {name} — {tid} — {r}")
        if self.era:
            lines += ["", "By era (decade) — mean / median rating", "-" * 38]
            for key, rows in self.era.items():
                lines.append(f"  {key}:")
                for decade, mean, median, n in rows:
                    lines.append(f"    {decade}: mean={mean:.1f} median={median:.0f} n={n}")
        lines += ["", "Validation", "----------", f"Range/null errors: {len(self.errors)}"]
        for e in self.errors:
            lines.append(f"  [ERROR] {e}")
        lines += ["", f"STATUS: {self.status}"]
        return "\n".join(lines)

    def write(self, json_path: Path, txt_path: Path, dist_path: Path) -> None:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(self.to_dict(), indent=2) + "\n", encoding="utf-8")
        txt_path.write_text(self.render_text() + "\n", encoding="utf-8")
        dist_path.write_text(json.dumps(self.distributions, indent=2) + "\n", encoding="utf-8")


def generate_report(df: pd.DataFrame) -> RatingReport:
    r = RatingReport(
        model_version=df["rating_model_version"].iloc[0] if len(df) else "",
        statistics_version=df["statistics_version"].iloc[0] if len(df) else "",
        normalization_version=df["normalization_version"].iloc[0] if len(df) else "",
        calibration_version=df["calibration_version"].iloc[0] if len(df) else "",
    )

    for fmt in ("ODI", "T20"):
        sub = df[df["format"] == fmt]
        for skill, col in (("batting", "bat_rating"), ("bowling", "bowl_rating")):
            key = f"{fmt}_{skill}"
            rated = sub[sub[col].notna()]
            r.populations[key] = int(len(rated))
            r.distributions[key] = _dist(sub[col])
            # top 10 for review
            top = rated.sort_values(col, ascending=False).head(10)
            r.top[key] = [(t["player"], t["tournament_id"], int(t[col])) for _, t in top.iterrows()]
            # unobserved / low-sample
            scol = "bat_rating_status" if skill == "batting" else "bowl_rating_status"
            r.unobserved[key] = int((sub[scol] == "UNOBSERVED").sum())
            r.low_sample[key] = int((sub[scol] == "LOW_SAMPLE").sum())
            # era breakdown
            if len(rated):
                rated = rated.assign(
                    decade=(rated["year"] // 10 * 10).astype(int).astype(str) + "s"
                )
                era_rows = []
                for decade, g in rated.groupby("decade"):
                    era_rows.append(
                        (decade, float(g[col].mean()), float(g[col].median()), int(len(g)))
                    )
                r.era[key] = sorted(era_rows)

    # --- validation ---
    for col in ("bat_rating", "bowl_rating"):
        v = df[col].dropna()
        if len(v) and (v.min() < 0 or v.max() > 99):
            r.errors.append(f"{col} outside 0-99")
        if (v != v.round()).any():
            r.errors.append(f"{col} has non-integer values")
    # Observed skills must have a rating; unobserved must not.
    bat_obs = df["bat_sample_status"] != "NONE"
    if df.loc[bat_obs, "bat_rating"].isna().any():
        r.errors.append("some observed batters have no bat_rating")
    if df.loc[~bat_obs, "bat_rating"].notna().any():
        r.errors.append("some non-batters have a bat_rating (should be null)")
    bowl_obs = df["bowl_sample_status"] != "NONE"
    if df.loc[bowl_obs, "bowl_rating"].isna().any():
        r.errors.append("some observed bowlers have no bowl_rating")
    if df.loc[~bowl_obs, "bowl_rating"].notna().any():
        r.errors.append("some non-bowlers have a bowl_rating (should be null)")

    r.status = "PASS" if not r.errors else "REVIEW"
    return r
