import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * One-off fix: Remove duplicate half-marathon bonus from 3 marathon activities.
 * Each was overpaid 25 points due to stacking both half + full marathon thresholds.
 *
 * Usage (after deploy):
 *   CONVEX_SELF_HOSTED_URL="https://canny-labrador-252.convex.cloud" \
 *   CONVEX_SELF_HOSTED_ADMIN_KEY="$(grep CONVEX_DEPLOY_KEY ../../.env.production | cut -d= -f2-)" \
 *   pnpm exec npx convex run mutations/fixDoubleBonuses:fix '{}'
 */
export const fix = internalMutation({
  args: {},
  handler: async (ctx) => {
    const affected: Array<{
      activityId: Id<"activities">;
      userId: Id<"users">;
    }> = [
      {
        activityId:
          "j5741ha2ztzpg2m6g8j04355z582h9ce" as Id<"activities">,
        userId: "m57f29fgpffzh9thbg3mzhzhsx8248he" as Id<"users">,
      },
      {
        activityId:
          "j579bcx6t9xekd4sbs1xpprxqh82exhc" as Id<"activities">,
        userId: "m57dq5em216258a1byqksreh7182af1b" as Id<"users">,
      },
      {
        activityId:
          "j57f2nvwtx1mxxebtftnpm0j4982htq2" as Id<"activities">,
        userId: "m578vqfqtxe26kypvkxejmp59s820qx1" as Id<"users">,
      },
    ];

    const overpaid = 25;
    const challengeId =
      "js7039jtvp6z79d0r37h1x70qn8105zw" as Id<"challenges">;
    const results = [];

    for (const { activityId, userId } of affected) {
      const activity = await ctx.db.get(activityId);
      if (!activity) {
        results.push({ activityId, status: "not_found" });
        continue;
      }

      // Remove the half-marathon bonus, keep only the marathon bonus
      const triggeredBonuses = (activity.triggeredBonuses ?? []).filter(
        (b) => b.description !== "Half Marathon bonus"
      );

      await ctx.db.patch(activityId, {
        pointsEarned: activity.pointsEarned - overpaid,
        triggeredBonuses,
        updatedAt: Date.now(),
      });

      // Update user's total points
      const userChallenge = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q) =>
          q.eq("userId", userId).eq("challengeId", challengeId)
        )
        .first();

      if (userChallenge) {
        await ctx.db.patch(userChallenge._id, {
          totalPoints: userChallenge.totalPoints - overpaid,
          updatedAt: Date.now(),
        });
      }

      results.push({
        activityId,
        userId,
        newPoints: activity.pointsEarned - overpaid,
        status: "fixed",
      });
    }

    return results;
  },
});
