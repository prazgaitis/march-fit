import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestActivityType,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";

describe("Notifications", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  // Helper to get all notifications for a user
  async function getNotifications(userId: Id<"users">) {
    return t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();
    });
  }

  // ─── Invite Accepted ─────────────────────────────────────────────────

  describe("invite_accepted notification", () => {
    it("should notify the inviter when someone joins via invite code", async () => {
      const inviterEmail = "inviter@example.com";
      const joinerEmail = "joiner@example.com";

      const inviterId = await createTestUser(t, {
        email: inviterEmail,
        username: "inviter",
        name: "Inviter",
      });
      const joinerId = await createTestUser(t, {
        email: joinerEmail,
        username: "joiner",
        name: "Joiner",
      });

      const challengeId = await createTestChallenge(t, inviterId, {
        name: "Fitness Challenge",
      });

      // Create invite code for the inviter
      const inviteCode = await t.run(async (ctx) => {
        await ctx.db.insert("challengeInvites", {
          challengeId,
          userId: inviterId,
          code: "ABC123",
          createdAt: Date.now(),
        });
        return "ABC123";
      });

      const joinerAuth = t.withIdentity({
        subject: "joiner-subject",
        email: joinerEmail,
      });

      // Join via invite code
      await joinerAuth.mutation(api.mutations.participations.join, {
        challengeId,
        inviteCode,
      });

      // Inviter should get a notification
      const notifications = await getNotifications(inviterId);
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe("invite_accepted");
      expect(notifications[0].actorId).toBe(joinerId);
      expect(notifications[0].data.challengeId).toBe(challengeId);
      expect(notifications[0].data.challengeName).toBe("Fitness Challenge");
    });

    it("should notify the inviter when someone joins via invitedByUserId", async () => {
      const inviterEmail = "inviter@example.com";
      const joinerEmail = "joiner@example.com";

      const inviterId = await createTestUser(t, {
        email: inviterEmail,
        username: "inviter",
      });
      await createTestUser(t, {
        email: joinerEmail,
        username: "joiner",
      });

      const challengeId = await createTestChallenge(t, inviterId);

      const joinerAuth = t.withIdentity({
        subject: "joiner-subject",
        email: joinerEmail,
      });

      // Join with explicit invitedByUserId
      await joinerAuth.mutation(api.mutations.participations.join, {
        challengeId,
        invitedByUserId: inviterId,
      });

      const notifications = await getNotifications(inviterId);
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe("invite_accepted");
    });

    it("should NOT notify when joining without an invite", async () => {
      const creatorEmail = "creator@example.com";
      const joinerEmail = "joiner@example.com";

      const creatorId = await createTestUser(t, {
        email: creatorEmail,
        username: "creator",
      });
      await createTestUser(t, {
        email: joinerEmail,
        username: "joiner",
      });

      const challengeId = await createTestChallenge(t, creatorId);

      const joinerAuth = t.withIdentity({
        subject: "joiner-subject",
        email: joinerEmail,
      });

      // Join without invite
      await joinerAuth.mutation(api.mutations.participations.join, {
        challengeId,
      });

      // Creator should NOT get an invite_accepted notification
      const notifications = await getNotifications(creatorId);
      expect(notifications.length).toBe(0);
    });
  });

  // ─── Comment Notification ─────────────────────────────────────────────

  describe("comment notification", () => {
    async function setupCommentTest() {
      const ownerEmail = "owner@example.com";
      const commenterEmail = "commenter@example.com";

      const ownerId = await createTestUser(t, {
        email: ownerEmail,
        username: "owner",
        name: "Owner",
      });
      const commenterId = await createTestUser(t, {
        email: commenterEmail,
        username: "commenter",
        name: "Commenter",
      });

      const challengeId = await createTestChallenge(t, ownerId);
      const activityTypeId = await createTestActivityType(t, challengeId);

      await createTestParticipation(t, ownerId, challengeId);
      await createTestParticipation(t, commenterId, challengeId);

      const activityId = await t.run(async (ctx) => {
        return await insertTestActivity(ctx, {
          userId: ownerId,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: activityTypeId as Id<"activityTypes">,
          loggedDate: Date.now(),
          pointsEarned: 10,
          flagged: false,
          resolutionStatus: "pending",
          adminCommentVisibility: "internal",
          source: "manual",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const ownerAuth = t.withIdentity({
        subject: "owner-subject",
        email: ownerEmail,
      });
      const commenterAuth = t.withIdentity({
        subject: "commenter-subject",
        email: commenterEmail,
      });

      return {
        ownerId,
        commenterId,
        challengeId,
        activityId,
        ownerAuth,
        commenterAuth,
      };
    }

    it("should notify the activity owner when someone comments", async () => {
      const { ownerId, commenterId, activityId, commenterAuth } =
        await setupCommentTest();

      await commenterAuth.mutation(api.mutations.comments.create, {
        activityId,
        content: "Nice workout!",
      });

      const notifications = await getNotifications(ownerId);
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe("comment");
      expect(notifications[0].actorId).toBe(commenterId);
      expect(notifications[0].data.activityId).toBe(activityId);
    });

    it("should NOT notify when commenting on own activity", async () => {
      const { ownerId, activityId, ownerAuth } = await setupCommentTest();

      await ownerAuth.mutation(api.mutations.comments.create, {
        activityId,
        content: "My own comment on my own activity",
      });

      const notifications = await getNotifications(ownerId);
      expect(notifications.length).toBe(0);
    });

    it("should create multiple notifications for multiple comments", async () => {
      const { ownerId, activityId, commenterAuth } =
        await setupCommentTest();

      await commenterAuth.mutation(api.mutations.comments.create, {
        activityId,
        content: "First comment",
      });
      await commenterAuth.mutation(api.mutations.comments.create, {
        activityId,
        content: "Second comment",
      });

      const notifications = await getNotifications(ownerId);
      expect(notifications.length).toBe(2);
      expect(notifications.every((n) => n.type === "comment")).toBe(true);
    });
  });

  // ─── Like Notification ────────────────────────────────────────────────

  describe("like notification", () => {
    async function setupLikeTest() {
      const ownerEmail = "owner@example.com";
      const likerEmail = "liker@example.com";

      const ownerId = await createTestUser(t, {
        email: ownerEmail,
        username: "owner",
        name: "Owner",
      });
      const likerId = await createTestUser(t, {
        email: likerEmail,
        username: "liker",
        name: "Liker",
      });

      const challengeId = await createTestChallenge(t, ownerId);
      const activityTypeId = await createTestActivityType(t, challengeId);

      await createTestParticipation(t, ownerId, challengeId);
      await createTestParticipation(t, likerId, challengeId);

      const activityId = await t.run(async (ctx) => {
        return await insertTestActivity(ctx, {
          userId: ownerId,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: activityTypeId as Id<"activityTypes">,
          loggedDate: Date.now(),
          pointsEarned: 10,
          flagged: false,
          resolutionStatus: "pending",
          adminCommentVisibility: "internal",
          source: "manual",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const ownerAuth = t.withIdentity({
        subject: "owner-subject",
        email: ownerEmail,
      });
      const likerAuth = t.withIdentity({
        subject: "liker-subject",
        email: likerEmail,
      });

      return {
        ownerId,
        likerId,
        challengeId,
        activityId,
        ownerAuth,
        likerAuth,
      };
    }

    it("should notify the activity owner when someone likes their activity", async () => {
      const { ownerId, likerId, activityId, likerAuth } =
        await setupLikeTest();

      await likerAuth.mutation(api.mutations.likes.toggle, {
        activityId,
      });

      const notifications = await getNotifications(ownerId);
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe("like");
      expect(notifications[0].actorId).toBe(likerId);
      expect(notifications[0].data.activityId).toBe(activityId);
    });

    it("should NOT notify when liking own activity", async () => {
      const { ownerId, activityId, ownerAuth } = await setupLikeTest();

      await ownerAuth.mutation(api.mutations.likes.toggle, {
        activityId,
      });

      const notifications = await getNotifications(ownerId);
      expect(notifications.length).toBe(0);
    });

    it("should NOT create a notification when unliking", async () => {
      const { ownerId, activityId, likerAuth } = await setupLikeTest();

      // Like
      await likerAuth.mutation(api.mutations.likes.toggle, { activityId });

      // Unlike
      await likerAuth.mutation(api.mutations.likes.toggle, { activityId });

      // Should only have the 1 notification from the initial like
      const notifications = await getNotifications(ownerId);
      expect(notifications.length).toBe(1);
    });
  });
});
