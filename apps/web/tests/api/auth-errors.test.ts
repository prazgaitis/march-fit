/**
 * Tests that mutations in follows, comments, and challenges throw a structured
 * ConvexError({ code: "unauthenticated" }) when called without a valid session,
 * rather than a generic Error("Not authenticated").
 *
 * The structured error lets clients detect session expiry and offer a recovery
 * path (e.g. "Sign in again") instead of showing a cryptic error string.
 *
 * Related: PR #131 applied the same fix to mutations/activities.ts.
 * Sentry issues: 7303431341 (challenges), 7303424900 (follows), 7303708102 (comments)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestActivityType,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";
import type { Id } from "@repo/backend/_generated/dataModel";

// Helper to assert a ConvexError with code "unauthenticated" is thrown
async function expectUnauthenticated(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("Expected mutation to throw, but it resolved");
  } catch (err) {
    // convex-test wraps errors; ConvexError data is accessible via .data
    expect(err).toBeDefined();
    const errorData =
      typeof err === "object" && err !== null && "data" in err
        ? (err as { data?: unknown }).data
        : undefined;

    const parsedErrorData =
      typeof errorData === "string"
        ? (JSON.parse(errorData) as Record<string, unknown>)
        : errorData;

    expect(parsedErrorData).toMatchObject({
      code: "unauthenticated",
    });
  }
}

describe("Unauthenticated mutation errors", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  // ──────────────────────────────────────────────
  // follows
  // ──────────────────────────────────────────────
  describe("mutations/follows", () => {
    it("follow throws structured unauthenticated error when not signed in", async () => {
      const targetUserId = await createTestUser(t, {
        email: "target@example.com",
        username: "targetuser",
      });

      await expectUnauthenticated(
        t.mutation(api.mutations.follows.follow, { userId: targetUserId })
      );
    });

    it("unfollow throws structured unauthenticated error when not signed in", async () => {
      const targetUserId = await createTestUser(t, {
        email: "target2@example.com",
        username: "targetuser2",
      });

      await expectUnauthenticated(
        t.mutation(api.mutations.follows.unfollow, { userId: targetUserId })
      );
    });

    it("toggle throws structured unauthenticated error when not signed in", async () => {
      const targetUserId = await createTestUser(t, {
        email: "target3@example.com",
        username: "targetuser3",
      });

      await expectUnauthenticated(
        t.mutation(api.mutations.follows.toggle, { userId: targetUserId })
      );
    });

    it("follow succeeds when authenticated", async () => {
      const actorEmail = "actor@example.com";
      const actor = await createTestUser(t, {
        email: actorEmail,
        username: "actor",
      });
      const target = await createTestUser(t, {
        email: "target-auth@example.com",
        username: "targetauth",
      });

      const authed = t.withIdentity({ subject: actor, email: actorEmail });
      const result = await authed.mutation(api.mutations.follows.follow, {
        userId: target,
      });
      expect(result.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // comments
  // ──────────────────────────────────────────────
  describe("mutations/comments", () => {
    it("create throws structured unauthenticated error when not signed in", async () => {
      // Create a real activity so the arg validator passes; auth check runs first in handler
      const ownerId = await createTestUser(t, {
        email: "owner@example.com",
        username: "owner",
      });
      const challengeId = await createTestChallenge(t, ownerId);
      await createTestParticipation(t, ownerId, challengeId);
      const activityTypeId = await createTestActivityType(t, challengeId);
      const activityId = await t.run(async (ctx) =>
        insertTestActivity(ctx, {
          userId: ownerId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: activityTypeId as Id<"activityTypes">,
          pointsEarned: 10,
          loggedDate: Date.now(),
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      );

      await expectUnauthenticated(
        t.mutation(api.mutations.comments.create, {
          activityId,
          content: "hello",
        })
      );
    });

    it("create succeeds when authenticated and activity exists", async () => {
      const email = "commenter@example.com";
      const userId = await createTestUser(t, { email, username: "commenter" });
      const challengeId = await createTestChallenge(t, userId);
      await createTestParticipation(t, userId, challengeId);
      const activityTypeId = await createTestActivityType(t, challengeId);
      const activityId = await t.run(async (ctx) =>
        insertTestActivity(ctx, {
          userId: userId as Id<"users">,
          challengeId: challengeId as Id<"challenges">,
          activityTypeId: activityTypeId as Id<"activityTypes">,
          pointsEarned: 10,
          loggedDate: Date.now(),
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      );

      const authed = t.withIdentity({ subject: userId, email });
      const commentId = await authed.mutation(api.mutations.comments.create, {
        activityId,
        content: "Great job!",
      });
      expect(commentId).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // challenges
  // ──────────────────────────────────────────────
  describe("mutations/challenges", () => {
    it("createChallenge throws structured unauthenticated error when not signed in", async () => {
      await expectUnauthenticated(
        t.mutation(api.mutations.challenges.createChallenge, {
          name: "Test",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          durationDays: 30,
          streakMinPoints: 10,
          weekCalcMethod: "from_start",
        })
      );
    });

    it("dismissAnnouncement throws structured unauthenticated error when not signed in", async () => {
      const creatorId = await createTestUser(t, {
        email: "creator@example.com",
        username: "creator",
      });
      const challengeId = await createTestChallenge(t, creatorId);

      await expectUnauthenticated(
        t.mutation(api.mutations.challenges.dismissAnnouncement, {
          challengeId: challengeId as Id<"challenges">,
        })
      );
    });

    it("createChallenge succeeds when authenticated", async () => {
      const email = "builder@example.com";
      const userId = await createTestUser(t, { email, username: "builder" });

      const authed = t.withIdentity({ subject: userId, email });
      const challengeId = await authed.mutation(
        api.mutations.challenges.createChallenge,
        {
          name: "My Challenge",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          durationDays: 30,
          streakMinPoints: 10,
          weekCalcMethod: "from_start",
        }
      );
      expect(challengeId).toBeDefined();
    });
  });
});
