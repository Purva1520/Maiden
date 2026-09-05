"""Phase 4 — Tournament statistics & era normalization.

Modules:
* config    — versions, tournament→event mapping, taxonomies, thresholds, eras.
* aggregate — raw player×tournament×team batting/bowling statistics from SQLite.
* baselines — per-tournament statistical distributions (the environment).
* eras      — era windows and pooled era baselines.
* features  — normalized (percentile / z / robust-z) tournament- and era-relative
              features, with correct direction of goodness.
* coverage  — tournament→match mapping and ball-by-ball coverage status.

Raw and normalized values are kept side by side; missing data is never silently
imputed to zero (see docs/statistical-methodology.md).
"""
