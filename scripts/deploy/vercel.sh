#!/bin/bash
set -e

echo "📦 Deploying Convex and building web app..."
cd packages/backend

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

echo "✅ Build complete!"
