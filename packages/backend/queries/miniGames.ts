import { query } from "../_generated/server";
import { v } from "convex/values";
import { notDeleted } from "../lib/activityFilters";

/**
 * List all mini-games for a challenge
 */
export const list = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const miniGames = await ctx.db
      .query("miniGames")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Sort by startsAt descending (most recent first)
    miniGames.sort((a, b) => b.startsAt - a.startsAt);

    // Get participant counts
    const result = await Promise.all(
      miniGames.map(async (game) => {
        const participants = await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameId", (q) => q.eq("miniGameId", game._id))
          .collect();

        return {
          ...game,
          id: game._id,
          participantCount: participants.length,
        };
      }),
    );

    return result;
  },
});

/**
 * Get a mini-game by ID with all participants
 */
export const getById = query({
  args: {
    miniGameId: v.id("miniGames"),
  },
  handler: async (ctx, args) => {
    const miniGame = await ctx.db.get(args.miniGameId);
    if (!miniGame) {
      return null;
    }

    // Get all participants with user data
    const participants = await ctx.db
      .query("miniGameParticipants")
      .withIndex("miniGameId", (q) => q.eq("miniGameId", args.miniGameId))
      .collect();

    const participantsWithUsers = await Promise.all(
      participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);

        // Get partner/prey/hunter user data if applicable
        let partnerUser = null;
        let preyUser = null;
        let hunterUser = null;

        if (participant.partnerUserId) {
          partnerUser = await ctx.db.get(participant.partnerUserId);
        }
        if (participant.preyUserId) {
          preyUser = await ctx.db.get(participant.preyUserId);
        }
        if (participant.hunterUserId) {
          hunterUser = await ctx.db.get(participant.hunterUserId);
        }

        return {
          ...participant,
          id: participant._id,
          user: user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null,
          partnerUser: partnerUser
            ? {
                id: partnerUser._id,
                username: partnerUser.username,
                name: partnerUser.name,
                avatarUrl: partnerUser.avatarUrl,
              }
            : null,
          preyUser: preyUser
            ? {
                id: preyUser._id,
                username: preyUser.username,
                name: preyUser.name,
                avatarUrl: preyUser.avatarUrl,
              }
            : null,
          hunterUser: hunterUser
            ? {
                id: hunterUser._id,
                username: hunterUser.username,
                name: hunterUser.name,
                avatarUrl: hunterUser.avatarUrl,
              }
            : null,
        };
      }),
    );

    // Sort participants by initial rank
    participantsWithUsers.sort((a, b) => {
      const rankA = (a.initialState as { rank?: number })?.rank ?? 999;
      const rankB = (b.initialState as { rank?: number })?.rank ?? 999;
      return rankA - rankB;
    });

    return {
      ...miniGame,
      id: miniGame._id,
      participants: participantsWithUsers.filter((p) => p.user !== null),
    };
  },
});

/**
 * Get active mini-games for a challenge
 */
export const getActive = query({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const miniGames = await ctx.db
      .query("miniGames")
      .withIndex("challengeStatus", (q) =>
        q.eq("challengeId", args.challengeId).eq("status", "active"),
      )
      .collect();

    return miniGames.map((game) => ({
      ...game,
      id: game._id,
    }));
  },
});

/**
 * Get user's mini-game status for active games in a challenge
 * Returns the user's participation data for each active mini-game
 */
export const getUserStatus = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get active mini-games
    const activeMiniGames = await ctx.db
      .query("miniGames")
      .withIndex("challengeStatus", (q) =>
        q.eq("challengeId", args.challengeId).eq("status", "active"),
      )
      .collect();

    if (activeMiniGames.length === 0) {
      return [];
    }

    // Get user's participation in each active game
    const result = await Promise.all(
      activeMiniGames.map(async (game) => {
        const participation = await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameUser", (q) =>
            q.eq("miniGameId", game._id).eq("userId", args.userId),
          )
          .first();

        if (!participation) {
          return null;
        }

        // Get related user data based on game type
        let partnerUser = null;
        let preyUser = null;
        let hunterUser = null;
        let partnerCurrentPoints = null;
        let preyCurrentPoints = null;
        let hunterCurrentPoints = null;
        let userCurrentPoints = null;

        // Get current leaderboard positions for live updates
        const challenge = await ctx.db.get(args.challengeId);
        if (challenge) {
          const userChallenge = await ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q) =>
              q.eq("userId", args.userId).eq("challengeId", args.challengeId),
            )
            .first();
          userCurrentPoints = userChallenge?.totalPoints ?? 0;
        }

        if (participation.partnerUserId) {
          partnerUser = await ctx.db.get(participation.partnerUserId);
          const partnerChallenge = await ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q) =>
              q
                .eq("userId", participation.partnerUserId!)
                .eq("challengeId", args.challengeId),
            )
            .first();
          partnerCurrentPoints = partnerChallenge?.totalPoints ?? 0;
        }

        if (participation.preyUserId) {
          preyUser = await ctx.db.get(participation.preyUserId);
          const preyChallenge = await ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q) =>
              q
                .eq("userId", participation.preyUserId!)
                .eq("challengeId", args.challengeId),
            )
            .first();
          preyCurrentPoints = preyChallenge?.totalPoints ?? 0;
        }

        if (participation.hunterUserId) {
          hunterUser = await ctx.db.get(participation.hunterUserId);
          const hunterChallenge = await ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q) =>
              q
                .eq("userId", participation.hunterUserId!)
                .eq("challengeId", args.challengeId),
            )
            .first();
          hunterCurrentPoints = hunterChallenge?.totalPoints ?? 0;
        }

        // Calculate current week max for PR week
        let currentWeekMax = 0;
        if (game.type === "pr_week") {
          const activities = await ctx.db
            .query("activities")
            .withIndex("by_user_challenge_date", (q) =>
              q.eq("userId", args.userId).eq("challengeId", args.challengeId),
            )
            .filter(notDeleted)
            .collect();

          // Group by day and find max within game period
          const dailyPoints: Record<string, number> = {};
          for (const activity of activities) {
            if (activity.loggedDate < game.startsAt || activity.loggedDate > game.endsAt)
              continue;
            const dateStr = new Date(activity.loggedDate).toISOString().split("T")[0];
            dailyPoints[dateStr] = (dailyPoints[dateStr] || 0) + activity.pointsEarned;
          }
          const values = Object.values(dailyPoints);
          currentWeekMax = values.length > 0 ? Math.max(...values) : 0;
        }

        // Get partner's initial state for partner week bonus calculation
        let partnerInitialPoints = 0;
        if (game.type === "partner_week" && participation.partnerUserId) {
          const partnerParticipation = await ctx.db
            .query("miniGameParticipants")
            .withIndex("miniGameUser", (q) =>
              q.eq("miniGameId", game._id).eq("userId", participation.partnerUserId!),
            )
            .first();
          partnerInitialPoints =
            (partnerParticipation?.initialState as { points?: number })?.points ?? 0;
        }

        return {
          miniGame: {
            id: game._id,
            type: game.type,
            name: game.name,
            startsAt: game.startsAt,
            endsAt: game.endsAt,
            config: game.config,
          },
          participation: {
            id: participation._id,
            initialState: participation.initialState,
            partnerUser: partnerUser
              ? {
                  id: partnerUser._id,
                  username: partnerUser.username,
                  name: partnerUser.name,
                  avatarUrl: partnerUser.avatarUrl,
                }
              : null,
            preyUser: preyUser
              ? {
                  id: preyUser._id,
                  username: preyUser.username,
                  name: preyUser.name,
                  avatarUrl: preyUser.avatarUrl,
                }
              : null,
            hunterUser: hunterUser
              ? {
                  id: hunterUser._id,
                  username: hunterUser.username,
                  name: hunterUser.name,
                  avatarUrl: hunterUser.avatarUrl,
                }
              : null,
          },
          liveData: {
            userCurrentPoints,
            partnerCurrentPoints,
            partnerInitialPoints,
            preyCurrentPoints,
            hunterCurrentPoints,
            currentWeekMax,
          },
        };
      }),
    );

    return result.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );
  },
});

/**
 * Get user's mini-game history for a challenge (all games they participated in)
 * Includes active and completed games with outcomes
 */
export const getUserHistory = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all mini-games for this challenge
    const allMiniGames = await ctx.db
      .query("miniGames")
      .withIndex("challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Filter to games that are active or completed (not draft/calculating)
    const relevantGames = allMiniGames.filter(
      (g) => g.status === "active" || g.status === "completed"
    );

    if (relevantGames.length === 0) {
      return [];
    }

    // Get user's participation in each game
    const result = await Promise.all(
      relevantGames.map(async (game) => {
        const participation = await ctx.db
          .query("miniGameParticipants")
          .withIndex("miniGameUser", (q) =>
            q.eq("miniGameId", game._id).eq("userId", args.userId),
          )
          .first();

        if (!participation) {
          return null;
        }

        // Get related user data
        let partnerUser = null;
        let preyUser = null;
        let hunterUser = null;

        if (participation.partnerUserId) {
          const user = await ctx.db.get(participation.partnerUserId);
          partnerUser = user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null;
        }

        if (participation.preyUserId) {
          const user = await ctx.db.get(participation.preyUserId);
          preyUser = user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null;
        }

        if (participation.hunterUserId) {
          const user = await ctx.db.get(participation.hunterUserId);
          hunterUser = user
            ? {
                id: user._id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null;
        }

        return {
          miniGame: {
            id: game._id,
            type: game.type,
            name: game.name,
            status: game.status,
            startsAt: game.startsAt,
            endsAt: game.endsAt,
            config: game.config,
          },
          participation: {
            id: participation._id,
            initialState: participation.initialState,
            finalState: participation.finalState,
            bonusPoints: participation.bonusPoints,
            outcome: participation.outcome,
            partnerUser,
            preyUser,
            hunterUser,
          },
        };
      }),
    );

    // Filter out nulls and sort by game start date (most recent first)
    return result
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.miniGame.startsAt - a.miniGame.startsAt);
  },
});
