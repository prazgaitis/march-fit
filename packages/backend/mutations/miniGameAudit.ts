/**
 * Audit and fix hunt week scores that were calculated with the double-counting bug.
 *
 * The old code computed leaderboard as: initialState.points + getPointsInPeriod(startsAt, endsAt)
 * which double-counted activities between midnight and game activation on the start date.
 * The fix uses getPointsUpToDate(endsAt) for a single source of truth.
 *
 * Usage:
 *   # Audit — show which games have incorrect scores (dry run)
 *   npx convex run mutations/miniGameAudit:audit --prod
 *
 *   # Fix all incorrect scores
 *   npx convex run mutations/miniGameAudit:fix '{}' --prod
 *
 *   # Fix only when the correction benefits the player (increases points)
 *   npx convex run mutations/miniGameAudit:fix '{"favorableOnly": true}' --prod
 */
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getMiniGameLeaderboard, getPointsUpToDate } from "../lib/miniGameCalculations";
import { notDeleted } from "../lib/activityFilters";
import { deleteActivity, insertActivity } from "../lib/activityWrites";

type ParticipantDiff = {
  participantId: string;
  userId: string;
  username: string;
  initialRank: number;
  storedBonusPoints: number;
  correctBonusPoints: number;
  delta: number;
  storedOutcome: { caughtPrey: boolean; wasCaught: boolean };
  correctOutcome: { caughtPrey: boolean; wasCaught: boolean };
};

type GameAudit = {
  miniGameId: string;
  name: string;
  challengeId: string;
  type: string;
  status: string;
  startsAt: number;
  endsAt: number;
  participantCount: number;
  diffs: ParticipantDiff[];
  hasDiscrepancies: boolean;
};

/**
 * Audit all completed hunt week games. Returns a report showing stored vs correct
 * outcomes for each participant.
 */
export const audit = internalQuery({
  args: {},
  handler: async (ctx): Promise<GameAudit[]> => {
    const huntWeekGames = await ctx.db
      .query("miniGames")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "hunt_week"),
          q.eq(q.field("status"), "completed"),
        ),
      )
      .collect();

    const results: GameAudit[] = [];

    for (const game of huntWeekGames) {
      const participants = await ctx.db
        .query("miniGameParticipants")
        .withIndex("miniGameId", (q) => q.eq("miniGameId", game._id))
        .collect();

      // Compute what the correct outcomes would be
      const correctLeaderboard = await getMiniGameLeaderboard(
        ctx,
        game.challengeId,
        game.endsAt,
        participants,
      );

      const rankMap = new Map<string, number>();
      correctLeaderboard.forEach((entry, index) => {
        rankMap.set(entry.userId, index + 1);
      });

      const catchBonus = game.config?.catchBonus ?? 75;
      const caughtPenalty = game.config?.caughtPenalty ?? 25;

      const diffs: ParticipantDiff[] = [];

      for (const p of participants) {
        const currentRank = rankMap.get(p.userId) ?? 999;
        const initialRank = p.initialState?.rank ?? 999;

        let caughtPrey = false;
        let wasCaught = false;

        if (p.preyUserId) {
          const preyCurrentRank = rankMap.get(p.preyUserId) ?? 999;
          caughtPrey = currentRank < preyCurrentRank;
        }

        if (p.hunterUserId) {
          const hunterCurrentRank = rankMap.get(p.hunterUserId) ?? 999;
          wasCaught = hunterCurrentRank < currentRank;
        }

        // #1 player gets catch bonus by holding position
        if (initialRank === 1 && !p.preyUserId && !wasCaught) {
          caughtPrey = true;
        }

        const correctBonusPoints =
          (caughtPrey ? catchBonus : 0) - (wasCaught ? caughtPenalty : 0);

        const storedBonusPoints = p.bonusPoints ?? 0;

        const user = await ctx.db.get(p.userId);

        diffs.push({
          participantId: p._id,
          userId: p.userId,
          username: user?.username ?? "unknown",
          initialRank,
          storedBonusPoints,
          correctBonusPoints,
          delta: correctBonusPoints - storedBonusPoints,
          storedOutcome: {
            caughtPrey: p.outcome?.caughtPrey ?? false,
            wasCaught: p.outcome?.wasCaught ?? false,
          },
          correctOutcome: { caughtPrey, wasCaught },
        });
      }

      results.push({
        miniGameId: game._id,
        name: game.name,
        challengeId: game.challengeId,
        type: game.type,
        status: game.status,
        startsAt: game.startsAt,
        endsAt: game.endsAt,
        participantCount: participants.length,
        diffs,
        hasDiscrepancies: diffs.some((d) => d.delta !== 0),
      });
    }

    return results;
  },
});

/**
 * Fix incorrect hunt week scores. For each participant with a discrepancy:
 * - Deletes the old bonus activity (reversing totalPoints)
 * - Creates a new bonus activity with the correct points
 * - Updates the participant record with correct outcome
 *
 * When favorableOnly is true, only applies fixes that increase a player's bonus
 * (i.e. delta > 0). Players who were over-awarded are left untouched.
 */
export const fix = internalMutation({
  args: {
    favorableOnly: v.optional(v.boolean()),
    miniGameId: v.optional(v.id("miniGames")),
  },
  handler: async (ctx, args) => {
    const favorableOnly = args.favorableOnly ?? false;

    let huntWeekGames;
    if (args.miniGameId) {
      const game = await ctx.db.get(args.miniGameId);
      if (!game) throw new Error("Mini-game not found");
      if (game.type !== "hunt_week") throw new Error("Not a hunt week game");
      if (game.status !== "completed") throw new Error("Game is not completed");
      huntWeekGames = [game];
    } else {
      huntWeekGames = await ctx.db
        .query("miniGames")
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "hunt_week"),
            q.eq(q.field("status"), "completed"),
          ),
        )
        .collect();
    }

    const summary: Array<{
      miniGameId: string;
      gameName: string;
      fixed: number;
      skipped: number;
      details: Array<{
        username: string;
        oldBonus: number;
        newBonus: number;
        delta: number;
        action: string;
      }>;
    }> = [];

    for (const game of huntWeekGames) {
      const participants = await ctx.db
        .query("miniGameParticipants")
        .withIndex("miniGameId", (q) => q.eq("miniGameId", game._id))
        .collect();

      const correctLeaderboard = await getMiniGameLeaderboard(
        ctx,
        game.challengeId,
        game.endsAt,
        participants,
      );

      const rankMap = new Map<string, number>();
      correctLeaderboard.forEach((entry, index) => {
        rankMap.set(entry.userId, index + 1);
      });

      const catchBonus = game.config?.catchBonus ?? 75;
      const caughtPenalty = game.config?.caughtPenalty ?? 25;
      const now = Date.now();

      let fixed = 0;
      let skipped = 0;
      const details: Array<{
        username: string;
        oldBonus: number;
        newBonus: number;
        delta: number;
        action: string;
      }> = [];

      // Find or create bonus activity type
      let bonusActivityType = await ctx.db
        .query("activityTypes")
        .withIndex("challengeId", (q: any) =>
          q.eq("challengeId", game.challengeId),
        )
        .filter((q: any) => q.eq(q.field("name"), "Mini-Game Bonus"))
        .first();

      if (!bonusActivityType) {
        const id = await ctx.db.insert("activityTypes", {
          challengeId: game.challengeId,
          name: "Mini-Game Bonus",
          description: "Bonus points awarded from mini-games",
          scoringConfig: { type: "fixed", basePoints: 0 },
          contributesToStreak: false,
          isNegative: false,
          createdAt: now,
          updatedAt: now,
        });
        bonusActivityType = await ctx.db.get(id);
      }

      for (const p of participants) {
        const currentRank = rankMap.get(p.userId) ?? 999;
        const initialRank = p.initialState?.rank ?? 999;

        let caughtPrey = false;
        let wasCaught = false;

        if (p.preyUserId) {
          const preyCurrentRank = rankMap.get(p.preyUserId) ?? 999;
          caughtPrey = currentRank < preyCurrentRank;
        }

        if (p.hunterUserId) {
          const hunterCurrentRank = rankMap.get(p.hunterUserId) ?? 999;
          wasCaught = hunterCurrentRank < currentRank;
        }

        if (initialRank === 1 && !p.preyUserId && !wasCaught) {
          caughtPrey = true;
        }

        const correctBonusPoints =
          (caughtPrey ? catchBonus : 0) - (wasCaught ? caughtPenalty : 0);

        const storedBonusPoints = p.bonusPoints ?? 0;
        const delta = correctBonusPoints - storedBonusPoints;
        const user = await ctx.db.get(p.userId);
        const username = user?.username ?? "unknown";

        if (delta === 0) {
          details.push({
            username,
            oldBonus: storedBonusPoints,
            newBonus: correctBonusPoints,
            delta: 0,
            action: "correct",
          });
          continue;
        }

        if (favorableOnly && delta < 0) {
          skipped++;
          details.push({
            username,
            oldBonus: storedBonusPoints,
            newBonus: correctBonusPoints,
            delta,
            action: "skipped (unfavorable)",
          });
          continue;
        }

        // Delete old bonus activity and reverse its points
        if (p.bonusActivityId) {
          const oldActivity = await ctx.db.get(p.bonusActivityId);
          if (oldActivity && !oldActivity.deletedAt) {
            const userChallenge = await ctx.db
              .query("userChallenges")
              .withIndex("userChallengeUnique", (q: any) =>
                q.eq("userId", p.userId).eq("challengeId", game.challengeId),
              )
              .first();

            if (userChallenge) {
              await ctx.db.patch(userChallenge._id, {
                totalPoints:
                  userChallenge.totalPoints - oldActivity.pointsEarned,
                updatedAt: now,
              });
            }

            await deleteActivity(ctx, oldActivity._id);
          }
        }

        // Build detailed correction note
        const playerPoints =
          correctLeaderboard.find((e) => e.userId === p.userId)?.totalPoints ?? 0;

        const preyUser = p.preyUserId ? await ctx.db.get(p.preyUserId) : null;
        const hunterUser = p.hunterUserId
          ? await ctx.db.get(p.hunterUserId)
          : null;
        const preyPoints = p.preyUserId
          ? (correctLeaderboard.find((e) => e.userId === p.preyUserId)
              ?.totalPoints ?? 0)
          : null;
        const hunterPoints = p.hunterUserId
          ? (correctLeaderboard.find((e) => e.userId === p.hunterUserId)
              ?.totalPoints ?? 0)
          : null;

        const oldFinalRank = p.outcome?.finalRank ?? p.outcome?.currentRank;

        const lines: string[] = [];
        lines.push(
          `[Score correction] Hunt Week "${game.name}" — recalculated from activity history.`,
        );
        lines.push(
          `Original award: ${storedBonusPoints >= 0 ? "+" : ""}${storedBonusPoints} pts → Corrected: ${correctBonusPoints >= 0 ? "+" : ""}${correctBonusPoints} pts (${delta >= 0 ? "+" : ""}${delta}).`,
        );
        if (oldFinalRank !== undefined && oldFinalRank !== currentRank) {
          lines.push(
            `Rank changed: #${oldFinalRank} → #${currentRank} (of ${participants.length}) after recalculation.`,
          );
        }
        lines.push(
          `${username}: ${playerPoints} pts (rank #${currentRank}, started #${initialRank}).`,
        );
        if (p.preyUserId && preyUser) {
          const preyRank = rankMap.get(p.preyUserId) ?? 999;
          lines.push(
            `Prey: ${preyUser.username ?? "unknown"} at ${preyPoints} pts (rank #${preyRank}) — ${caughtPrey ? "caught ✓" : "not caught"}.`,
          );
        }
        if (p.hunterUserId && hunterUser) {
          const hunterRank = rankMap.get(p.hunterUserId) ?? 999;
          lines.push(
            `Hunter: ${hunterUser.username ?? "unknown"} at ${hunterPoints} pts (rank #${hunterRank}) — ${wasCaught ? "was caught ✗" : "escaped ✓"}.`,
          );
        }
        lines.push(
          `Bug: leaderboard was double-counting activities logged before game start on the start date.`,
        );

        const description = lines.join("\n");

        // Create new bonus activity with correct points (if non-zero)
        let newBonusActivityId: Id<"activities"> | undefined;
        if (correctBonusPoints !== 0) {
          newBonusActivityId = await insertActivity(ctx, {
            userId: p.userId,
            challengeId: game.challengeId,
            activityTypeId: bonusActivityType!._id,
            loggedDate: now,
            pointsEarned: correctBonusPoints,
            notes: description,
            flagged: false,
            adminCommentVisibility: "internal",
            resolutionStatus: "resolved",
            source: "mini_game",
            externalId: `mini_game_${game._id}_${p.userId}`,
            externalData: {
              miniGameId: game._id,
              miniGameType: game.type,
              miniGameName: game.name,
              correctedFrom: storedBonusPoints,
              correctedRank: currentRank,
              previousRank: oldFinalRank,
            },
            createdAt: now,
            updatedAt: now,
          });

          // Update totalPoints
          const userChallenge = await ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q: any) =>
              q.eq("userId", p.userId).eq("challengeId", game.challengeId),
            )
            .first();

          if (userChallenge) {
            await ctx.db.patch(userChallenge._id, {
              totalPoints: userChallenge.totalPoints + correctBonusPoints,
              updatedAt: now,
            });
          }
        }

        // Update participant record
        await ctx.db.patch(p._id, {
          bonusPoints: correctBonusPoints,
          outcome: {
            ...p.outcome,
            caughtPrey,
            wasCaught,
            correctedAt: now,
            previousBonusPoints: storedBonusPoints,
          },
          bonusActivityId: newBonusActivityId,
        });

        fixed++;
        details.push({
          username,
          oldBonus: storedBonusPoints,
          newBonus: correctBonusPoints,
          delta,
          action: "fixed",
        });
      }

      summary.push({
        miniGameId: game._id,
        gameName: game.name,
        fixed,
        skipped,
        details,
      });
    }

    return summary;
  },
});
