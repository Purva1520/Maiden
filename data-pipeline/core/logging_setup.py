"""Shared logging configuration for pipeline scripts."""

from __future__ import annotations

import logging


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging with a concise, readable format.

    Idempotent: safe to call from multiple entry points.
    """
    logging.basicConfig(
        level=level,
        format="[%(levelname)s] %(message)s",
        force=True,
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
