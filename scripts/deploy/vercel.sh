#!/bin/bash
set -e

# Vercel runs this from apps/web — navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."
cd "$ROOT_DIR"

echo "📦 Deploying Convex and building web app..."
cd packages/backend

# =============================================================================
# BUNDLE VERSION
# =============================================================================
# Stamp a monotonic version into the Next.js build so the client can detect
# stale bundles via the Convex real-time appConfig subscription.
# Uses epoch seconds — always increases and is trivially comparable.
export NEXT_PUBLIC_BUNDLE_VERSION="$(date +%s)"
echo "🔖 Bundle version: $NEXT_PUBLIC_BUNDLE_VERSION"

npx convex deploy \
  --cmd 'cd ../../apps/web && npx next build' \
  --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL

# =============================================================================
# DATA MIGRATIONS
# =============================================================================
# Uses @convex-dev/migrations component for state-tracked migrations.
# Migrations are idempotent — completed ones are automatically skipped.
#
# HOW TO ADD A NEW MIGRATION:
# 1. Define the migration in packages/backend/migrations.ts
# 2. Add it to the migrationsList array in the runAll action
# 3. Deploy and it runs automatically
#
# See: https://www.convex.dev/components/migrations
# =============================================================================
echo "🔄 Running Convex migrations..."
npx convex run migrations:runAll || echo "⚠️  Migrations completed with warnings (check logs)"

# =============================================================================
# BUNDLE VERSION BUMP
# =============================================================================
# Signal all connected clients that a new bundle is available.
# Uses the same epoch-seconds value baked into the build so client and server
# versions match exactly.
echo "🔖 Bumping bundle version to $NEXT_PUBLIC_BUNDLE_VERSION..."
npx convex run mutations/appConfig:setBundleVersion "{\"version\": $NEXT_PUBLIC_BUNDLE_VERSION}" \
  || echo "⚠️  Bundle version bump failed (check logs)"

echo "✅ Build complete!"
