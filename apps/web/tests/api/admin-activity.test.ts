import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { Id } from '@repo/backend/_generated/dataModel';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

describe('Admin Activity Features', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  // Shared setup helper
  const setupAdminTest = async () => {
    const adminEmail = "admin@example.com";
    const ownerEmail = "owner@example.com";
    const otherEmail = "other@example.com";

    const adminId = await createTestUser(t, {
      email: adminEmail,
      name: "Admin",
      username: "admin",
      role: "admin",
    });
    const ownerId = await createTestUser(t, {
      email: ownerEmail,
      name: "Owner",
      username: "owner",
      role: "user",
    });
    const otherId = await createTestUser(t, {
      email: otherEmail,
      name: "Other",
      username: "other",
      role: "user",
    });

    const challengeId = await createTestChallenge(t, adminId);

    // Create participations
    await t.run(async (ctx) => {
      for (const userId of [adminId, ownerId, otherId]) {
        await ctx.db.insert("userChallenges", {
          userId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      }
    });

    const activityTypeId = await t.run(async (ctx) => {
      return await ctx.db.insert("activityTypes", {
        challengeId,
        name: "Running",
        scoringConfig: { unit: "minutes", pointsPerUnit: 1, basePoints: 5 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const activityTypeId2 = await t.run(async (ctx) => {
      return await ctx.db.insert("activityTypes", {
        challengeId,
        name: "Swimming",
        scoringConfig: { unit: "minutes", pointsPerUnit: 2, basePoints: 10 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Create an activity owned by "owner"
    const activityId = await t.run(async (ctx) => {
      return await ctx.db.insert("activities", {
        userId: ownerId,
        challengeId,
        activityTypeId,
        loggedDate: Date.now(),
        pointsEarned: 35,
        flagged: false,
        resolutionStatus: "pending",
        adminCommentVisibility: "internal",
        source: "manual",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const adminAuth = t.withIdentity({ subject: "admin-subject", email: adminEmail });
    const ownerAuth = t.withIdentity({ subject: "owner-subject", email: ownerEmail });
    const otherAuth = t.withIdentity({ subject: "other-subject", email: otherEmail });

    return {
      adminId,
      ownerId,
      otherId,
      challengeId,
      activityTypeId,
      activityTypeId2,
      activityId,
      adminAuth,
      ownerAuth,
      otherAuth,
    };
  };

  describe('getById viewer context', () => {
    it('should return isOwner: true for activity owner', async () => {
      const { activityId, ownerAuth } = await setupAdminTest();

      const result = await ownerAuth.query(api.queries.activities.getById, {
        activityId,
      });

      expect(result).not.toBeNull();
      expect(result!.isOwner).toBe(true);
      expect(result!.isAdmin).toBe(false);
    });

    it('should return isAdmin: true for admin users', async () => {
      const { activityId, adminAuth } = await setupAdminTest();

      const result = await adminAuth.query(api.queries.activities.getById, {
        activityId,
      });

      expect(result).not.toBeNull();
      expect(result!.isAdmin).toBe(true);
      expect(result!.isOwner).toBe(false);
    });

    it('should return isOwner: false and isAdmin: false for other users', async () => {
      const { activityId, otherAuth } = await setupAdminTest();

      const result = await otherAuth.query(api.queries.activities.getById, {
        activityId,
      });

      expect(result).not.toBeNull();
      expect(result!.isOwner).toBe(false);
      expect(result!.isAdmin).toBe(false);
    });
  });

  describe('admin comment visibility via getById', () => {
    it('should show participant-visible comment to everyone', async () => {
      const { activityId, adminAuth, ownerAuth, otherAuth } = await setupAdminTest();

      // Add participant-visible comment
      await adminAuth.mutation(api.mutations.admin.addAdminComment, {
        activityId,
        comment: "Please update your activity type.",
        visibility: "participant",
      });

      // Owner sees it
      const ownerResult = await ownerAuth.query(api.queries.activities.getById, { activityId });
      expect(ownerResult!.adminComment).toBe("Please update your activity type.");

      // Other user sees it too (participant visibility)
      const otherResult = await otherAuth.query(api.queries.activities.getById, { activityId });
      expect(otherResult!.adminComment).toBe("Please update your activity type.");

      // Admin sees it
      const adminResult = await adminAuth.query(api.queries.activities.getById, { activityId });
      expect(adminResult!.adminComment).toBe("Please update your activity type.");
    });

    it('should hide internal comment from non-owner non-admin users', async () => {
      const { activityId, adminAuth, otherAuth } = await setupAdminTest();

      // Add internal comment
      await adminAuth.mutation(api.mutations.admin.addAdminComment, {
        activityId,
        comment: "Suspicious activity, investigating.",
        visibility: "internal",
      });

      // Other user should NOT see it
      const otherResult = await otherAuth.query(api.queries.activities.getById, { activityId });
      expect(otherResult!.adminComment).toBeNull();
    });

    it('should show internal comment to the activity owner', async () => {
      const { activityId, adminAuth, ownerAuth } = await setupAdminTest();

      // Add internal comment
      await adminAuth.mutation(api.mutations.admin.addAdminComment, {
        activityId,
        comment: "Internal review note.",
        visibility: "internal",
      });

      // Owner should see it
      const ownerResult = await ownerAuth.query(api.queries.activities.getById, { activityId });
      expect(ownerResult!.adminComment).toBe("Internal review note.");
    });

    it('should show internal comment to admins', async () => {
      const { activityId, adminAuth } = await setupAdminTest();

      // Add internal comment
      await adminAuth.mutation(api.mutations.admin.addAdminComment, {
        activityId,
        comment: "Admin-only note.",
        visibility: "internal",
      });

      // Admin should see it
      const adminResult = await adminAuth.query(api.queries.activities.getById, { activityId });
      expect(adminResult!.adminComment).toBe("Admin-only note.");
    });

    it('should create notification only for participant-visible comments', async () => {
      const { activityId, ownerId, adminAuth } = await setupAdminTest();

      // Internal comment — no notification
      await adminAuth.mutation(api.mutations.admin.addAdminComment, {
        activityId,
        comment: "Internal note",
        visibility: "internal",
      });

      let notifications = await t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", ownerId))
          .collect();
      });
      expect(notifications.length).toBe(0);

      // Participant comment — notification created
      await adminAuth.mutation(api.mutations.admin.addAdminComment, {
        activityId,
        comment: "Please check this",
        visibility: "participant",
      });

      notifications = await t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", ownerId))
          .collect();
      });
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe("admin_comment");
    });
  });

  describe('adminEditActivity', () => {
    it('should reject non-admin users', async () => {
      const { activityId, otherAuth } = await setupAdminTest();

      await expect(
        otherAuth.mutation(api.mutations.admin.adminEditActivity, {
          activityId,
          pointsEarned: 100,
        })
      ).rejects.toThrow("Not authorized");
    });

    it('should update activity type and track the change', async () => {
      const { activityId, activityTypeId2, adminAuth } = await setupAdminTest();

      await adminAuth.mutation(api.mutations.admin.adminEditActivity, {
        activityId,
        activityTypeId: activityTypeId2,
      });

      // Verify update
      const activity = await t.run(async (ctx) => {
        return await ctx.db.get(activityId);
      });
      expect(activity!.activityTypeId).toBe(activityTypeId2);

      // Verify history
      const history = await t.run(async (ctx) => {
        return await ctx.db
          .query("activityFlagHistory")
          .withIndex("activityId", (q) => q.eq("activityId", activityId))
          .collect();
      });
      expect(history.length).toBe(1);
      expect(history[0].actionType).toBe("edit");
      expect((history[0].payload as any).activityTypeId).toBeDefined();
    });

    it('should reject activity type from different challenge', async () => {
      const { activityId, adminAuth, adminId } = await setupAdminTest();

      // Create another challenge and activity type
      const otherChallengeId = await createTestChallenge(t, adminId, { name: "Other Challenge" });
      const otherTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId: otherChallengeId,
          name: "Yoga",
          scoringConfig: { unit: "minutes", pointsPerUnit: 1, basePoints: 0 },
          contributesToStreak: false,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        adminAuth.mutation(api.mutations.admin.adminEditActivity, {
          activityId,
          activityTypeId: otherTypeId,
        })
      ).rejects.toThrow("Activity type not found or does not belong to this challenge");
    });

    it('should update points and adjust participation total', async () => {
      const { activityId, ownerId, challengeId, adminAuth } = await setupAdminTest();

      await adminAuth.mutation(api.mutations.admin.adminEditActivity, {
        activityId,
        pointsEarned: 50,
      });

      // Activity should have new points
      const activity = await t.run(async (ctx) => {
        return await ctx.db.get(activityId);
      });
      expect(activity!.pointsEarned).toBe(50);

      // Participation total should reflect the diff (+15 from 35 to 50)
      const participation = await t.run(async (ctx) => {
        return await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", ownerId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.totalPoints).toBe(15); // was 0, diff is 50-35=15
    });

    it('should send notification on edit', async () => {
      const { activityId, ownerId, adminAuth } = await setupAdminTest();

      await adminAuth.mutation(api.mutations.admin.adminEditActivity, {
        activityId,
        notes: "Updated by admin",
      });

      const notifications = await t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("userId", (q) => q.eq("userId", ownerId))
          .collect();
      });
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe("admin_edit");
    });

    it('should recompute streak when admin changes points on a past day', async () => {
      const { ownerAuth, ownerId, challengeId, activityTypeId, activityId, adminAuth } = await setupAdminTest();

      // Remove setup's default "today" activity so it doesn't break the 3-day streak window.
      await t.run(async (ctx) => {
        await ctx.db.patch(activityId, {
          deletedAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Build a 3-day streak.
      await ownerAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-15',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      const day2 = await ownerAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-16',
        metrics: { minutes: 15 },
        source: 'manual',
      });
      await ownerAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: '2024-01-17',
        metrics: { minutes: 15 },
        source: 'manual',
      });

      let participation = await t.run(async (ctx) => {
        return await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", ownerId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.currentStreak).toBe(3);

      // Break day 2 threshold and ensure streak is recomputed.
      await adminAuth.mutation(api.mutations.admin.adminEditActivity, {
        activityId: day2.id as Id<"activities">,
        pointsEarned: 0,
      });

      participation = await t.run(async (ctx) => {
        return await ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", ownerId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.currentStreak).toBe(1);
    });
  });
});
