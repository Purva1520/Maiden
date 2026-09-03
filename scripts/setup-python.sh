#!/usr/bin/env bash
# Create and provision the Python virtual environment for the Maiden data pipeline.
# Run from the repository root:  ./scripts/setup-python.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment at .venv ..."
  python3 -m venv .venv
fi

echo "Upgrading pip ..."
.venv/bin/python -m pip install --upgrade pip >/dev/null

echo "Installing the data pipeline (editable) with dev extras ..."
.venv/bin/python -m pip install -e ".[dev]"

echo "Done. Activate with:  source .venv/bin/activate"
