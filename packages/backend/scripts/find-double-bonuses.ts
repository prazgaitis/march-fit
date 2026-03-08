/**
 * One-off: Find activities with stacked bonus thresholds on the same metric.
 *
 * Usage:
 *   CONVEX_SELF_HOSTED_URL="https://canny-labrador-252.convex.cloud" \
 *   CONVEX_SELF_HOSTED_ADMIN_KEY="$(grep CONVEX_DEPLOY_KEY ../../.env.production | cut -d= -f2-)" \
 *   pnpm exec npx convex run queries/activities:listByChallenge \
 *     '{"challengeId": "js7039jtvp6z79d0r37h1x70qn8105zw", "limit": 10000}'
 *
 * Then pipe through: | python3 -c "..." to filter for duplicate metrics in triggeredBonuses
 */
