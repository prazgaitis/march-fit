#!/usr/bin/env bash
# Pushes required env vars from root .env.local to the local Convex deployment
# using `convex env set`, so secrets live on the deployment (not in env files).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
ROOT_ENV="${ROOT_DIR}/.env.local"
BACKEND_DIR="${ROOT_DIR}/packages/backend"

if [ ! -f "$ROOT_ENV" ]; then
  echo "Warning: $ROOT_ENV not found, skipping backend env sync"
  exit 0
fi

# Env vars the Convex backend needs from the root .env.local
REQUIRED_VARS=(
  SITE_URL
  BETTER_AUTH_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  STRAVA_CLIENT_SECRET
  NEXT_PUBLIC_STRAVA_CLIENT_ID
  STRAVA_VERIFY_TOKEN
  STRIPE_ENCRYPTION_KEY
)

added=0
for var in "${REQUIRED_VARS[@]}"; do
  # Extract value from root env, strip surrounding quotes
  line=$(grep "^${var}=" "$ROOT_ENV" 2>/dev/null | head -1 || true)
  if [ -n "$line" ]; then
    val="${line#*=}"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    (cd "$BACKEND_DIR" && npx convex env set "$var" "$val")
    added=$((added + 1))
  fi
done

if [ "$added" -gt 0 ]; then
  echo "Pushed $added env var(s) to Convex deployment"
fi
