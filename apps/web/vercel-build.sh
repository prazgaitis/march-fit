#!/usr/bin/env bash
set -euo pipefail

cd ../../packages/backend

npx convex deploy \
  --cmd "export NEXT_PUBLIC_CONVEX_URL=\"$NEXT_PUBLIC_CONVEX_URL\"; export NEXT_PUBLIC_CONVEX_SITE_URL=$(printf %s \"$NEXT_PUBLIC_CONVEX_URL\" | sed 's/\\.convex\\.cloud/.convex.site/'); cd ../../apps/web && npx next build" \
  --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
