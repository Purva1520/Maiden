#!/usr/bin/env bash
#
# Maiden launcher (macOS / Linux).
# Installs dependencies if needed, starts the web app + API, and opens the
# browser. Press Ctrl+C to stop.
#
#   ./start.sh
#
set -e
cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is not installed. Install Node.js and pnpm first: https://pnpm.io/installation"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)…"
  pnpm install
fi

# A local .env is optional — the app has safe defaults — but copy the example if
# one is present and no .env exists yet.
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

URL="http://localhost:5173"

# Open the browser once the web server is actually responding.
(
  for _ in $(seq 1 60); do
    if curl -sf "$URL" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  case "$(uname)" in
    Darwin) open "$URL" ;;
    *) xdg-open "$URL" >/dev/null 2>&1 || true ;;
  esac
) &

echo ""
echo "Starting Maiden — web on $URL and API on http://localhost:3000."
echo "The browser will open automatically. Press Ctrl+C to stop."
echo ""
exec pnpm dev
