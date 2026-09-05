"""Phase 4 configuration: versions, tournament→event mapping, taxonomies,
sample/coverage thresholds, and era windows.

Statistical constants live here (not buried in functions) so the methodology is
auditable and configurable — see docs/statistical-methodology.md.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Versions (stamped into the output so Phase 5 knows what produced its inputs)
# ---------------------------------------------------------------------------
STATISTICS_SCHEMA_VERSION = 1
NORMALIZATION_VERSION = 1

# ---------------------------------------------------------------------------
# Tournament → Cricsheet event mapping (VERIFIED against the Phase 1 database).
#
# Each Maiden World Cup maps to explicit (event_name, calendar_year) selectors.
# This is deliberate and auditable rather than fuzzy name matching (§60/§61).
# Editions with an empty list have NO Cricsheet ball-by-ball coverage
# (Cricsheet men's data starts in 2002), so they are reported as INSUFFICIENT —
# their Phase 2 curated squads remain valid regardless (§62/§63).
# ---------------------------------------------------------------------------
TOURNAMENT_EVENTS: dict[str, list[tuple[str, int]]] = {
    # ODI — no coverage before 2003
    "ODI_WC_1975": [],
    "ODI_WC_1979": [],
    "ODI_WC_1983": [],
    "ODI_WC_1987": [],
    "ODI_WC_1992": [],
    "ODI_WC_1996": [],
    "ODI_WC_1999": [],
    "ODI_WC_2003": [("ICC World Cup", 2003)],
    "ODI_WC_2007": [("ICC World Cup", 2007)],
    "ODI_WC_2011": [("ICC Cricket World Cup", 2011)],
    "ODI_WC_2015": [("ICC Cricket World Cup", 2015)],
    "ODI_WC_2019": [("World Cup", 2019)],
    "ODI_WC_2023": [("ICC Cricket World Cup", 2023)],
    # T20 — all editions covered
    "T20_WC_2007": [("ICC World Twenty20", 2007)],
    "T20_WC_2009": [("ICC World Twenty20", 2009)],
    "T20_WC_2010": [("ICC World Twenty20", 2010)],
    "T20_WC_2012": [("ICC World Twenty20", 2012)],
    "T20_WC_2014": [("World T20", 2014), ("ICC Men's T20 World Cup", 2014)],
    "T20_WC_2016": [("World T20", 2016), ("ICC World Twenty20", 2016)],
    "T20_WC_2021": [("ICC Men's T20 World Cup", 2021)],
    "T20_WC_2022": [("ICC Men's T20 World Cup", 2022)],
    "T20_WC_2024": [("ICC Men's T20 World Cup", 2024)],
}

# ---------------------------------------------------------------------------
# Cricket-statistics taxonomies (from the source data)
# ---------------------------------------------------------------------------
# Dismissals credited to the bowler (§23). Everything else (run out, retired*,
# obstructing the field, timed out, hit the ball twice, handled the ball) is not.
BOWLER_WICKET_KINDS = frozenset(
    {"caught", "bowled", "lbw", "caught and bowled", "stumped", "hit wicket"}
)

# Extras charged to the bowler for runs_conceded (§22): the batter's runs plus
# wides and no-balls. Byes, leg-byes and penalty runs are NOT charged to the bowler.
BOWLER_CHARGED_EXTRAS = frozenset({"wides", "noballs"})
# Extras that mean the batter did not "face" a legal ball for balls-faced (§12):
# a wide is not a ball faced; no-balls/byes/leg-byes ARE faced by the batter.
NON_BALL_FACED_EXTRAS = frozenset({"wides"})
# Extras that make a delivery an illegal ball for balls-bowled (§21).
ILLEGAL_BALL_EXTRAS = frozenset({"wides", "noballs"})

# ---------------------------------------------------------------------------
# Sample-size thresholds (§31/§45/§46) — documented, configurable.
# Buckets: NONE (0 innings) / LOW (below `valid`) / VALID (>= `valid`).
# ---------------------------------------------------------------------------
BATTING_SAMPLE_VALID_INNINGS = 3
BOWLING_SAMPLE_VALID_INNINGS = 3

# ---------------------------------------------------------------------------
# Coverage thresholds (§62). Ratio = participating teams that appear in the
# matched Cricsheet matches / participating teams.
# ---------------------------------------------------------------------------
COVERAGE_COMPLETE_RATIO = 1.0  # all participating teams present in match data

# Minimum observations in a tournament population for a baseline to be
# considered representative rather than INSUFFICIENT (§64).
BASELINE_MIN_POPULATION = 8

# ---------------------------------------------------------------------------
# Era windows (§38/§40) — configurable; NOT final rating eras. Pooled per format.
# ---------------------------------------------------------------------------
ERA_DEFINITIONS: dict[str, dict] = {
    "ODI_2000s": {"format": "ODI", "start_year": 2000, "end_year": 2009},
    "ODI_2010s": {"format": "ODI", "start_year": 2010, "end_year": 2018},
    "ODI_2020s": {"format": "ODI", "start_year": 2019, "end_year": 2029},
    "T20_2007_2012": {"format": "T20", "start_year": 2007, "end_year": 2012},
    "T20_2013_2018": {"format": "T20", "start_year": 2013, "end_year": 2018},
    "T20_2019_2024": {"format": "T20", "start_year": 2019, "end_year": 2024},
}


def era_for(fmt: str, year: int) -> str | None:
    """Return the era id containing (format, year), or None."""
    for era_id, spec in ERA_DEFINITIONS.items():
        if spec["format"] == fmt and spec["start_year"] <= year <= spec["end_year"]:
            return era_id
    return None


# ---------------------------------------------------------------------------
# Normalized features: (raw_column, direction). direction=+1 → higher is better;
# direction=-1 → lower is better (economy, bowling avg, bowling SR). The
# percentile is oriented so that HIGHER percentile always means BETTER (§42).
# ---------------------------------------------------------------------------
BATTING_NORM_FEATURES: dict[str, int] = {
    "bat_runs": +1,
    "bat_average": +1,
    "bat_strike_rate": +1,
    "bat_runs_per_innings": +1,
    "bat_boundary_rate": +1,
}
BOWLING_NORM_FEATURES: dict[str, int] = {
    "bowl_wickets": +1,
    "bowl_economy": -1,
    "bowl_average": -1,
    "bowl_strike_rate": -1,
    "bowl_wickets_per_innings": +1,
}
