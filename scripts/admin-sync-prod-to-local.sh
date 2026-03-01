#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."

ENV_FILE="${ROOT_DIR}/.env.production"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_PATH="${ROOT_DIR}/tmp/prod-latest-${TIMESTAMP}.zip"
ASSUME_YES=0

print_help() {
  cat <<'EOF'
Usage: bash scripts/admin-sync-prod-to-local.sh [options]

Exports latest data from production Convex and imports it into local self-hosted Convex.

Options:
  -y, --yes           Skip confirmation prompt
  -o, --out PATH      Export file path (default: ./tmp/prod-latest-<timestamp>.zip)
  -h, --help          Show this help

Examples:
  bash scripts/admin-sync-prod-to-local.sh
  bash scripts/admin-sync-prod-to-local.sh --yes
  bash scripts/admin-sync-prod-to-local.sh --out /tmp/prod-latest.zip --yes
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      ASSUME_YES=1
      shift
      ;;
    -o|--out)
      if [[ $# -lt 2 ]]; then
        echo "Error: --out requires a path argument."
        exit 1
      fi
      OUT_PATH="$2"
      shift 2
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Error: Unknown argument: $1"
      print_help
      exit 1
      ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Error: Missing ${ENV_FILE}"
  exit 1
fi

mkdir -p "$(dirname "${OUT_PATH}")"

if [[ "${ASSUME_YES}" -ne 1 ]]; then
  echo "WARNING: This will REPLACE ALL local Convex data with a production snapshot."
  echo "  Prod env file: ${ENV_FILE}"
  echo "  Export path:   ${OUT_PATH}"
  echo
  read -r -p "Continue? [y/N] " reply
  case "${reply}" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Aborted."
      exit 0
      ;;
  esac
fi

echo "1/2 Exporting production data to ${OUT_PATH} ..."
pnpm -F backend exec npx convex export \
  --env-file "${ENV_FILE}" \
  --path "${OUT_PATH}"

echo "2/2 Importing snapshot into local self-hosted Convex ..."
bash "${ROOT_DIR}/scripts/convex.sh" import "${OUT_PATH}" --replace-all -y

echo "Done."
echo "Snapshot file: ${OUT_PATH}"
