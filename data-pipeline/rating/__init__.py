"""Phase 5 — Maiden Rating System.

Turns the Phase 4 normalized features (player_tournament_stats.parquet) into
format-specific, tournament-aware, era-normalized batting and bowling ratings on
a 0-99 scale.

Modules:
* versions       — model version metadata and config loading.
* normalization  — blend Phase 4 tournament+era percentiles into model features.
* batting_model  — latent batting score from features + weights + shrinkage.
* bowling_model  — latent bowling score.
* calibration    — map latent scores to 0-99 (per format/skill, cross-era).
* pipeline       — orchestration + export.

The model is generated purely from statistical features. No per-player ratings,
no fame/legend/team/career bonuses, no simulation feedback. See
docs/rating-methodology.md.
"""
