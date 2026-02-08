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

if [ -z "${NEXT_PUBLIC_CONVEX_URL:-}" ] && [ -n "${CONVEX_SELF_HOSTED_URL:-}" ]; then
  export NEXT_PUBLIC_CONVEX_URL="$CONVEX_SELF_HOSTED_URL"
fi

if [ -z "${NEXT_PUBLIC_CONVEX_SITE_URL:-}" ]; then
  export NEXT_PUBLIC_CONVEX_SITE_URL="http://127.0.0.1:3211"
fi

if [ -z "${CONVEX_SELF_HOSTED_URL:-}" ] || [ -z "${CONVEX_SELF_HOSTED_ADMIN_KEY:-}" ]; then
  echo "Missing CONVEX_SELF_HOSTED_URL or CONVEX_SELF_HOSTED_ADMIN_KEY in .env.local"
  echo "Run: pnpm convex:start && pnpm convex:admin-key"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or not reachable."
  echo "Start Docker or OrbStack, then re-run: pnpm dev"
  exit 1
fi

docker compose -f "$ROOT_DIR/docker-compose.convex.yml" up -d

echo "Waiting for local Convex backend..."
for i in {1..30}; do
  if curl -fsS "${CONVEX_SELF_HOSTED_URL}/version" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "${CONVEX_SELF_HOSTED_URL}/version" >/dev/null 2>&1; then
  echo "Local Convex backend did not become ready at ${CONVEX_SELF_HOSTED_URL}"
  exit 1
fi

if ! bash "$SCRIPT_DIR/sync-backend-env.sh"; then
  echo "Failed to sync Convex env vars. This usually means CONVEX_SELF_HOSTED_ADMIN_KEY is missing or invalid."
  echo "Run: pnpm convex:admin-key (copy value into .env.local as CONVEX_SELF_HOSTED_ADMIN_KEY), then retry."
  exit 1
fi

exec cross-env FORCE_COLOR=1 turbo dev --parallel
