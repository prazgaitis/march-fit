import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { notDeleted } from "../lib/activityFilters";
import { aggregateDailyStreakPoints, computeStreak } from "../lib/streak";
import { reportLatencyIfExceeded } from "../lib/latencyMonitoring";
import type { Id } from "../_generated/dataModel";

interface UserScoreDiff {
  userId: string;
  stored: { totalPoints: number; streakBonusPoints: number; currentStreak: number };
  expected: { totalPoints: number; streakBonusPoints: number; currentStreak: number };
  activityPointsTotal: number;
  fixed: boolean;
}

/**
 * Recompute a user's totalPoints from scratch and compare with the stored value.
 * If `fix` is true, patch the participation record to match the recomputed value.
 * When `userId` is omitted, verifies all participants in the challenge.
 */
export const verifyUserScore = internalMutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.optional(v.id("users")),
    fix: v.boolean(),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    try {
      const challenge = await ctx.db.get(args.challengeId);
      if (!challenge) throw new Error("Challenge not found");

      // Determine which participations to verify
      let participations;
      if (args.userId) {
        const p = await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q: any) =>
            q.eq("userId", args.userId).eq("challengeId", args.challengeId)
          )
          .first();
        participations = p ? [p] : [];
      } else {
        participations = await ctx.db
          .query("userChallenges")
          .withIndex("challengeId", (q: any) =>
            q.eq("challengeId", args.challengeId)
          )
          .collect();
      }

      const diffs: UserScoreDiff[] = [];

      for (const participation of participations) {
        // Fetch all non-deleted activities for this user+challenge
        const activities = await ctx.db
          .query("activities")
          .withIndex("by_user_challenge_date", (q: any) =>
            q
              .eq("userId", participation.userId)
              .eq("challengeId", args.challengeId)
          )
          .filter(notDeleted)
          .collect();

        // Sum activity points
        const activityPointsTotal = activities.reduce(
          (sum, a) => sum + (a.pointsEarned as number),
          0
        );

        // Build contributesToStreak lookup
        const activityTypeIds = Array.from(
          new Set(activities.map((a) => a.activityTypeId))
        ) as Id<"activityTypes">[];
        const activityTypes = await Promise.all(
          activityTypeIds.map((id) => ctx.db.get(id))
        );
        const contributesMap = new Map<string, boolean>();
        for (let i = 0; i < activityTypeIds.length; i++) {
          const at = activityTypes[i];
          if (at) contributesMap.set(activityTypeIds[i], at.contributesToStreak);
        }

        // Recompute streak
        const dailyPoints = aggregateDailyStreakPoints(
          activities as { loggedDate: number; pointsEarned: number; activityTypeId: string }[],
          (id) => contributesMap.get(id) ?? false
        );
        const streakResult = computeStreak(
          dailyPoints,
          challenge.streakMinPoints
        );

        const expectedStreakBonus = streakResult.totalStreakBonus;
        const expectedTotal = activityPointsTotal + expectedStreakBonus;
        const expectedCurrentStreak = streakResult.currentStreak;

        const storedTotal = participation.totalPoints;
        const storedStreakBonus = (participation as any).streakBonusPoints ?? 0;
        const storedCurrentStreak = participation.currentStreak;

        const hasMismatch =
          storedTotal !== expectedTotal ||
          storedStreakBonus !== expectedStreakBonus ||
          storedCurrentStreak !== expectedCurrentStreak;

        if (hasMismatch) {
          const diff: UserScoreDiff = {
            userId: participation.userId,
            stored: {
              totalPoints: storedTotal,
              streakBonusPoints: storedStreakBonus,
              currentStreak: storedCurrentStreak,
            },
            expected: {
              totalPoints: expectedTotal,
              streakBonusPoints: expectedStreakBonus,
              currentStreak: expectedCurrentStreak,
            },
            activityPointsTotal,
            fixed: false,
          };

          if (args.fix) {
            await ctx.db.patch(participation._id, {
              totalPoints: expectedTotal,
              streakBonusPoints: expectedStreakBonus,
              currentStreak: expectedCurrentStreak,
              lastStreakDay: streakResult.lastStreakDay,
              updatedAt: Date.now(),
            });
            diff.fixed = true;
          }

          diffs.push(diff);
        }
      }

      return {
        participationsChecked: participations.length,
        mismatches: diffs.length,
        diffs,
      };
    } finally {
      reportLatencyIfExceeded({
        operation: "mutations.verifyScores.verifyUserScore",
        startedAt,
        challengeId: String(args.challengeId),
        userId: args.userId ? String(args.userId) : undefined,
      });
    }
  },
});
