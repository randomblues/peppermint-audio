#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-${PORT:-3000}}"
if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
  printf 'Invalid PORT: %s\n' "$PORT" >&2
  exit 2
fi
PORT=$((10#$PORT))
if (( PORT < 1 || PORT > 65535 )); then
  printf 'Invalid PORT: %s\n' "$PORT" >&2
  exit 2
fi

if ! command -v lsof >/dev/null 2>&1; then
  printf 'Cannot check port %s: lsof is required.\n' "$PORT" >&2
  exit 2
fi

if ! LISTENING_PIDS="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)"; then
  printf 'No server is listening on port %s.\n' "$PORT"
  exit 0
fi

for PID in $LISTENING_PIDS; do
  if [[ ! "$PID" =~ ^[0-9]+$ ]]; then
    printf 'Unexpected process ID from lsof: %s\n' "$PID" >&2
    exit 2
  fi
  kill "$PID"
done

printf 'Sent termination signal to listener(s) on port %s (PID(s): %s).\n' "$PORT" "$LISTENING_PIDS"
