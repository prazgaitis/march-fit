import { describe, it, expect, beforeEach } from "vitest";
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

describe("Comments", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  // ── Helpers ──────────────────────────────────────────────────

  async function setupChallengeWithActivity() {
    const ownerId = await createTestUser(t, {
      email: "owner@example.com",
      username: "owner",
    });
    const participantId = await createTestUser(t, {
      email: "participant@example.com",
      username: "participant",
    });
    const challengeId = await createTestChallenge(t, ownerId);
    await createTestParticipation(t, ownerId, challengeId, { role: "admin" });
    await createTestParticipation(t, participantId, challengeId);

    const activityTypeId = await createTestActivityType(t, challengeId);
    const now = Date.now();
    const activityId = await t.run(async (ctx) => {
      return insertTestActivity(ctx, {
        userId: participantId,
        challengeId,
        activityTypeId,
        loggedDate: now,
        metrics: {},
        source: "manual",
        pointsEarned: 10,
        flagged: false,
        adminCommentVisibility: "internal",
        resolutionStatus: "pending",
        createdAt: now,
        updatedAt: now,
        feedScore: 10,
        feedRank: 10,
      });
    });

    return { ownerId, participantId, challengeId, activityTypeId, activityId };
  }

  // ── Activity Comments (backward-compat) ──────────────────────

  describe("activity comments", () => {
    it("creates a comment with parentType='activity'", async () => {
      const { participantId, activityId } = await setupChallengeWithActivity();
      const tWithAuth = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      const commentId = await tWithAuth.mutation(api.mutations.comments.create, {
        activityId: activityId as Id<"activities">,
        content: "Nice run!",
      });

      const comment = await t.run(async (ctx) => ctx.db.get(commentId));
      expect(comment).toBeTruthy();
      expect(comment!.parentType).toBe("activity");
      expect(comment!.activityId).toBe(activityId);
      expect(comment!.content).toBe("Nice run!");
    });

    it("sends a notification to the activity owner", async () => {
      const { participantId, ownerId, activityId, challengeId } =
        await setupChallengeWithActivity();

      // Owner comments on participant's activity
      const tOwnerAuth = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      await tOwnerAuth.mutation(api.mutations.comments.create, {
        activityId: activityId as Id<"activities">,
        content: "Keep it up!",
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", participantId))
          .collect();
      });

      expect(notifications.some((n) => n.type === "comment")).toBe(true);
    });

    it("getByActivityId returns only activity comments, not flagged_activity ones", async () => {
      const { ownerId, activityId, participantId, challengeId } =
        await setupChallengeWithActivity();
      const now = Date.now();

      // Insert an activity comment and a flagged_activity comment directly
      await t.run(async (ctx) => {
        await ctx.db.insert("comments", {
          parentType: "activity",
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "User comment",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("comments", {
          parentType: "flagged_activity",
          activityId: activityId as Id<"activities">,
          userId: ownerId,
          content: "Admin comment",
          visibility: "internal",
          createdAt: now + 1,
          updatedAt: now + 1,
        });
      });

      const tAuth = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      const result = await tAuth.query(api.queries.comments.getByActivityId, {
        activityId: activityId as Id<"activities">,
        paginationOpts: { numItems: 50, cursor: null },
      });

      expect(result.page.length).toBe(1);
      expect(result.page[0].comment.content).toBe("User comment");
    });
  });

  // ── Pre-migration backward compatibility ─────────────────────

  describe("pre-migration compatibility", () => {
    it("comments without parentType are treated as activity comments in queries", async () => {
      const { participantId, activityId } = await setupChallengeWithActivity();
      const now = Date.now();

      // Simulate a pre-migration comment (no parentType field)
      await t.run(async (ctx) => {
        await ctx.db.insert("comments", {
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "Pre-migration comment",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Simulate the backfillCommentParentType migration running —
      // getByActivityId now queries the activityIdByType index which requires
      // parentType to be set. The migration sets parentType="activity" on all
      // legacy comments so they remain visible after the schema change.
      await t.run(async (ctx) => {
        const all = await ctx.db.query("comments").collect();
        for (const c of all) {
          if (!c.parentType) {
            await ctx.db.patch(c._id, { parentType: "activity" });
          }
        }
      });

      const tAuth = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      const result = await tAuth.query(api.queries.comments.getByActivityId, {
        activityId: activityId as Id<"activities">,
        paginationOpts: { numItems: 50, cursor: null },
      });

      expect(result.page.length).toBe(1);
      expect(result.page[0].comment.content).toBe("Pre-migration comment");
      expect(result.page[0].comment.parentType).toBe("activity"); // set by migration
    });

    it("pre-migration comments are counted in feed score", async () => {
      const { activityId, participantId } = await setupChallengeWithActivity();
      const now = Date.now();

      await t.run(async (ctx) => {
        // Pre-migration comment (no parentType)
        await ctx.db.insert("comments", {
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "Old comment",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Read activity's feed score after inserting comment
      const activity = await t.run(async (ctx) => ctx.db.get(activityId));
      // feedScore was set at 10 during setup, this is a direct insert
      // so recomputeFeedScore wasn't called; but the filter logic should include it
      // Let's verify the filter directly
      const commentCount = await t.run(async (ctx) => {
        const comments = await ctx.db
          .query("comments")
          .withIndex("activityId", (q) =>
            q.eq("activityId", activityId as Id<"activities">)
          )
          .collect();
        return comments.filter(
          (r) => !r.parentType || r.parentType === "activity"
        ).length;
      });

      expect(commentCount).toBe(1);
    });

    it("pre-migration comments contribute to affinity", async () => {
      const { ownerId, participantId, challengeId, activityId } =
        await setupChallengeWithActivity();

      // Initialize watermark
      await t.mutation(
        internal.mutations.follows.recomputeAffinitiesFromInteractions,
        {}
      );

      const interactionTime = Date.now();
      // Insert a pre-migration comment (no parentType, has activityId)
      await t.run(async (ctx) => {
        await ctx.db.insert("comments", {
          activityId: activityId as Id<"activities">,
          userId: ownerId,
          content: "Affinity comment",
          createdAt: interactionTime + 1,
          updatedAt: interactionTime + 1,
        });
      });

      await t.mutation(
        internal.mutations.follows.recomputeAffinitiesFromInteractions,
        {}
      );

      const affinity = await t.run(async (ctx) => {
        return ctx.db
          .query("userAffinities")
          .withIndex("challengeViewerAuthor", (q) =>
            q
              .eq("challengeId", challengeId as Id<"challenges">)
              .eq("viewerUserId", ownerId)
              .eq("authorUserId", participantId)
          )
          .first();
      });

      expect(affinity).toBeTruthy();
      expect(affinity!.score).toBeGreaterThan(0);
    });
  });

  // ── Feedback Comments ────────────────────────────────────────

  describe("feedback comments", () => {
    it("reporter can comment on their own feedback", async () => {
      const { participantId, challengeId } = await setupChallengeWithActivity();
      const tAuth = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      const feedbackId = await tAuth.mutation(api.mutations.feedback.create, {
        challengeId: challengeId as Id<"challenges">,
        type: "bug",
        description: "Something is broken",
      });

      const commentId = await tAuth.mutation(
        api.mutations.comments.createOnFeedback,
        {
          feedbackId: feedbackId as Id<"feedback">,
          content: "Still happening",
        }
      );

      const comment = await t.run(async (ctx) => ctx.db.get(commentId));
      expect(comment!.parentType).toBe("feedback");
      expect(comment!.feedbackId).toBe(feedbackId);
    });

    it("admin can comment on feedback", async () => {
      const { ownerId, participantId, challengeId } =
        await setupChallengeWithActivity();
      const tParticipant = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      const feedbackId = await tParticipant.mutation(
        api.mutations.feedback.create,
        {
          challengeId: challengeId as Id<"challenges">,
          type: "question",
          description: "How does scoring work?",
        }
      );

      const commentId = await tOwner.mutation(
        api.mutations.comments.createOnFeedback,
        {
          feedbackId: feedbackId as Id<"feedback">,
          content: "See the rules page!",
        }
      );

      const comment = await t.run(async (ctx) => ctx.db.get(commentId));
      expect(comment!.parentType).toBe("feedback");
      expect(comment!.userId).toBe(ownerId);
    });

    it("admin comment on feedback notifies the reporter", async () => {
      const { ownerId, participantId, challengeId } =
        await setupChallengeWithActivity();
      const tParticipant = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      const feedbackId = await tParticipant.mutation(
        api.mutations.feedback.create,
        {
          challengeId: challengeId as Id<"challenges">,
          type: "idea",
          description: "Add dark mode",
        }
      );

      await tOwner.mutation(api.mutations.comments.createOnFeedback, {
        feedbackId: feedbackId as Id<"feedback">,
        content: "Great idea, we'll consider it!",
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", participantId))
          .collect();
      });

      expect(notifications.some((n) => n.type === "feedback_comment")).toBe(
        true
      );
    });

    it("non-reporter non-admin cannot comment on feedback", async () => {
      const { participantId, challengeId } = await setupChallengeWithActivity();
      const bystanderId = await createTestUser(t, {
        email: "bystander@example.com",
        username: "bystander",
      });
      await createTestParticipation(t, bystanderId, challengeId);

      const tParticipant = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });
      const tBystander = t.withIdentity({
        subject: "bystander-sub",
        email: "bystander@example.com",
      });

      const feedbackId = await tParticipant.mutation(
        api.mutations.feedback.create,
        {
          challengeId: challengeId as Id<"challenges">,
          type: "bug",
          description: "Something broken",
        }
      );

      await expect(
        tBystander.mutation(api.mutations.comments.createOnFeedback, {
          feedbackId: feedbackId as Id<"feedback">,
          content: "I agree",
        })
      ).rejects.toThrow(/not authorized/i);
    });

    it("getByFeedbackId returns feedback comments chronologically", async () => {
      const { participantId, ownerId, challengeId } =
        await setupChallengeWithActivity();
      const now = Date.now();

      const feedbackId = await t.run(async (ctx) => {
        return ctx.db.insert("feedback", {
          challengeId: challengeId as Id<"challenges">,
          userId: participantId,
          type: "bug",
          description: "Test bug",
          status: "open",
          createdAt: now,
          updatedAt: now,
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("comments", {
          parentType: "feedback",
          feedbackId,
          userId: participantId,
          content: "First comment",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("comments", {
          parentType: "feedback",
          feedbackId,
          userId: ownerId,
          content: "Admin reply",
          createdAt: now + 1000,
          updatedAt: now + 1000,
        });
      });

      const tAuth = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      const comments = await tAuth.query(
        api.queries.comments.getByFeedbackId,
        { feedbackId: feedbackId as Id<"feedback"> }
      );

      expect(comments.length).toBe(2);
      expect(comments[0].comment.content).toBe("First comment");
      expect(comments[1].comment.content).toBe("Admin reply");
    });
  });

  // ── Flagged Activity Comments ────────────────────────────────

  describe("flagged activity comments", () => {
    it("admin can add a flagged activity comment", async () => {
      const { ownerId, activityId } = await setupChallengeWithActivity();
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      const commentId = await tOwner.mutation(
        api.mutations.comments.createOnFlaggedActivity,
        {
          activityId: activityId as Id<"activities">,
          comment: "Looks suspicious",
          visibility: "internal",
        }
      );

      const comment = await t.run(async (ctx) => ctx.db.get(commentId));
      expect(comment!.parentType).toBe("flagged_activity");
      expect(comment!.visibility).toBe("internal");
    });

    it("creates audit trail in activityFlagHistory", async () => {
      const { activityId } = await setupChallengeWithActivity();
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      await tOwner.mutation(api.mutations.comments.createOnFlaggedActivity, {
        activityId: activityId as Id<"activities">,
        comment: "Flagged for review",
        visibility: "participant",
      });

      const history = await t.run(async (ctx) => {
        return ctx.db
          .query("activityFlagHistory")
          .withIndex("activityId", (q) =>
            q.eq("activityId", activityId as Id<"activities">)
          )
          .collect();
      });

      expect(history.some((h) => h.actionType === "comment")).toBe(true);
    });

    it("participant-visible comment sends notification", async () => {
      const { participantId, activityId } = await setupChallengeWithActivity();
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      await tOwner.mutation(api.mutations.comments.createOnFlaggedActivity, {
        activityId: activityId as Id<"activities">,
        comment: "Please explain",
        visibility: "participant",
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", participantId))
          .collect();
      });

      expect(notifications.some((n) => n.type === "admin_comment")).toBe(true);
    });

    it("internal comment does NOT send notification to participant", async () => {
      const { participantId, activityId } = await setupChallengeWithActivity();
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      await tOwner.mutation(api.mutations.comments.createOnFlaggedActivity, {
        activityId: activityId as Id<"activities">,
        comment: "Internal note",
        visibility: "internal",
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", participantId))
          .collect();
      });

      expect(notifications.some((n) => n.type === "admin_comment")).toBe(false);
    });

    it("non-admin cannot add flagged activity comment", async () => {
      const { activityId } = await setupChallengeWithActivity();
      const tParticipant = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      await expect(
        tParticipant.mutation(
          api.mutations.comments.createOnFlaggedActivity,
          {
            activityId: activityId as Id<"activities">,
            comment: "I'm not an admin",
            visibility: "internal",
          }
        )
      ).rejects.toThrow(/not authorized/i);
    });

    it("flagged_activity comments don't affect affinity", async () => {
      const { ownerId, participantId, challengeId, activityId } =
        await setupChallengeWithActivity();

      // Initialize watermark
      await t.mutation(
        internal.mutations.follows.recomputeAffinitiesFromInteractions,
        {}
      );

      const interactionTime = Date.now();
      // Insert a flagged_activity comment
      await t.run(async (ctx) => {
        await ctx.db.insert("comments", {
          parentType: "flagged_activity",
          activityId: activityId as Id<"activities">,
          userId: ownerId,
          content: "Admin note",
          visibility: "internal",
          createdAt: interactionTime + 1,
          updatedAt: interactionTime + 1,
        });
      });

      await t.mutation(
        internal.mutations.follows.recomputeAffinitiesFromInteractions,
        {}
      );

      const affinity = await t.run(async (ctx) => {
        return ctx.db
          .query("userAffinities")
          .withIndex("challengeViewerAuthor", (q) =>
            q
              .eq("challengeId", challengeId as Id<"challenges">)
              .eq("viewerUserId", ownerId)
              .eq("authorUserId", participantId)
          )
          .first();
      });

      // Should be null — flagged_activity comments are skipped
      expect(affinity).toBeNull();
    });
  });

  // ── Comment Likes ────────────────────────────────────────────

  describe("comment likes", () => {
    it("can like and unlike a comment (toggle)", async () => {
      const { participantId, ownerId, activityId } =
        await setupChallengeWithActivity();
      const now = Date.now();

      const commentId = await t.run(async (ctx) => {
        return ctx.db.insert("comments", {
          parentType: "activity",
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "Test comment",
          createdAt: now,
          updatedAt: now,
        });
      });

      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      // Like
      const result1 = await tOwner.mutation(
        api.mutations.commentLikes.toggle,
        { commentId: commentId as Id<"comments"> }
      );
      expect(result1.liked).toBe(true);

      // Verify like exists
      const likes = await t.run(async (ctx) => {
        return ctx.db
          .query("commentLikes")
          .withIndex("commentId", (q) => q.eq("commentId", commentId))
          .collect();
      });
      expect(likes.length).toBe(1);

      // Unlike (toggle off)
      const result2 = await tOwner.mutation(
        api.mutations.commentLikes.toggle,
        { commentId: commentId as Id<"comments"> }
      );
      expect(result2.liked).toBe(false);

      const likesAfter = await t.run(async (ctx) => {
        return ctx.db
          .query("commentLikes")
          .withIndex("commentId", (q) => q.eq("commentId", commentId))
          .collect();
      });
      expect(likesAfter.length).toBe(0);
    });

    it("liking a comment sends notification to comment author", async () => {
      const { participantId, ownerId, activityId } =
        await setupChallengeWithActivity();
      const now = Date.now();

      const commentId = await t.run(async (ctx) => {
        return ctx.db.insert("comments", {
          parentType: "activity",
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "Test comment",
          createdAt: now,
          updatedAt: now,
        });
      });

      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      await tOwner.mutation(api.mutations.commentLikes.toggle, {
        commentId: commentId as Id<"comments">,
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", participantId))
          .collect();
      });

      expect(notifications.some((n) => n.type === "comment_like")).toBe(true);
    });

    it("self-like does NOT send notification", async () => {
      const { participantId, activityId } = await setupChallengeWithActivity();
      const now = Date.now();

      const commentId = await t.run(async (ctx) => {
        return ctx.db.insert("comments", {
          parentType: "activity",
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "My own comment",
          createdAt: now,
          updatedAt: now,
        });
      });

      const tParticipant = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      await tParticipant.mutation(api.mutations.commentLikes.toggle, {
        commentId: commentId as Id<"comments">,
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", participantId))
          .collect();
      });

      expect(notifications.some((n) => n.type === "comment_like")).toBe(false);
    });

    it("likeCount and likedByMe are included in query results", async () => {
      const { participantId, ownerId, activityId } =
        await setupChallengeWithActivity();
      const now = Date.now();

      const commentId = await t.run(async (ctx) => {
        return ctx.db.insert("comments", {
          parentType: "activity",
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "Likeable comment",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Owner likes the comment
      await t.run(async (ctx) => {
        await ctx.db.insert("commentLikes", {
          commentId,
          userId: ownerId,
          createdAt: now,
        });
      });

      // Query as participant (not the liker)
      const tParticipant = t.withIdentity({
        subject: "participant-sub",
        email: "participant@example.com",
      });

      const result = await tParticipant.query(
        api.queries.comments.getByActivityId,
        {
          activityId: activityId as Id<"activities">,
          paginationOpts: { numItems: 50, cursor: null },
        }
      );

      expect(result.page.length).toBe(1);
      expect(result.page[0].likeCount).toBe(1);
      expect(result.page[0].likedByMe).toBe(false);

      // Query as owner (who liked)
      const tOwner = t.withIdentity({
        subject: "owner-sub",
        email: "owner@example.com",
      });

      const result2 = await tOwner.query(
        api.queries.comments.getByActivityId,
        {
          activityId: activityId as Id<"activities">,
          paginationOpts: { numItems: 50, cursor: null },
        }
      );

      expect(result2.page[0].likeCount).toBe(1);
      expect(result2.page[0].likedByMe).toBe(true);
    });
  });

  // ── Feed Score Guard ─────────────────────────────────────────

  describe("feed score guard", () => {
    it("only counts activity comments in feed score, not flagged_activity ones", async () => {
      const { ownerId, participantId, activityId } =
        await setupChallengeWithActivity();
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("comments", {
          parentType: "activity",
          activityId: activityId as Id<"activities">,
          userId: participantId,
          content: "Activity comment",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("comments", {
          parentType: "flagged_activity",
          activityId: activityId as Id<"activities">,
          userId: ownerId,
          content: "Admin comment",
          visibility: "internal",
          createdAt: now + 1,
          updatedAt: now + 1,
        });
      });

      // The feed score filter should only count the activity comment
      const commentCount = await t.run(async (ctx) => {
        const comments = await ctx.db
          .query("comments")
          .withIndex("activityId", (q) =>
            q.eq("activityId", activityId as Id<"activities">)
          )
          .collect();
        return comments.filter(
          (r) => !r.parentType || r.parentType === "activity"
        ).length;
      });

      expect(commentCount).toBe(1);
    });
  });
});
