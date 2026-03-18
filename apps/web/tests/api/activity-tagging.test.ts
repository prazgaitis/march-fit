import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api, internal } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestActivityType,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";
import { dateOnlyToUtcMs } from "@/lib/date-only";

describe("Activity Tagging", () => {
  let t: ReturnType<typeof createTestContext>;
  let taggerId: Id<"users">;
  let taggedId: Id<"users">;
  let challengeId: Id<"challenges">;
  let activityTypeId: Id<"activityTypes">;

  const TAGGER_EMAIL = "tagger@example.com";
  const TAGGED_EMAIL = "tagged@example.com";
  const LOGGED_DATE = "2024-01-05";
  const LOGGED_DATE_MS = dateOnlyToUtcMs(LOGGED_DATE);

  // Use fake timers so ctx.scheduler.runAfter(0, ...) callbacks don't fire
  // automatically as macrotasks. This prevents "Write outside of transaction"
  // errors from convex-test when scheduled functions run against a stale db.
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    t = createTestContext();
    taggerId = await createTestUser(t, {
      email: TAGGER_EMAIL,
      username: "tagger",
      name: "Tagger",
    });
    taggedId = await createTestUser(t, {
      email: TAGGED_EMAIL,
      username: "tagged",
      name: "Tagged User",
    });
    challengeId = await createTestChallenge(t, taggerId);
    await createTestParticipation(t, taggerId, challengeId);
    await createTestParticipation(t, taggedId, challengeId);
    activityTypeId = await createTestActivityType(t, challengeId, {
      name: "Running",
      scoringConfig: { type: "fixed", basePoints: 10 },
    });
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
  });

  const taggerAuth = () =>
    t.withIdentity({ subject: taggerId, email: TAGGER_EMAIL });
  const taggedAuth = () =>
    t.withIdentity({ subject: taggedId, email: TAGGED_EMAIL });

  /** Log an activity via the mutation (tags are created inline, but the
   *  scheduled background job for linking may not run in tests). */
  async function logActivity(overrides: Record<string, unknown> = {}) {
    return taggerAuth().mutation(api.mutations.activities.log, {
      challengeId,
      activityTypeId,
      loggedDate: LOGGED_DATE,
      source: "manual",
      ...overrides,
    } as any);
  }

  /** Manually run the background linking job (scheduled functions don't
   *  reliably execute in convex-test). */
  async function runLinkJob(activityId: Id<"activities">) {
    await t.mutation(
      internal.mutations.activityTags.linkRelatedActivities,
      { activityId, challengeId, loggedDate: LOGGED_DATE_MS },
    );
  }

  async function getNotifications(userId: Id<"users">) {
    return t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();
    });
  }

  async function getActivityTags(activityId: Id<"activities">) {
    return t.run(async (ctx) => {
      return await ctx.db
        .query("activityTags")
        .withIndex("activityId", (q) => q.eq("activityId", activityId))
        .collect();
    });
  }

  // ── Tag Creation via Log Mutation ─────────────────────────────────

  describe("tag creation via log mutation", () => {
    it("should create activity tags when logging with taggedUserIds", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });

      const tags = await getActivityTags(result.id as Id<"activities">);
      expect(tags).toHaveLength(1);
      expect(tags[0].taggedUserId).toBe(taggedId);
      expect(tags[0].challengeId).toBe(challengeId);
      expect(tags[0].dismissedAt).toBeUndefined();
    });

    it("should not create a tag for the tagger themselves", async () => {
      const result = await logActivity({
        taggedUserIds: [taggerId, taggedId],
      });

      const tags = await getActivityTags(result.id as Id<"activities">);
      expect(tags).toHaveLength(1);
      expect(tags[0].taggedUserId).toBe(taggedId);
    });

    it("should not create duplicate tags for the same user", async () => {
      const result = await logActivity({
        taggedUserIds: [taggedId, taggedId],
      });

      const tags = await getActivityTags(result.id as Id<"activities">);
      expect(tags).toHaveLength(1);
    });

    it("should not create tags for non-participants", async () => {
      const outsiderId = await createTestUser(t, {
        email: "outsider@example.com",
        username: "outsider",
      });

      const result = await logActivity({ taggedUserIds: [outsiderId] });

      const tags = await getActivityTags(result.id as Id<"activities">);
      expect(tags).toHaveLength(0);
    });

    it("should create tags for multiple users", async () => {
      const thirdUserId = await createTestUser(t, {
        email: "third@example.com",
        username: "thirduser",
      });
      await createTestParticipation(t, thirdUserId, challengeId);

      const result = await logActivity({
        taggedUserIds: [taggedId, thirdUserId],
      });

      const tags = await getActivityTags(result.id as Id<"activities">);
      expect(tags).toHaveLength(2);
      const ids = tags.map((t) => t.taggedUserId);
      expect(ids).toContain(taggedId);
      expect(ids).toContain(thirdUserId);
    });

    it("should work normally without taggedUserIds", async () => {
      const result = await logActivity();

      const tags = await getActivityTags(result.id as Id<"activities">);
      expect(tags).toHaveLength(0);
      expect(result.pointsEarned).toBe(10);
    });
  });

  // ── Notifications ──────────────────────────────────────────────────

  describe("tag notifications", () => {
    it("should notify tagged users", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });

      const notifications = await getNotifications(taggedId);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("activity_tag");
      expect(notifications[0].actorId).toBe(taggerId);
      expect(notifications[0].data.activityId).toBe(result.id);
      expect(notifications[0].data.challengeId).toBe(challengeId);
    });

    it("should not notify the tagger", async () => {
      await logActivity({ taggedUserIds: [taggerId] });

      const notifications = await getNotifications(taggerId);
      const tagNotifs = notifications.filter(
        (n) => n.type === "activity_tag",
      );
      expect(tagNotifs).toHaveLength(0);
    });
  });

  // ── Points (Tagged Users Should NOT Earn Points) ───────────────────

  describe("tagged users do not earn points", () => {
    it("should only award points to the activity logger, not tagged users", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });

      expect(result.pointsEarned).toBe(10);

      const taggedParticipation = await t.run(async (ctx) => {
        return await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", taggedId).eq("challengeId", challengeId),
          )
          .first();
      });
      expect(taggedParticipation!.totalPoints).toBe(0);
    });
  });

  // ── Dismiss / Remove Tags ──────────────────────────────────────────

  describe("dismiss tag", () => {
    it("should allow tagged user to dismiss from their feed", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await taggedAuth().mutation(api.mutations.activityTags.dismiss, {
        activityId,
      });

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(1);
      expect(tags[0].dismissedAt).toBeDefined();
      expect(tags[0].dismissedAt).toBeGreaterThan(0);
    });

    it("should fail for non-tagged user", async () => {
      const thirdUserId = await createTestUser(t, {
        email: "third@example.com",
        username: "thirduser",
      });
      await createTestParticipation(t, thirdUserId, challengeId);
      const thirdAuth = t.withIdentity({
        subject: thirdUserId,
        email: "third@example.com",
      });

      const result = await logActivity({ taggedUserIds: [taggedId] });

      await expect(
        thirdAuth.mutation(api.mutations.activityTags.dismiss, {
          activityId: result.id as Id<"activities">,
        }),
      ).rejects.toThrow("You are not tagged in this activity");
    });

    it("should be idempotent (dismissing twice is fine)", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await taggedAuth().mutation(api.mutations.activityTags.dismiss, {
        activityId,
      });
      const secondResult = await taggedAuth().mutation(
        api.mutations.activityTags.dismiss,
        { activityId },
      );
      expect(secondResult.success).toBe(true);
    });
  });

  describe("remove tag", () => {
    it("should allow activity owner to remove a tag", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await taggerAuth().mutation(api.mutations.activityTags.removeTag, {
        activityId,
        taggedUserId: taggedId,
      });

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(0);
    });

    it("should allow tagged user to remove their own tag", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await taggedAuth().mutation(api.mutations.activityTags.removeTag, {
        activityId,
        taggedUserId: taggedId,
      });

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(0);
    });

    it("should not allow third party to remove a tag", async () => {
      const thirdUserId = await createTestUser(t, {
        email: "third@example.com",
        username: "thirduser",
      });
      await createTestParticipation(t, thirdUserId, challengeId);
      const thirdAuth = t.withIdentity({
        subject: thirdUserId,
        email: "third@example.com",
      });

      const result = await logActivity({ taggedUserIds: [taggedId] });

      await expect(
        thirdAuth.mutation(api.mutations.activityTags.removeTag, {
          activityId: result.id as Id<"activities">,
          taggedUserId: taggedId,
        }),
      ).rejects.toThrow("You don't have permission to remove this tag");
    });
  });

  // ── Background Linking ─────────────────────────────────────────────

  describe("linkRelatedActivities background job", () => {
    it("should link related activity when tagged user has activity on same date", async () => {
      // Tagged user logs their own activity first
      const taggedActivityId = await t.run(async (ctx) =>
        insertTestActivity(ctx, {
          userId: taggedId,
          challengeId,
          activityTypeId,
          loggedDate: LOGGED_DATE_MS,
          pointsEarned: 10,
          metrics: {},
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal" as const,
          resolutionStatus: "pending" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      );

      // Tagger logs activity and tags the other user
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      // Manually run the background linking job
      await runLinkJob(activityId);

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(1);
      expect(tags[0].relatedActivityId).toBe(taggedActivityId);
    });

    it("should not link when tagged user has no activity on that date", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await runLinkJob(activityId);

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(1);
      expect(tags[0].relatedActivityId).toBeUndefined();
    });

    it("should not link to deleted activities", async () => {
      await t.run(async (ctx) =>
        insertTestActivity(ctx, {
          userId: taggedId,
          challengeId,
          activityTypeId,
          loggedDate: LOGGED_DATE_MS,
          pointsEarned: 10,
          metrics: {},
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal" as const,
          resolutionStatus: "pending" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        }),
      );

      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await runLinkJob(activityId);

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(1);
      expect(tags[0].relatedActivityId).toBeUndefined();
    });

    it("should not re-link already linked tags", async () => {
      const taggedActivityId = await t.run(async (ctx) =>
        insertTestActivity(ctx, {
          userId: taggedId,
          challengeId,
          activityTypeId,
          loggedDate: LOGGED_DATE_MS,
          pointsEarned: 10,
          metrics: {},
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal" as const,
          resolutionStatus: "pending" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      );

      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      // Run twice
      await runLinkJob(activityId);
      await runLinkJob(activityId);

      const tags = await getActivityTags(activityId);
      expect(tags).toHaveLength(1);
      expect(tags[0].relatedActivityId).toBe(taggedActivityId);
    });
  });

  // ── Feed Integration ───────────────────────────────────────────────

  describe("feed integration", () => {
    it("should include tag info in activity detail", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      const detail = await taggedAuth().query(
        api.queries.activities.getById,
        { activityId },
      );

      expect(detail).not.toBeNull();
      expect(detail!.taggedUsers).toHaveLength(1);
      expect(detail!.taggedUsers[0].username).toBe("tagged");
      expect(detail!.taggedYou).toBe(true);
    });

    it("should show taggedYou=false for non-tagged viewer", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      const detail = await taggerAuth().query(
        api.queries.activities.getById,
        { activityId },
      );

      expect(detail!.taggedYou).toBe(false);
      expect(detail!.taggedUsers).toHaveLength(1);
    });

    it("should not show taggedYou for dismissed tags", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await taggedAuth().mutation(api.mutations.activityTags.dismiss, {
        activityId,
      });

      const detail = await taggedAuth().query(
        api.queries.activities.getById,
        { activityId },
      );

      expect(detail!.taggedYou).toBe(false);
    });

    it("should include tagged activities in ranked feed for tagged user", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      const rankedIds = await taggedAuth().query(
        api.queries.algorithmicFeed.getRankedActivityIds,
        { challengeId },
      );

      const found = rankedIds.some((entry: any) => {
        const id = typeof entry === "string" ? entry : entry.id;
        return id === activityId;
      });
      expect(found).toBe(true);
    });

    it("should not show dismissed tagged activities as taggedYou in ranked feed", async () => {
      const result = await logActivity({ taggedUserIds: [taggedId] });
      const activityId = result.id as Id<"activities">;

      await taggedAuth().mutation(api.mutations.activityTags.dismiss, {
        activityId,
      });

      const rankedIds = await taggedAuth().query(
        api.queries.algorithmicFeed.getRankedActivityIds,
        { challengeId },
      );

      const entry = rankedIds.find((e: any) => {
        const id = typeof e === "string" ? e : e.id;
        return id === activityId;
      });

      // Activity is still in the feed (same challenge) but not marked as taggedYou
      if (typeof entry === "object" && entry !== null) {
        expect(entry.taggedYou).toBeFalsy();
      }
    });
  });

  // ── Feed Scoring Boost ─────────────────────────────────────────────

  describe("feed scoring with tags", () => {
    it("should boost feed score for tagged activities via recompute", async () => {
      const now = Date.now();

      // Create an untagged activity
      const untaggedId = await t.run(async (ctx) =>
        insertTestActivity(ctx, {
          userId: taggerId,
          challengeId,
          activityTypeId,
          loggedDate: now,
          pointsEarned: 10,
          metrics: {},
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal" as const,
          resolutionStatus: "pending" as const,
          createdAt: now,
          updatedAt: now,
          feedScore: 0,
          feedRank: 0,
        }),
      );

      // Create a tagged activity
      const taggedResult = await logActivity({ taggedUserIds: [taggedId] });
      const taggedActivityId = taggedResult.id as Id<"activities">;

      // Manually run the background job which recomputes feed score with tag boost
      await runLinkJob(taggedActivityId);

      // Compare feed scores
      const [untaggedActivity, taggedActivity] = await t.run(async (ctx) => {
        const u = await ctx.db.get(untaggedId);
        const ta = await ctx.db.get(taggedActivityId);
        return [u, ta];
      });

      // Tagged activity should have a higher feed score
      expect(taggedActivity!.feedScore).toBeGreaterThan(
        untaggedActivity!.feedScore ?? 0,
      );
    });
  });
});
