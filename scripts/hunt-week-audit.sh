#!/usr/bin/env bash
set -euo pipefail

# Audit and fix hunt week scores affected by the double-counting bug.
#
# Usage:
#   ./scripts/hunt-week-audit.sh                    # Audit (dry run) on local
#   ./scripts/hunt-week-audit.sh --prod             # Audit on production
#   ./scripts/hunt-week-audit.sh --fix              # Fix all on local
#   ./scripts/hunt-week-audit.sh --fix --prod       # Fix all on production
#   ./scripts/hunt-week-audit.sh --fix-favorable    # Fix only increases on local
#   ./scripts/hunt-week-audit.sh --fix-favorable --prod  # Fix only increases on prod

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."

PROD=false
MODE="audit"

for arg in "$@"; do
  case "$arg" in
    --prod) PROD=true ;;
    --fix) MODE="fix" ;;
    --fix-favorable) MODE="fix-favorable" ;;
    --help|-h)
      echo "Usage: $0 [--fix | --fix-favorable] [--prod]"
      echo ""
      echo "Modes:"
      echo "  (default)         Audit — show discrepancies without changing anything"
      echo "  --fix             Fix all incorrect scores (increases and decreases)"
      echo "  --fix-favorable   Fix only when it benefits the player (increases points)"
      echo ""
      echo "Environment:"
      echo "  --prod            Run against production (default: local dev)"
      exit 0
      ;;
  esac
done

run_convex() {
  if [ "$PROD" = true ]; then
    cd "$ROOT_DIR"
    pnpm -F backend exec npx convex run "$@" --prod
  else
    bash "$SCRIPT_DIR/convex.sh" run "$@"
  fi
}

ENV_LABEL="LOCAL"
[ "$PROD" = true ] && ENV_LABEL="PRODUCTION"

case "$MODE" in
  audit)
    echo "=== Hunt Week Audit ($ENV_LABEL) ==="
    echo ""
    run_convex "mutations/miniGameAudit:audit" '{}'
    ;;
  fix)
    echo "=== Hunt Week Fix — ALL ($ENV_LABEL) ==="
    echo ""
    read -rp "This will modify scores on $ENV_LABEL. Continue? [y/N] " confirm
    if [[ "$confirm" != [yY] ]]; then
      echo "Aborted."
      exit 0
    fi
    run_convex "mutations/miniGameAudit:fix" '{}'
    ;;
  fix-favorable)
    echo "=== Hunt Week Fix — FAVORABLE ONLY ($ENV_LABEL) ==="
    echo ""
    read -rp "This will increase scores where players were under-awarded on $ENV_LABEL. Continue? [y/N] " confirm
    if [[ "$confirm" != [yY] ]]; then
      echo "Aborted."
      exit 0
    fi
    run_convex "mutations/miniGameAudit:fix" '{"favorableOnly": true}'
    ;;
esac
