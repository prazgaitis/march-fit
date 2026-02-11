#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."

load_env() {
  local file="$1"
  if [ -f "$file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$file"
    set +a
  fi
}

load_env "$ROOT_DIR/.env"
load_env "$ROOT_DIR/.env.local"

if [ -z "${CONVEX_SELF_HOSTED_URL:-}" ] || [ -z "${CONVEX_SELF_HOSTED_ADMIN_KEY:-}" ]; then
  echo "Missing CONVEX_SELF_HOSTED_URL or CONVEX_SELF_HOSTED_ADMIN_KEY in .env.local"
  echo "Run: pnpm convex:start && pnpm convex:admin-key"
  exit 1
fi

cd "$ROOT_DIR"
exec pnpm -F backend exec npx convex "$@"
