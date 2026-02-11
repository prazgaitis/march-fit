#!/usr/bin/env bash
set -euo pipefail

cd ../../packages/backend

npx convex deploy \
  --cmd "export CONVEX_BUILD_URL=\"\\${NEXT_PUBLIC_CONVEX_URL:-\\$CONVEX_URL}\"; if [ -z \"\\$CONVEX_BUILD_URL\" ]; then echo 'Missing Convex URL in --cmd env' >&2; exit 1; fi; export NEXT_PUBLIC_CONVEX_URL=\"\\$CONVEX_BUILD_URL\"; export NEXT_PUBLIC_CONVEX_SITE_URL=$(printf %s \"\\$CONVEX_BUILD_URL\" | sed 's/\\.convex\\.cloud/.convex.site/'); cd ../../apps/web && npx next build" \
  --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
