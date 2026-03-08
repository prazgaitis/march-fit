/**
 * One-off script: Update Partner Week endsAt to March 15 (inclusive).
 *
 * Usage (after this code is deployed):
 *   CONVEX_SELF_HOSTED_URL="https://canny-labrador-252.convex.cloud" \
 *   CONVEX_SELF_HOSTED_ADMIN_KEY="$(grep CONVEX_DEPLOY_KEY ../../.env.production | cut -d= -f2-)" \
 *   pnpm exec npx convex run mutations/apiMutations:updateMiniGameForUser \
 *     '{"userId": "m57db2e3wyv0k2c4jfv02vb9xx7wa9kj", "miniGameId": "mn73q4rd3ynd2dbzzttgn8wwzs8272an", "endsAt": 1773532800000}'
 *
 * March 15 00:00 UTC = 1773532800000
 * This extends Partner Week from March 8-14 to March 8-15 (both inclusive).
 */
