#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/create-challenge.sh <json-file>           # local dev
#   ./scripts/create-challenge.sh <json-file> --prod     # production
#
# The JSON file can include activity types inline (as "activityTypes" array)
# or reference a shared file (as "activityTypesFile": "activity-types.json").
# Relative paths in activityTypesFile are resolved from the JSON file's directory.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."

PROD=false
JSON_FILE=""

for arg in "$@"; do
  case "$arg" in
    --prod) PROD=true ;;
    *) JSON_FILE="$arg" ;;
  esac
done

if [ -z "$JSON_FILE" ]; then
  echo "Usage: $0 <json-file> [--prod]"
  echo ""
  echo "Examples:"
  echo "  $0 scripts/challenge-data/march-2026.json"
  echo "  $0 scripts/challenge-data/february-2026.json --prod"
  exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
  echo "Error: File not found: $JSON_FILE"
  exit 1
fi

JSON_DIR="$(cd "$(dirname "$JSON_FILE")" && pwd)"

# Read the challenge config JSON.
# If it has "activityTypesFile", load that file and merge it in as "activityTypes".
CONFIG=$(python3 -c "
import json, sys, os

config = json.load(open(sys.argv[1]))
if 'activityTypesFile' in config:
    at_path = os.path.join(sys.argv[2], config['activityTypesFile'])
    config['activityTypes'] = json.load(open(at_path))
    del config['activityTypesFile']

print(json.dumps(config))
" "$JSON_FILE" "$JSON_DIR")

ARGS="{\"config\": $CONFIG}"

if [ "$PROD" = true ]; then
  echo "Creating challenge on PRODUCTION..."
  cd "$ROOT_DIR"
  pnpm -F backend exec npx convex run actions/createChallengeFromConfig:createChallengeFromConfig "$ARGS" --prod
else
  echo "Creating challenge on LOCAL dev..."
  bash "$SCRIPT_DIR/convex.sh" run actions/createChallengeFromConfig:createChallengeFromConfig "$ARGS"
fi
