#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

LOCAL_STRIPE_WEBHOOKS=true PORT="$PORT" "$SCRIPT_DIR/dev-detached.sh"
printf 'Stripe test-mode forwarding is enabled for the local webhook route; see /tmp/dev-%s.log.\n' "$PORT"
