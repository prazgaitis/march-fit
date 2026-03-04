import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestActivityType,
  createTestChallenge,
  createTestContext,
  createTestParticipation,
  createTestUser,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";

describe("challenge-scoped affinity", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("recomputes affinities from likes/comments and scopes by challenge", async () => {
    const viewerId = await createTestUser(t, {
      email: "viewer-affinity@example.com",
      username: "viewer_affinity",
    });
    const authorAId = await createTestUser(t, {
      email: "author-a@example.com",
      username: "author_a",
    });
    const authorBId = await createTestUser(t, {
      email: "author-b@example.com",
      username: "author_b",
    });

    const challengeAId = await createTestChallenge(t, viewerId, {
      name: "Affinity Challenge A",
    });
    const challengeBId = await createTestChallenge(t, viewerId, {
      name: "Affinity Challenge B",
    });

    await createTestParticipation(t, viewerId, challengeAId);
    await createTestParticipation(t, authorAId, challengeAId);
    await createTestParticipation(t, viewerId, challengeBId);
    await createTestParticipation(t, authorBId, challengeBId);

    const typeAId = await createTestActivityType(t, challengeAId, {
      name: "Run A",
    });
    const typeBId = await createTestActivityType(t, challengeBId, {
      name: "Run B",
    });

    const now = Date.now();
    const activityAId = await t.run(async (ctx) => {
      return insertTestActivity(ctx, {
        userId: authorAId,
        challengeId: challengeAId,
        activityTypeId: typeAId,
        loggedDate: now,
        metrics: {},
        source: "manual",
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: now - 1000,
        updatedAt: now - 1000,
        feedScore: 30,
        feedRank: 999999,
      });
    });

    const activityBId = await t.run(async (ctx) => {
      return insertTestActivity(ctx, {
        userId: authorBId,
        challengeId: challengeBId,
        activityTypeId: typeBId,
        loggedDate: now,
        metrics: {},
        source: "manual",
        pointsEarned: 12,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: now - 900,
        updatedAt: now - 900,
        feedScore: 35,
        feedRank: 999998,
      });
    });

    // First run initializes watermark (no backfill by design).
    await t.mutation(
      internal.mutations.follows.recomputeAffinitiesFromInteractions,
      {},
    );

    const interactionBase = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("likes", {
        activityId: activityAId,
        userId: viewerId,
        createdAt: interactionBase + 1,
      });
      await ctx.db.insert("comments", {
        activityId: activityAId,
        userId: viewerId,
        content: "Great work",
        createdAt: interactionBase + 2,
        updatedAt: interactionBase + 2,
      });
      await ctx.db.insert("likes", {
        activityId: activityBId,
        userId: viewerId,
        createdAt: interactionBase + 3,
      });
    });

    await t.mutation(
      internal.mutations.follows.recomputeAffinitiesFromInteractions,
      {},
    );

    const [affinityA, affinityB] = await t.run(async (ctx) => {
      const a = await ctx.db
        .query("userAffinities")
        .withIndex("challengeViewerAuthor", (q) =>
          q
            .eq("challengeId", challengeAId)
            .eq("viewerUserId", viewerId)
            .eq("authorUserId", authorAId),
        )
        .first();
      const b = await ctx.db
        .query("userAffinities")
        .withIndex("challengeViewerAuthor", (q) =>
          q
            .eq("challengeId", challengeBId)
            .eq("viewerUserId", viewerId)
            .eq("authorUserId", authorBId),
        )
        .first();
      return [a, b] as const;
    });

    expect(affinityA?.score).toBe(6); // like(2) + comment(4)
    expect(affinityB?.score).toBe(2); // like(2)
  });

  it("boosts algorithmic feed ranking with affinity score", async () => {
    const viewerId = await createTestUser(t, {
      email: "viewer-feed@example.com",
      username: "viewer_feed",
    });
    const authorLowId = await createTestUser(t, {
      email: "author-low@example.com",
      username: "author_low",
    });
    const authorHighId = await createTestUser(t, {
      email: "author-high@example.com",
      username: "author_high",
    });

    const challengeId = await createTestChallenge(t, viewerId, {
      name: "Affinity Feed Challenge",
    });
    await createTestParticipation(t, viewerId, challengeId);
    await createTestParticipation(t, authorLowId, challengeId);
    await createTestParticipation(t, authorHighId, challengeId);

    const activityTypeId = await createTestActivityType(t, challengeId, {
      name: "Generic",
    });
    const now = Date.now();

    await t.run(async (ctx) => {
      await insertTestActivity(ctx, {
        userId: authorLowId,
        challengeId,
        activityTypeId,
        loggedDate: now,
        metrics: {},
        source: "manual",
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: now - 2000,
        updatedAt: now - 2000,
        feedScore: 45,
        feedRank: 1005,
      });
      await insertTestActivity(ctx, {
        userId: authorHighId,
        challengeId,
        activityTypeId,
        loggedDate: now,
        metrics: {},
        source: "manual",
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: now - 1000,
        updatedAt: now - 1000,
        feedScore: 40,
        feedRank: 995,
      });
      await ctx.db.insert("userAffinities", {
        challengeId,
        viewerUserId: viewerId,
        authorUserId: authorHighId,
        score: 100,
        updatedAt: now,
      });
    });

    const asViewer = t.withIdentity({
      subject: "viewer-feed-subject",
      email: "viewer-feed@example.com",
    });

    const feed = await asViewer.query(api.queries.algorithmicFeed.getAlgorithmicFeed, {
      challengeId,
      includeEngagementCounts: false,
      includeMediaUrls: false,
    });

    expect(feed.page).toHaveLength(2);
    expect(feed.page[0]?.user.id).toBe(authorHighId);
    expect(feed.page[0]?.affinityScore).toBe(100);
    expect(feed.page[0]?.affinityBoost).toBe(20);
  });

  it("suggests high-affinity users not already followed in challenge", async () => {
    const viewerEmail = "viewer-suggest@example.com";
    const viewerId = await createTestUser(t, {
      email: viewerEmail,
      username: "viewer_suggest",
    });
    const followedId = await createTestUser(t, {
      email: "followed@example.com",
      username: "already_followed",
    });
    const suggestedAId = await createTestUser(t, {
      email: "suggested-a@example.com",
      username: "suggested_a",
    });
    const suggestedBId = await createTestUser(t, {
      email: "suggested-b@example.com",
      username: "suggested_b",
    });
    const outsideChallengeId = await createTestUser(t, {
      email: "outside@example.com",
      username: "outside",
    });

    const challengeId = await createTestChallenge(t, viewerId, {
      name: "Suggestions Challenge",
    });
    await createTestParticipation(t, viewerId, challengeId);
    await createTestParticipation(t, followedId, challengeId);
    await createTestParticipation(t, suggestedAId, challengeId);
    await createTestParticipation(t, suggestedBId, challengeId);

    await t.run(async (ctx) => {
      await ctx.db.insert("follows", {
        followerId: viewerId,
        followingId: followedId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("userAffinities", {
        challengeId,
        viewerUserId: viewerId,
        authorUserId: followedId,
        score: 95,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("userAffinities", {
        challengeId,
        viewerUserId: viewerId,
        authorUserId: suggestedAId,
        score: 70,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("userAffinities", {
        challengeId,
        viewerUserId: viewerId,
        authorUserId: suggestedBId,
        score: 50,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("userAffinities", {
        challengeId,
        viewerUserId: viewerId,
        authorUserId: outsideChallengeId,
        score: 99,
        updatedAt: Date.now(),
      });
    });

    const asViewer = t.withIdentity({
      subject: "viewer-suggest-subject",
      email: viewerEmail,
    });

    const suggestions = await asViewer.query(api.queries.follows.getSuggestions, {
      challengeId: challengeId as Id<"challenges">,
      limit: 3,
    });

    expect(suggestions.map((s) => s.id)).toEqual([suggestedAId, suggestedBId]);
    expect(suggestions.map((s) => s.affinityScore)).toEqual([70, 50]);
  });
});
