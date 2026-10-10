#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PORT="${PORT:-3000}"
if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
  printf 'Invalid PORT: %s\n' "$PORT" >&2
  exit 2
fi
PORT=$((10#$PORT))
export PORT
if (( PORT < 1 || PORT > 65535 )); then
  printf 'Invalid PORT: %s\n' "$PORT" >&2
  exit 2
fi

if ! command -v lsof >/dev/null 2>&1; then
  printf 'Cannot check port %s: lsof is required.\n' "$PORT" >&2
  exit 2
fi

if LISTENING_PIDS="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)"; then
  printf 'Port %s already has a listener (PID(s): %s); not starting another server.\n' "$PORT" "$LISTENING_PIDS" >&2
  exit 1
fi

cd "$PROJECT_ROOT"
LOG_FILE="/tmp/dev-${PORT}.log"
nohup npm run dev -- --port "$PORT" >"$LOG_FILE" 2>&1 </dev/null &

printf 'Started development server on port %s (launcher PID %s).\n' "$PORT" "$!"
printf 'Log file: %s\n' "$LOG_FILE"
