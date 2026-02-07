import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/ids";

// Helper to check if user is challenge admin
async function requireChallengeAdmin(
  ctx: { db: any; auth: any },
  challengeId: Id<"challenges">,
) {
  const user = await getCurrentUser(ctx as any);
  if (!user) {
    throw new Error("Not authenticated");
  }

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  // Check if global admin or challenge creator
  const isGlobalAdmin = user.role === "admin";
  const isCreator = challenge.creatorId === user._id;

  // Check challenge-specific admin role
  const participation = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", user._id).eq("challengeId", challengeId),
    )
    .first();
  const isChallengeAdmin = participation?.role === "admin";

  if (!isGlobalAdmin && !isCreator && !isChallengeAdmin) {
    throw new Error("Not authorized - challenge admin required");
  }

  return { user, challenge };
}

/**
 * Create a new mini-game (draft status)
 */
export const create = mutation({
  args: {
    challengeId: v.id("challenges"),
    type: v.union(
      v.literal("partner_week"),
      v.literal("hunt_week"),
      v.literal("pr_week"),
    ),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { challenge } = await requireChallengeAdmin(ctx, args.challengeId);

    // Validate dates
    if (args.startsAt >= args.endsAt) {
      throw new Error("Start date must be before end date");
    }

    if (args.endsAt > challenge.endDate) {
      throw new Error("Mini-game cannot extend past challenge end date");
    }

    const now = Date.now();

    const miniGameId = await ctx.db.insert("miniGames", {
      challengeId: args.challengeId,
      type: args.type,
      name: args.name,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      status: "draft",
      config: args.config ?? getDefaultConfig(args.type),
      createdAt: now,
      updatedAt: now,
    });

    return { miniGameId };
  },
});

/**
 * Update a draft mini-game
 */
export const update = mutation({
  args: {
    miniGameId: v.id("miniGames"),
    name: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const miniGame = await ctx.db.get(args.miniGameId);
    if (!miniGame) {
      throw new Error("Mini-game not found");
    }

    if (miniGame.status !== "draft") {
      throw new Error("Can only edit draft mini-games");
    }

    await requireChallengeAdmin(ctx, miniGame.challengeId);

    const challenge = await ctx.db.get(miniGame.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const startsAt = args.startsAt ?? miniGame.startsAt;
    const endsAt = args.endsAt ?? miniGame.endsAt;

    // Validate dates
    if (startsAt >= endsAt) {
      throw new Error("Start date must be before end date");
    }

    if (endsAt > challenge.endDate) {
      throw new Error("Mini-game cannot extend past challenge end date");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.startsAt !== undefined) updates.startsAt = args.startsAt;
    if (args.endsAt !== undefined) updates.endsAt = args.endsAt;
    if (args.config !== undefined) updates.config = args.config;

    await ctx.db.patch(args.miniGameId, updates);

    return { success: true };
  },
});

/**
 * Delete a draft mini-game
 */
export const remove = mutation({
  args: {
    miniGameId: v.id("miniGames"),
  },
  handler: async (ctx, args) => {
    const miniGame = await ctx.db.get(args.miniGameId);
    if (!miniGame) {
      throw new Error("Mini-game not found");
    }

    if (miniGame.status !== "draft") {
      throw new Error("Can only delete draft mini-games");
    }

    await requireChallengeAdmin(ctx, miniGame.challengeId);

    await ctx.db.delete(args.miniGameId);

    return { success: true };
  },
});

/**
 * Start a mini-game - captures initial state and creates participant records
 */
export const start = mutation({
  args: {
    miniGameId: v.id("miniGames"),
  },
  handler: async (ctx, args) => {
    const miniGame = await ctx.db.get(args.miniGameId);
    if (!miniGame) {
      throw new Error("Mini-game not found");
    }

    if (miniGame.status !== "draft") {
      throw new Error("Can only start draft mini-games");
    }

    await requireChallengeAdmin(ctx, miniGame.challengeId);

    // Get all participants sorted by points (leaderboard)
    const participations = await ctx.db
      .query("userChallenges")
      .withIndex("challengeId", (q: any) =>
        q.eq("challengeId", miniGame.challengeId),
      )
      .collect();

    if (participations.length === 0) {
      throw new Error("No participants in challenge");
    }

    // Sort by totalPoints descending
    participations.sort(
      (a: { totalPoints: number }, b: { totalPoints: number }) =>
        b.totalPoints - a.totalPoints,
    );

    const now = Date.now();

    // Create participant records based on game type
    if (miniGame.type === "partner_week") {
      await createPartnerWeekParticipants(ctx, args.miniGameId, participations, now);
    } else if (miniGame.type === "hunt_week") {
      await createHuntWeekParticipants(ctx, args.miniGameId, participations, now);
    } else if (miniGame.type === "pr_week") {
      await createPrWeekParticipants(
        ctx,
        args.miniGameId,
        miniGame.challengeId,
        participations,
        miniGame.startsAt,
        now,
      );
    }

    // Update game status
    await ctx.db.patch(args.miniGameId, {
      status: "active",
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * End a mini-game - calculates outcomes and awards bonuses
 */
export const end = mutation({
  args: {
    miniGameId: v.id("miniGames"),
  },
  handler: async (ctx, args) => {
    const miniGame = await ctx.db.get(args.miniGameId);
    if (!miniGame) {
      throw new Error("Mini-game not found");
    }

    if (miniGame.status !== "active") {
      throw new Error("Can only end active mini-games");
    }

    await requireChallengeAdmin(ctx, miniGame.challengeId);

    // Set status to calculating
    await ctx.db.patch(args.miniGameId, {
      status: "calculating",
      updatedAt: Date.now(),
    });

    // Get all participants
    const participants = await ctx.db
      .query("miniGameParticipants")
      .withIndex("miniGameId", (q: any) => q.eq("miniGameId", args.miniGameId))
      .collect();

    const now = Date.now();

    // Calculate outcomes based on game type
    if (miniGame.type === "partner_week") {
      await calculatePartnerWeekOutcomes(
        ctx,
        miniGame,
        participants,
        now,
      );
    } else if (miniGame.type === "hunt_week") {
      await calculateHuntWeekOutcomes(ctx, miniGame, participants, now);
    } else if (miniGame.type === "pr_week") {
      await calculatePrWeekOutcomes(ctx, miniGame, participants, now);
    }

    // Update game status to completed
    await ctx.db.patch(args.miniGameId, {
      status: "completed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// Helper functions for game initialization
// ============================================

function getDefaultConfig(type: "partner_week" | "hunt_week" | "pr_week") {
  switch (type) {
    case "partner_week":
      return { bonusPercentage: 10 };
    case "hunt_week":
      return { catchBonus: 75, caughtPenalty: 25 };
    case "pr_week":
      return { prBonus: 100 };
  }
}

type Participation = {
  _id: Id<"userChallenges">;
  userId: Id<"users">;
  totalPoints: number;
};

async function createPartnerWeekParticipants(
  ctx: { db: any },
  miniGameId: Id<"miniGames">,
  participations: Participation[],
  now: number,
) {
  const n = participations.length;

  for (let i = 0; i < n; i++) {
    const participation = participations[i];
    // Pair: rank 1 with rank n, rank 2 with rank n-1, etc.
    // For odd number, middle person pairs with themselves
    const partnerIndex = n - 1 - i;
    const partner = participations[partnerIndex];

    await ctx.db.insert("miniGameParticipants", {
      miniGameId,
      userId: participation.userId,
      initialState: {
        rank: i + 1,
        points: participation.totalPoints,
      },
      partnerUserId: partner.userId,
      createdAt: now,
    });
  }
}

async function createHuntWeekParticipants(
  ctx: { db: any },
  miniGameId: Id<"miniGames">,
  participations: Participation[],
  now: number,
) {
  const n = participations.length;

  for (let i = 0; i < n; i++) {
    const participation = participations[i];

    // Prey is the person above (lower index = higher rank)
    // First place (i=0) has no prey
    const preyUserId = i > 0 ? participations[i - 1].userId : undefined;

    // Hunter is the person below (higher index = lower rank)
    // Last place has no hunter
    const hunterUserId = i < n - 1 ? participations[i + 1].userId : undefined;

    await ctx.db.insert("miniGameParticipants", {
      miniGameId,
      userId: participation.userId,
      initialState: {
        rank: i + 1,
        points: participation.totalPoints,
      },
      preyUserId,
      hunterUserId,
      createdAt: now,
    });
  }
}

async function createPrWeekParticipants(
  ctx: { db: any },
  miniGameId: Id<"miniGames">,
  challengeId: Id<"challenges">,
  participations: Participation[],
  gameStartsAt: number,
  now: number,
) {
  for (let i = 0; i < participations.length; i++) {
    const participation = participations[i];

    // Calculate max daily points before game start
    const dailyPr = await calculateMaxDailyPoints(
      ctx,
      participation.userId,
      challengeId,
      gameStartsAt,
    );

    await ctx.db.insert("miniGameParticipants", {
      miniGameId,
      userId: participation.userId,
      initialState: {
        rank: i + 1,
        points: participation.totalPoints,
        dailyPr,
      },
      createdAt: now,
    });
  }
}

async function calculateMaxDailyPoints(
  ctx: { db: any },
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  beforeDate: number,
): Promise<number> {
  // Get all activities for user in challenge before the date
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId),
    )
    .collect();

  // Filter to activities before game start and group by day
  const dailyPoints: Record<string, number> = {};

  for (const activity of activities) {
    if (activity.loggedDate >= beforeDate) continue;

    // Get date string (YYYY-MM-DD)
    const dateStr = new Date(activity.loggedDate).toISOString().split("T")[0];
    dailyPoints[dateStr] = (dailyPoints[dateStr] || 0) + activity.pointsEarned;
  }

  // Return max daily points, or 0 if no activities
  const values = Object.values(dailyPoints);
  return values.length > 0 ? Math.max(...values) : 0;
}

// ============================================
// Helper functions for outcome calculation
// ============================================

type MiniGameParticipant = {
  _id: Id<"miniGameParticipants">;
  miniGameId: Id<"miniGames">;
  userId: Id<"users">;
  initialState: any;
  partnerUserId?: Id<"users">;
  preyUserId?: Id<"users">;
  hunterUserId?: Id<"users">;
};

type MiniGame = {
  _id: Id<"miniGames">;
  challengeId: Id<"challenges">;
  type: "partner_week" | "hunt_week" | "pr_week";
  name: string;
  startsAt: number;
  endsAt: number;
  config: any;
};

async function calculatePartnerWeekOutcomes(
  ctx: { db: any },
  miniGame: MiniGame,
  participants: MiniGameParticipant[],
  now: number,
) {
  const bonusPercentage = miniGame.config?.bonusPercentage ?? 10;

  for (const participant of participants) {
    if (!participant.partnerUserId) continue;

    // Calculate partner's points earned during game period
    const partnerPoints = await getPointsInPeriod(
      ctx,
      participant.partnerUserId,
      miniGame.challengeId,
      miniGame.startsAt,
      miniGame.endsAt,
    );

    const bonusPoints = Math.round(partnerPoints * (bonusPercentage / 100));

    // Get current points for final state
    const userChallenge = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", participant.userId).eq("challengeId", miniGame.challengeId),
      )
      .first();

    // Update participant with outcome
    await ctx.db.patch(participant._id, {
      finalState: {
        points: userChallenge?.totalPoints ?? 0,
      },
      bonusPoints,
      outcome: {
        partnerWeekPoints: partnerPoints,
      },
    });

    // Award bonus activity
    if (bonusPoints !== 0) {
      await awardBonusActivity(
        ctx,
        participant,
        miniGame,
        bonusPoints,
        `Partner Week Bonus (${bonusPercentage}% of partner's ${partnerPoints} pts)`,
        now,
      );
    }
  }
}

async function calculateHuntWeekOutcomes(
  ctx: { db: any },
  miniGame: MiniGame,
  participants: MiniGameParticipant[],
  now: number,
) {
  const catchBonus = miniGame.config?.catchBonus ?? 75;
  const caughtPenalty = miniGame.config?.caughtPenalty ?? 25;

  // Get current leaderboard
  const currentParticipations = await ctx.db
    .query("userChallenges")
    .withIndex("challengeId", (q: any) =>
      q.eq("challengeId", miniGame.challengeId),
    )
    .collect();

  currentParticipations.sort(
    (a: { totalPoints: number }, b: { totalPoints: number }) =>
      b.totalPoints - a.totalPoints,
  );

  // Create rank map
  const rankMap = new Map<string, number>();
  currentParticipations.forEach(
    (p: { userId: Id<"users"> }, index: number) => {
      rankMap.set(p.userId, index + 1);
    },
  );

  for (const participant of participants) {
    const currentRank = rankMap.get(participant.userId) ?? 999;
    const initialRank = participant.initialState?.rank ?? 999;

    let caughtPrey = false;
    let wasCaught = false;

    // Check if caught prey (passed the person above)
    if (participant.preyUserId) {
      const preyCurrentRank = rankMap.get(participant.preyUserId) ?? 999;
      caughtPrey = currentRank < preyCurrentRank;
    }

    // Check if was caught (hunter passed us)
    if (participant.hunterUserId) {
      const hunterCurrentRank = rankMap.get(participant.hunterUserId) ?? 999;
      wasCaught = hunterCurrentRank < currentRank;
    }

    const bonusPoints =
      (caughtPrey ? catchBonus : 0) - (wasCaught ? caughtPenalty : 0);

    // Get user's current challenge data
    const userChallenge = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", participant.userId).eq("challengeId", miniGame.challengeId),
      )
      .first();

    // Update participant with outcome
    await ctx.db.patch(participant._id, {
      finalState: {
        rank: currentRank,
        points: userChallenge?.totalPoints ?? 0,
      },
      bonusPoints,
      outcome: {
        caughtPrey,
        wasCaught,
        initialRank,
        finalRank: currentRank,
      },
    });

    // Award bonus activity
    if (bonusPoints !== 0) {
      let description = "Hunt Week: ";
      if (caughtPrey && wasCaught) {
        description += `Caught prey (+${catchBonus}) but was caught (-${caughtPenalty})`;
      } else if (caughtPrey) {
        description += `Caught prey! (+${catchBonus})`;
      } else if (wasCaught) {
        description += `Was caught (-${caughtPenalty})`;
      }

      await awardBonusActivity(
        ctx,
        participant,
        miniGame,
        bonusPoints,
        description,
        now,
      );
    }
  }
}

async function calculatePrWeekOutcomes(
  ctx: { db: any },
  miniGame: MiniGame,
  participants: MiniGameParticipant[],
  now: number,
) {
  const prBonus = miniGame.config?.prBonus ?? 100;

  for (const participant of participants) {
    const initialPr = participant.initialState?.dailyPr ?? 0;

    // Calculate max daily points during game period
    const weekMaxPoints = await getMaxDailyPointsInPeriod(
      ctx,
      participant.userId,
      miniGame.challengeId,
      miniGame.startsAt,
      miniGame.endsAt,
    );

    const hitPr = weekMaxPoints > initialPr;
    const bonusPoints = hitPr ? prBonus : 0;

    // Get user's current challenge data
    const userChallenge = await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", participant.userId).eq("challengeId", miniGame.challengeId),
      )
      .first();

    // Update participant with outcome
    await ctx.db.patch(participant._id, {
      finalState: {
        points: userChallenge?.totalPoints ?? 0,
      },
      bonusPoints,
      outcome: {
        initialPr,
        weekMaxPoints,
        hitPr,
      },
    });

    // Award bonus activity
    if (bonusPoints !== 0) {
      await awardBonusActivity(
        ctx,
        participant,
        miniGame,
        bonusPoints,
        `PR Week: New daily PR! (${weekMaxPoints} pts, previous: ${initialPr} pts)`,
        now,
      );
    }
  }
}

async function getPointsInPeriod(
  ctx: { db: any },
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  startDate: number,
  endDate: number,
): Promise<number> {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId),
    )
    .collect();

  return activities
    .filter(
      (a: { loggedDate: number; source: string }) =>
        a.loggedDate >= startDate &&
        a.loggedDate <= endDate &&
        a.source !== "mini_game", // Exclude bonus activities from calculation
    )
    .reduce((sum: number, a: { pointsEarned: number }) => sum + a.pointsEarned, 0);
}

async function getMaxDailyPointsInPeriod(
  ctx: { db: any },
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  startDate: number,
  endDate: number,
): Promise<number> {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q: any) =>
      q.eq("userId", userId).eq("challengeId", challengeId),
    )
    .collect();

  // Group by day (excluding mini_game bonus activities)
  const dailyPoints: Record<string, number> = {};

  for (const activity of activities) {
    if (
      activity.loggedDate < startDate ||
      activity.loggedDate > endDate ||
      activity.source === "mini_game"
    )
      continue;

    const dateStr = new Date(activity.loggedDate).toISOString().split("T")[0];
    dailyPoints[dateStr] = (dailyPoints[dateStr] || 0) + activity.pointsEarned;
  }

  const values = Object.values(dailyPoints);
  return values.length > 0 ? Math.max(...values) : 0;
}

async function awardBonusActivity(
  ctx: { db: any },
  participant: MiniGameParticipant,
  miniGame: MiniGame,
  bonusPoints: number,
  description: string,
  now: number,
) {
  // Find or create a mini-game bonus activity type
  let bonusActivityType = await ctx.db
    .query("activityTypes")
    .withIndex("challengeId", (q: any) =>
      q.eq("challengeId", miniGame.challengeId),
    )
    .filter((q: any) => q.eq(q.field("name"), "Mini-Game Bonus"))
    .first();

  if (!bonusActivityType) {
    // Create a mini-game bonus activity type
    bonusActivityType = {
      _id: await ctx.db.insert("activityTypes", {
        challengeId: miniGame.challengeId,
        name: "Mini-Game Bonus",
        description: "Bonus points awarded from mini-games",
        scoringConfig: { type: "fixed", basePoints: 0 },
        contributesToStreak: false,
        isNegative: false,
        createdAt: now,
        updatedAt: now,
      }),
    };
  }

  // Create the bonus activity
  const activityId = await ctx.db.insert("activities", {
    userId: participant.userId,
    challengeId: miniGame.challengeId,
    activityTypeId: bonusActivityType._id,
    loggedDate: now,
    pointsEarned: bonusPoints,
    notes: description,
    flagged: false,
    adminCommentVisibility: "internal",
    resolutionStatus: "resolved",
    source: "mini_game",
    externalId: `mini_game_${miniGame._id}_${participant.userId}`,
    externalData: {
      miniGameId: miniGame._id,
      miniGameType: miniGame.type,
      miniGameName: miniGame.name,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Update participant with bonus activity reference
  await ctx.db.patch(participant._id, {
    bonusActivityId: activityId,
  });

  // Update user's total points
  const userChallenge = await ctx.db
    .query("userChallenges")
    .withIndex("userChallengeUnique", (q: any) =>
      q.eq("userId", participant.userId).eq("challengeId", miniGame.challengeId),
    )
    .first();

  if (userChallenge) {
    await ctx.db.patch(userChallenge._id, {
      totalPoints: userChallenge.totalPoints + bonusPoints,
      updatedAt: now,
    });
  }
}
