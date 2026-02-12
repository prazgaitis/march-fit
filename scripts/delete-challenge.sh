#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/delete-challenge.sh <challenge-id>           # local dev
#   ./scripts/delete-challenge.sh <challenge-id> --prod     # production

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."

PROD=false
CHALLENGE_ID=""

for arg in "$@"; do
  case "$arg" in
    --prod) PROD=true ;;
    *) CHALLENGE_ID="$arg" ;;
  esac
done

if [ -z "$CHALLENGE_ID" ]; then
  echo "Usage: $0 <challenge-id> [--prod]"
  echo ""
  echo "Examples:"
  echo "  $0 k57abc123def456"
  echo "  $0 k57abc123def456 --prod"
  exit 1
fi

ARGS="{\"challengeId\": \"$CHALLENGE_ID\"}"

if [ "$PROD" = true ]; then
  echo "Deleting challenge $CHALLENGE_ID on PRODUCTION..."
  cd "$ROOT_DIR"
  pnpm -F backend exec npx convex run mutations/admin:deleteChallenge "$ARGS" --prod
else
  echo "Deleting challenge $CHALLENGE_ID on LOCAL dev..."
  bash "$SCRIPT_DIR/convex.sh" run mutations/admin:deleteChallenge "$ARGS"
fi
