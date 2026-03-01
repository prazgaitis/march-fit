/**
 * Shared read-only calculation logic for mini-games.
 *
 * Used by both the real mutations (start/end) and the preview queries
 * (previewStart/previewEnd) to guarantee identical results.
 */
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { notDeleted } from "./activityFilters";
import { formatDateOnlyFromUtcMs } from "./dateOnly";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Read-only database context (works in both queries and mutations). */
export type ReadCtx = Pick<QueryCtx, "db">;

export type LeaderboardEntry = {
  userId: Id<"users">;
  totalPoints: number;
};

// ─── Start Preview Types ─────────────────────────────────────────────────────

export type PartnerWeekAssignment = {
  userId: Id<"users">;
  rank: number;
  points: number;
  partnerUserId: Id<"users">;
  user?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
  partnerUser?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
};

export type HuntWeekAssignment = {
  userId: Id<"users">;
  rank: number;
  points: number;
  preyUserId?: Id<"users">;
  hunterUserId?: Id<"users">;
  user?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
  preyUser?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
  hunterUser?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
};

export type PrWeekAssignment = {
  userId: Id<"users">;
  rank: number;
  points: number;
  dailyPr: number;
  user?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
};

export type StartPreview =
  | { type: "partner_week"; assignments: PartnerWeekAssignment[] }
  | { type: "hunt_week"; assignments: HuntWeekAssignment[] }
  | { type: "pr_week"; assignments: PrWeekAssignment[] };

// ─── End Preview Types ───────────────────────────────────────────────────────

export type PartnerWeekOutcome = {
  userId: Id<"users">;
  partnerUserId: Id<"users">;
  partnerWeekPoints: number;
  bonusPoints: number;
  user?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
  partnerUser?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
};

export type HuntWeekOutcome = {
  userId: Id<"users">;
  initialRank: number;
  currentRank: number;
  caughtPrey: boolean;
  wasCaught: boolean;
  bonusPoints: number;
  preyUserId?: Id<"users">;
  hunterUserId?: Id<"users">;
  user?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
  preyUser?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
  hunterUser?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
};

export type PrWeekOutcome = {
  userId: Id<"users">;
  initialPr: number;
  weekMaxPoints: number;
  hitPr: boolean;
  bonusPoints: number;
  user?: { id: Id<"users">; username?: string; name?: string; avatarUrl?: string } | null;
};

export type EndPreview =
  | { type: "partner_week"; outcomes: PartnerWeekOutcome[]; totalBonusPoints: number }
  | { type: "hunt_week"; outcomes: HuntWeekOutcome[]; totalBonusPoints: number }
  | { type: "pr_week"; outcomes: PrWeekOutcome[]; totalBonusPoints: number };

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/** Get sorted leaderboard for a challenge (descending by totalPoints). */
export async function getLeaderboard(
  ctx: ReadCtx,
  challengeId: Id<"challenges">,
): Promise<LeaderboardEntry[]> {
  const participations = await ctx.db
    .query("userChallenges")
    .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
    .collect();

  participations.sort((a, b) => b.totalPoints - a.totalPoints);

  return participations.map((p) => ({
    userId: p.userId,
    totalPoints: p.totalPoints,
  }));
}

// ─── User Lookup ─────────────────────────────────────────────────────────────

async function userSummary(ctx: ReadCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

// ─── Start Previews ──────────────────────────────────────────────────────────

export async function previewPartnerWeekStart(
  ctx: ReadCtx,
  leaderboard: LeaderboardEntry[],
): Promise<PartnerWeekAssignment[]> {
  const n = leaderboard.length;
  const assignments: PartnerWeekAssignment[] = [];

  for (let i = 0; i < n; i++) {
    const entry = leaderboard[i];
    const partnerIndex = n - 1 - i;
    const partner = leaderboard[partnerIndex];

    assignments.push({
      userId: entry.userId,
      rank: i + 1,
      points: entry.totalPoints,
      partnerUserId: partner.userId,
      user: await userSummary(ctx, entry.userId),
      partnerUser: await userSummary(ctx, partner.userId),
    });
  }

  return assignments;
}

export async function previewHuntWeekStart(
  ctx: ReadCtx,
  leaderboard: LeaderboardEntry[],
): Promise<HuntWeekAssignment[]> {
  const n = leaderboard.length;
  const assignments: HuntWeekAssignment[] = [];

  for (let i = 0; i < n; i++) {
    const entry = leaderboard[i];
    const preyUserId = i > 0 ? leaderboard[i - 1].userId : undefined;
    const hunterUserId = i < n - 1 ? leaderboard[i + 1].userId : undefined;

    assignments.push({
      userId: entry.userId,
      rank: i + 1,
      points: entry.totalPoints,
      preyUserId,
      hunterUserId,
      user: await userSummary(ctx, entry.userId),
      preyUser: preyUserId ? await userSummary(ctx, preyUserId) : null,
      hunterUser: hunterUserId ? await userSummary(ctx, hunterUserId) : null,
    });
  }

  return assignments;
}

export async function previewPrWeekStart(
  ctx: ReadCtx,
  challengeId: Id<"challenges">,
  leaderboard: LeaderboardEntry[],
  gameStartsAt: number,
): Promise<PrWeekAssignment[]> {
  const assignments: PrWeekAssignment[] = [];

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const dailyPr = await calculateMaxDailyPoints(
      ctx,
      entry.userId,
      challengeId,
      gameStartsAt,
    );

    assignments.push({
      userId: entry.userId,
      rank: i + 1,
      points: entry.totalPoints,
      dailyPr,
      user: await userSummary(ctx, entry.userId),
    });
  }

  return assignments;
}

// ─── End Previews ────────────────────────────────────────────────────────────

type MiniGameParticipantData = {
  userId: Id<"users">;
  initialState: any;
  partnerUserId?: Id<"users">;
  preyUserId?: Id<"users">;
  hunterUserId?: Id<"users">;
};

export async function previewPartnerWeekEnd(
  ctx: ReadCtx,
  challengeId: Id<"challenges">,
  startsAt: number,
  endsAt: number,
  config: any,
  participants: MiniGameParticipantData[],
): Promise<{ outcomes: PartnerWeekOutcome[]; totalBonusPoints: number }> {
  const bonusPercentage = config?.bonusPercentage ?? 10;
  const outcomes: PartnerWeekOutcome[] = [];
  let totalBonusPoints = 0;

  for (const p of participants) {
    if (!p.partnerUserId) continue;

    const partnerPoints = await getPointsInPeriod(
      ctx,
      p.partnerUserId,
      challengeId,
      startsAt,
      endsAt,
    );

    const bonusPoints = Math.round(partnerPoints * (bonusPercentage / 100));
    totalBonusPoints += bonusPoints;

    outcomes.push({
      userId: p.userId,
      partnerUserId: p.partnerUserId,
      partnerWeekPoints: partnerPoints,
      bonusPoints,
      user: await userSummary(ctx, p.userId),
      partnerUser: await userSummary(ctx, p.partnerUserId),
    });
  }

  return { outcomes, totalBonusPoints };
}

export async function previewHuntWeekEnd(
  ctx: ReadCtx,
  challengeId: Id<"challenges">,
  config: any,
  participants: MiniGameParticipantData[],
): Promise<{ outcomes: HuntWeekOutcome[]; totalBonusPoints: number }> {
  const catchBonus = config?.catchBonus ?? 75;
  const caughtPenalty = config?.caughtPenalty ?? 25;

  // Get current leaderboard
  const leaderboard = await getLeaderboard(ctx, challengeId);
  const rankMap = new Map<string, number>();
  leaderboard.forEach((entry, index) => {
    rankMap.set(entry.userId, index + 1);
  });

  const outcomes: HuntWeekOutcome[] = [];
  let totalBonusPoints = 0;

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

    const bonusPoints =
      (caughtPrey ? catchBonus : 0) - (wasCaught ? caughtPenalty : 0);
    totalBonusPoints += bonusPoints;

    outcomes.push({
      userId: p.userId,
      initialRank,
      currentRank,
      caughtPrey,
      wasCaught,
      bonusPoints,
      preyUserId: p.preyUserId,
      hunterUserId: p.hunterUserId,
      user: await userSummary(ctx, p.userId),
      preyUser: p.preyUserId ? await userSummary(ctx, p.preyUserId) : null,
      hunterUser: p.hunterUserId ? await userSummary(ctx, p.hunterUserId) : null,
    });
  }

  return { outcomes, totalBonusPoints };
}

export async function previewPrWeekEnd(
  ctx: ReadCtx,
  challengeId: Id<"challenges">,
  startsAt: number,
  endsAt: number,
  config: any,
  participants: MiniGameParticipantData[],
): Promise<{ outcomes: PrWeekOutcome[]; totalBonusPoints: number }> {
  const prBonus = config?.prBonus ?? 100;
  const outcomes: PrWeekOutcome[] = [];
  let totalBonusPoints = 0;

  for (const p of participants) {
    const initialPr = p.initialState?.dailyPr ?? 0;

    const weekMaxPoints = await getMaxDailyPointsInPeriod(
      ctx,
      p.userId,
      challengeId,
      startsAt,
      endsAt,
    );

    const hitPr = weekMaxPoints > initialPr;
    const bonusPoints = hitPr ? prBonus : 0;
    totalBonusPoints += bonusPoints;

    outcomes.push({
      userId: p.userId,
      initialPr,
      weekMaxPoints,
      hitPr,
      bonusPoints,
      user: await userSummary(ctx, p.userId),
    });
  }

  return { outcomes, totalBonusPoints };
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

/**
 * Get a user's max single-day points total from all days before `beforeDate`.
 * Excludes mini_game bonus activities.
 */
export async function calculateMaxDailyPoints(
  ctx: ReadCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  beforeDate: number,
): Promise<number> {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q) =>
      q.eq("userId", userId).eq("challengeId", challengeId),
    )
    .filter(notDeleted)
    .collect();

  const dailyPoints: Record<string, number> = {};

  for (const activity of activities) {
    if (activity.loggedDate >= beforeDate) continue;

    const dateStr = formatDateOnlyFromUtcMs(activity.loggedDate);
    dailyPoints[dateStr] = (dailyPoints[dateStr] || 0) + activity.pointsEarned;
  }

  const values = Object.values(dailyPoints);
  return values.length > 0 ? Math.max(...values) : 0;
}

/**
 * Get total non-bonus points earned by a user during a time period.
 * Excludes `source: "mini_game"` activities to prevent circular scoring.
 */
export async function getPointsInPeriod(
  ctx: ReadCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  startDate: number,
  endDate: number,
): Promise<number> {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q) =>
      q.eq("userId", userId).eq("challengeId", challengeId),
    )
    .filter(notDeleted)
    .collect();

  return activities
    .filter(
      (a) =>
        a.loggedDate >= startDate &&
        a.loggedDate <= endDate &&
        a.source !== "mini_game",
    )
    .reduce((sum, a) => sum + a.pointsEarned, 0);
}

/**
 * Get the maximum single-day points total during a time period.
 * Excludes `source: "mini_game"` activities.
 */
export async function getMaxDailyPointsInPeriod(
  ctx: ReadCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  startDate: number,
  endDate: number,
): Promise<number> {
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_user_challenge_date", (q) =>
      q.eq("userId", userId).eq("challengeId", challengeId),
    )
    .filter(notDeleted)
    .collect();

  const dailyPoints: Record<string, number> = {};

  for (const activity of activities) {
    if (
      activity.loggedDate < startDate ||
      activity.loggedDate > endDate ||
      activity.source === "mini_game"
    )
      continue;

    const dateStr = formatDateOnlyFromUtcMs(activity.loggedDate);
    dailyPoints[dateStr] = (dailyPoints[dateStr] || 0) + activity.pointsEarned;
  }

  const values = Object.values(dailyPoints);
  return values.length > 0 ? Math.max(...values) : 0;
}
