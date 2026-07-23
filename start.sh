#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
export NEXT_TELEMETRY_DISABLED=1

if ! command -v node >/dev/null 2>&1; then
  echo "Instalează mai întâi Node.js 22 LTS de la https://nodejs.org/"
  exit 1
fi

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v npx >/dev/null 2>&1; then
    npx --yes pnpm@11.3.0 "$@"
  else
    echo "Instalarea Node.js nu include npm. Reinstalează Node.js de la https://nodejs.org/"
    exit 1
  fi
}

if [ "${1:-}" = "--check" ]; then
  run_pnpm --version
  echo "Lansatorul este pregătit."
  exit 0
fi

run_pnpm install --frozen-lockfile
run_pnpm assets
run_pnpm local:prepare

if command -v open >/dev/null 2>&1; then
  (sleep 3 && open http://localhost:3000) >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 3 && xdg-open http://localhost:3000) >/dev/null 2>&1 &
fi

run_pnpm start
