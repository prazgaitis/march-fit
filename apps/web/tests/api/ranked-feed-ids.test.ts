import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestActivityType,
  createTestChallenge,
  createTestContext,
  createTestParticipation,
  createTestUser,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";

describe("getRankedActivityIds", () => {
  let t: ReturnType<typeof createTestContext>;
  let userId: Id<"users">;
  let challengeId: Id<"challenges">;
  let activityTypeId: Id<"activityTypes">;
  const EMAIL = "feed-test@example.com";

  beforeEach(async () => {
    t = createTestContext();
    userId = await createTestUser(t, {
      email: EMAIL,
      username: "feedtester",
    });
    challengeId = await createTestChallenge(t, userId);
    await createTestParticipation(t, userId, challengeId);
    activityTypeId = await createTestActivityType(t, challengeId, {
      name: "Running",
    });
  });

  const authed = () => t.withIdentity({ subject: userId, email: EMAIL });

  const makeActivity = (
    overrides: Partial<{
      userId: Id<"users">;
      createdAt: number;
      pointsEarned: number;
      feedScore: number;
      feedRank: number;
      notes: string;
      deletedAt: number;
    }> = {},
  ) => {
    const now = Date.now();
    return t.run(async (ctx) =>
      insertTestActivity(ctx, {
        userId,
        challengeId,
        activityTypeId,
        loggedDate: now,
        createdAt: now,
        pointsEarned: 10,
        metrics: {},
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal" as const,
        resolutionStatus: "pending" as const,
        updatedAt: now,
        feedScore: 0,
        feedRank: 0,
        ...overrides,
      }),
    );
  };

  it("returns activity IDs in ranked order", async () => {
    const now = Date.now();
    const bareId = await makeActivity({ createdAt: now, feedScore: 5 });
    const richId = await makeActivity({ createdAt: now + 1, feedScore: 40 });

    const ids = await authed().query(
      api.queries.algorithmicFeed.getRankedActivityIds,
      { challengeId },
    );

    expect(ids).toHaveLength(2);
    // Rich activity should rank higher due to higher feedScore
    expect(ids[0]).toBe(richId);
    expect(ids[1]).toBe(bareId);
  });

  it("returns empty array when no activities exist", async () => {
    const ids = await authed().query(
      api.queries.algorithmicFeed.getRankedActivityIds,
      { challengeId },
    );

    expect(ids).toEqual([]);
  });

  it("excludes deleted activities", async () => {
    const now = Date.now();
    const activeId = await makeActivity({ createdAt: now });
    await makeActivity({ createdAt: now + 1, deletedAt: now + 100 });

    const ids = await authed().query(
      api.queries.algorithmicFeed.getRankedActivityIds,
      { challengeId },
    );

    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe(activeId);
  });

  it("boosts followed users in ranking", async () => {
    const now = Date.now();

    const followedUserId = await createTestUser(t, {
      email: "followed@example.com",
      username: "followed_user",
    });
    await createTestParticipation(t, followedUserId, challengeId);

    // Both activities have same feedScore
    const unfollowedId = await makeActivity({
      createdAt: now,
      feedScore: 20,
    });
    const followedId = await makeActivity({
      userId: followedUserId,
      createdAt: now,
      feedScore: 20,
    });

    // Create follow relationship
    await t.run(async (ctx) => {
      await ctx.db.insert("follows", {
        followerId: userId,
        followingId: followedUserId,
        createdAt: now,
      });
    });

    const ids = await authed().query(
      api.queries.algorithmicFeed.getRankedActivityIds,
      { challengeId },
    );

    expect(ids).toHaveLength(2);
    // Followed user's activity should rank higher due to following boost
    expect(ids[0]).toBe(followedId);
    expect(ids[1]).toBe(unfollowedId);
  });

  it("returns same ranking order as getAlgorithmicFeed", async () => {
    const now = Date.now();

    const followedUserId = await createTestUser(t, {
      email: "compare@example.com",
      username: "compare_user",
    });
    await createTestParticipation(t, followedUserId, challengeId);

    await t.run(async (ctx) => {
      await ctx.db.insert("follows", {
        followerId: userId,
        followingId: followedUserId,
        createdAt: now,
      });
    });

    // Create diverse activities with different scores
    await makeActivity({ createdAt: now, feedScore: 10 });
    await makeActivity({
      userId: followedUserId,
      createdAt: now + 1,
      feedScore: 35,
    });
    await makeActivity({ createdAt: now + 2, feedScore: 50 });

    const rankedIds = await authed().query(
      api.queries.algorithmicFeed.getRankedActivityIds,
      { challengeId },
    );

    const fullFeed = await authed().query(
      api.queries.algorithmicFeed.getAlgorithmicFeed,
      { challengeId, includeEngagementCounts: true, includeMediaUrls: true },
    );

    const fullFeedIds = fullFeed.page.map(
      (item: { activity: { _id: string } }) => item.activity._id,
    );

    // Both should return the same ordering
    expect(rankedIds).toEqual(fullFeedIds);
  });

  it("only returns activities for the requested challenge", async () => {
    const now = Date.now();
    const otherChallengeId = await createTestChallenge(t, userId, {
      name: "Other Challenge",
    });
    const otherTypeId = await createTestActivityType(t, otherChallengeId, {
      name: "Cycling",
    });

    const thisId = await makeActivity({ createdAt: now });
    await t.run(async (ctx) =>
      insertTestActivity(ctx, {
        userId,
        challengeId: otherChallengeId,
        activityTypeId: otherTypeId,
        loggedDate: now,
        createdAt: now + 1,
        pointsEarned: 10,
        metrics: {},
        source: "manual",
        flagged: false,
        adminCommentVisibility: "internal" as const,
        resolutionStatus: "pending" as const,
        updatedAt: now,
        feedScore: 0,
        feedRank: 0,
      }),
    );

    const ids = await authed().query(
      api.queries.algorithmicFeed.getRankedActivityIds,
      { challengeId },
    );

    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe(thisId);
  });
});
