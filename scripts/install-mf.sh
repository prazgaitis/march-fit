#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${HOME}/.local/bin"
TARGET="${TARGET_DIR}/mf"

mkdir -p "${TARGET_DIR}"
ln -sf "${ROOT_DIR}/mf" "${TARGET}"

echo "Installed mf -> ${TARGET}"
echo "Ensure ${TARGET_DIR} is in your PATH."
