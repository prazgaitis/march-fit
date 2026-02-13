import { describe, it, expect, beforeEach } from "vitest";
import { internal } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";

// --- Strava activity fixtures ---

function makeStravaActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 12345678,
    name: "Morning Run",
    type: "Run",
    sport_type: "Run",
    start_date: "2024-01-15T07:30:00Z",
    start_date_local: "2024-01-15T07:30:00",
    elapsed_time: 2400, // 40 minutes
    moving_time: 2280,
    distance: 8000, // 8 km
    average_speed: 3.33,
    max_speed: 4.2,
    average_heartrate: 150,
    max_heartrate: 175,
    total_elevation_gain: 120,
    kudos_count: 5,
    achievement_count: 2,
    athlete_count: 1,
    photo_count: 0,
    private: false,
    flagged: false,
    ...overrides,
  };
}

// --- Scaffold helpers ---

async function setupChallengeWithRunning(t: ReturnType<typeof createTestContext>) {
  const userId = await createTestUser(t);
  const challengeId = await createTestChallenge(t, userId, {
    startDate: "2024-01-01",
    endDate: "2024-01-31",
  });

  // Create participation
  await t.run(async (ctx) => {
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
  });

  // Create Running activity type
  const activityTypeId = await t.run(async (ctx) => {
    return await ctx.db.insert("activityTypes", {
      challengeId,
      name: "Running",
      scoringConfig: {
        unit: "minutes",
        pointsPerUnit: 1,
        basePoints: 5,
      },
      contributesToStreak: true,
      isNegative: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return { userId, challengeId, activityTypeId };
}

async function getParticipation(
  t: ReturnType<typeof createTestContext>,
  userId: string,
  challengeId: string
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("userChallenges")
      .withIndex("userChallengeUnique", (q: any) =>
        q.eq("userId", userId).eq("challengeId", challengeId)
      )
      .first();
  });
}

async function getActivity(
  t: ReturnType<typeof createTestContext>,
  activityId: string
) {
  return await t.run(async (ctx) => {
    return await ctx.db.get(activityId);
  });
}

// ===========================
// createFromStrava tests
// ===========================

describe("Strava Webhook: createFromStrava", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("should create a new activity from Strava data", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);
    const stravaActivity = makeStravaActivity();

    const activityId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      { userId, challengeId, stravaActivity }
    );

    expect(activityId).toBeTruthy();

    const activity = await getActivity(t, activityId!);
    expect(activity).toBeTruthy();
    expect(activity!.source).toBe("strava");
    expect(activity!.externalId).toBe("12345678");
    expect(activity!.userId).toBe(userId);
    expect(activity!.challengeId).toBe(challengeId);
    expect(activity!.deletedAt).toBeUndefined();
    expect(activity!.pointsEarned).toBeGreaterThan(0);
  });

  it("should update participation totalPoints on create", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    const before = await getParticipation(t, userId, challengeId);
    expect(before!.totalPoints).toBe(0);

    await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
      userId,
      challengeId,
      stravaActivity: makeStravaActivity(),
    });

    const after = await getParticipation(t, userId, challengeId);
    expect(after!.totalPoints).toBeGreaterThan(0);
  });

  it("should upsert (update) when same externalId arrives again", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    // First create
    const activityId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity({ elapsed_time: 2400 }), // 40 min
      }
    );

    const firstActivity = await getActivity(t, activityId!);
    const firstPoints = firstActivity!.pointsEarned;

    // Second call with same externalId but longer duration
    const updatedId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity({ elapsed_time: 3600 }), // 60 min
      }
    );

    // Should return same activity ID
    expect(updatedId).toBe(activityId);

    const updatedActivity = await getActivity(t, activityId!);
    expect(updatedActivity!.pointsEarned).toBeGreaterThan(firstPoints);

    // Verify metrics were updated
    const metrics = updatedActivity!.metrics as Record<string, unknown>;
    expect(metrics.minutes).toBe(60);
  });

  it("should apply differential point update on upsert", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    // Create: 40 min = 5 base + 40 = 45 points
    await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
      userId,
      challengeId,
      stravaActivity: makeStravaActivity({ elapsed_time: 2400 }),
    });

    const afterCreate = await getParticipation(t, userId, challengeId);
    const pointsAfterCreate = afterCreate!.totalPoints;

    // Update: 60 min = 5 base + 60 = 65 points (diff = +20)
    await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
      userId,
      challengeId,
      stravaActivity: makeStravaActivity({ elapsed_time: 3600 }),
    });

    const afterUpdate = await getParticipation(t, userId, challengeId);
    expect(afterUpdate!.totalPoints).toBe(pointsAfterCreate + 20);
  });

  it("should restore a soft-deleted activity when same externalId reappears", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    // Create
    const activityId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity(),
      }
    );

    // Soft delete via deleteFromStrava
    await t.mutation(internal.mutations.stravaWebhook.deleteFromStrava, {
      externalId: "12345678",
    });

    const deleted = await getActivity(t, activityId!);
    expect(deleted!.deletedAt).toBeDefined();

    const afterDelete = await getParticipation(t, userId, challengeId);
    expect(afterDelete!.totalPoints).toBe(0);

    // Re-create (same externalId)
    const restoredId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity(),
      }
    );

    expect(restoredId).toBe(activityId);

    const restored = await getActivity(t, activityId!);
    expect(restored!.deletedAt).toBeUndefined();
    expect(restored!.deletedReason).toBeUndefined();
    expect(restored!.pointsEarned).toBeGreaterThan(0);

    // Points should be restored
    const afterRestore = await getParticipation(t, userId, challengeId);
    expect(afterRestore!.totalPoints).toBeGreaterThan(0);
  });

  it("should return null for unknown activity types", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    const result = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity({
          type: "Snowboard",
          sport_type: "Snowboard",
        }),
      }
    );

    expect(result).toBeNull();
  });

  it("should skip unpaid participants when payment is required", async () => {
    const userId = await createTestUser(t);
    const challengeId = await createTestChallenge(t, userId);

    // Payment config requiring payment
    await t.run(async (ctx) => {
      await ctx.db.insert("challengePaymentConfig", {
        challengeId,
        testMode: true,
        priceInCents: 2500,
        currency: "usd",
        stripeTestSecretKey: "sk_test_123",
        stripeTestPublishableKey: "pk_test_123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Unpaid participation
    await t.run(async (ctx) => {
      await ctx.db.insert("userChallenges", {
        userId,
        challengeId,
        joinedAt: Date.now(),
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "unpaid",
        updatedAt: Date.now(),
      });
    });

    // Running activity type
    await t.run(async (ctx) => {
      await ctx.db.insert("activityTypes", {
        challengeId,
        name: "Running",
        scoringConfig: { unit: "minutes", pointsPerUnit: 1, basePoints: 5 },
        contributesToStreak: true,
        isNegative: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity(),
      }
    );

    expect(result).toBeNull();
  });

  it("should store externalData with the full Strava activity", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);
    const stravaActivity = makeStravaActivity();

    const activityId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      { userId, challengeId, stravaActivity }
    );

    const activity = await getActivity(t, activityId!);
    expect(activity!.externalData).toBeDefined();
    expect((activity!.externalData as any).id).toBe(12345678);
    expect((activity!.externalData as any).name).toBe("Morning Run");
  });

  it("should award media bonus for activities with photos", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    // Activity without photos
    const noPhotoId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity({ id: 111 }),
      }
    );

    // Activity with photos
    const withPhotoId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity({
          id: 222,
          photo_count: 1,
          photos: {
            primary: { urls: { "600": "https://example.com/photo.jpg" } },
            count: 1,
          },
        }),
      }
    );

    const noPhoto = await getActivity(t, noPhotoId!);
    const withPhoto = await getActivity(t, withPhotoId!);

    // Photo activity should earn 1 extra point (media bonus)
    expect(withPhoto!.pointsEarned).toBe(noPhoto!.pointsEarned + 1);
  });
});

// ===========================
// deleteFromStrava tests
// ===========================

describe("Strava Webhook: deleteFromStrava", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("should soft-delete an activity by externalId", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    const activityId = await t.mutation(
      internal.mutations.stravaWebhook.createFromStrava,
      {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity(),
      }
    );

    const result = await t.mutation(
      internal.mutations.stravaWebhook.deleteFromStrava,
      { externalId: "12345678" }
    );

    expect(result.deleted).toBe(1);

    const activity = await getActivity(t, activityId!);
    expect(activity!.deletedAt).toBeDefined();
    expect(activity!.deletedReason).toBe("strava_delete");
  });

  it("should subtract points from participation on delete", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
      userId,
      challengeId,
      stravaActivity: makeStravaActivity(),
    });

    const before = await getParticipation(t, userId, challengeId);
    expect(before!.totalPoints).toBeGreaterThan(0);

    await t.mutation(internal.mutations.stravaWebhook.deleteFromStrava, {
      externalId: "12345678",
    });

    const after = await getParticipation(t, userId, challengeId);
    expect(after!.totalPoints).toBe(0);
  });

  it("should not double-delete already deleted activities", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
      userId,
      challengeId,
      stravaActivity: makeStravaActivity(),
    });

    // First delete
    const first = await t.mutation(
      internal.mutations.stravaWebhook.deleteFromStrava,
      { externalId: "12345678" }
    );
    expect(first.deleted).toBe(1);

    // Second delete (should be no-op)
    const second = await t.mutation(
      internal.mutations.stravaWebhook.deleteFromStrava,
      { externalId: "12345678" }
    );
    expect(second.deleted).toBe(0);
  });

  it("should handle deleting a non-existent externalId", async () => {
    const result = await t.mutation(
      internal.mutations.stravaWebhook.deleteFromStrava,
      { externalId: "nonexistent" }
    );

    expect(result.deleted).toBe(0);
  });

  it("should delete across multiple challenges for the same externalId", async () => {
    const userId = await createTestUser(t);
    const challenge1Id = await createTestChallenge(t, userId, {
      name: "Challenge 1",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });
    const challenge2Id = await createTestChallenge(t, userId, {
      name: "Challenge 2",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });

    // Set up both challenges with participations and activity types
    for (const challengeId of [challenge1Id, challenge2Id]) {
      await t.run(async (ctx) => {
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
        await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Running",
          scoringConfig: { unit: "minutes", pointsPerUnit: 1, basePoints: 5 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
        userId,
        challengeId,
        stravaActivity: makeStravaActivity(),
      });
    }

    // Delete should affect both challenges
    const result = await t.mutation(
      internal.mutations.stravaWebhook.deleteFromStrava,
      { externalId: "12345678" }
    );

    expect(result.deleted).toBe(2);

    // Both participations should have 0 points
    const p1 = await getParticipation(t, userId, challenge1Id);
    const p2 = await getParticipation(t, userId, challenge2Id);
    expect(p1!.totalPoints).toBe(0);
    expect(p2!.totalPoints).toBe(0);
  });

  it("should not go below zero points on participation", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    await t.mutation(internal.mutations.stravaWebhook.createFromStrava, {
      userId,
      challengeId,
      stravaActivity: makeStravaActivity(),
    });

    // Manually set points to something lower than activity earned
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("userChallenges")
        .withIndex("userChallengeUnique", (q: any) =>
          q.eq("userId", userId).eq("challengeId", challengeId)
        )
        .first();
      if (p) {
        await ctx.db.patch(p._id, { totalPoints: 1 });
      }
    });

    await t.mutation(internal.mutations.stravaWebhook.deleteFromStrava, {
      externalId: "12345678",
    });

    const after = await getParticipation(t, userId, challengeId);
    expect(after!.totalPoints).toBe(0); // Math.max(0, ...) should prevent negative
  });
});

// ===========================
// getUserParticipations tests
// ===========================

describe("Strava Webhook: getUserParticipations", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("should return user challenge participations with challenge details", async () => {
    const { userId, challengeId } = await setupChallengeWithRunning(t);

    const result = await t.query(
      internal.mutations.stravaWebhook.getUserParticipations,
      { userId }
    );

    expect(result).toHaveLength(1);
    expect(result[0].challenge).toBeTruthy();
    expect(result[0].challenge!._id).toBe(challengeId);
    expect(result[0].participation.userId).toBe(userId);
  });

  it("should return empty array for user with no participations", async () => {
    const userId = await createTestUser(t);

    const result = await t.query(
      internal.mutations.stravaWebhook.getUserParticipations,
      { userId }
    );

    expect(result).toHaveLength(0);
  });
});

// ===========================
// webhookPayloads mutation tests
// ===========================

describe("Webhook Payloads: store and updateStatus", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("should store a raw webhook payload with received status", async () => {
    const payloadId = await t.mutation(
      internal.mutations.webhookPayloads.store,
      {
        service: "strava" as const,
        eventType: "activity.create",
        payload: { object_type: "activity", aspect_type: "create", object_id: 123 },
      }
    );

    expect(payloadId).toBeTruthy();

    const payload = await t.run(async (ctx) => {
      return await ctx.db.get(payloadId);
    });

    expect(payload!.status).toBe("received");
    expect(payload!.service).toBe("strava");
    expect(payload!.eventType).toBe("activity.create");
    expect(payload!.payload.object_id).toBe(123);
    expect(payload!.createdAt).toBeDefined();
  });

  it("should transition status to processing", async () => {
    const payloadId = await t.mutation(
      internal.mutations.webhookPayloads.store,
      {
        service: "strava" as const,
        eventType: "activity.create",
        payload: {},
      }
    );

    await t.mutation(internal.mutations.webhookPayloads.updateStatus, {
      payloadId,
      status: "processing" as const,
    });

    const payload = await t.run(async (ctx) => {
      return await ctx.db.get(payloadId);
    });

    expect(payload!.status).toBe("processing");
    expect(payload!.processedAt).toBeUndefined();
  });

  it("should transition to completed with processing result", async () => {
    const payloadId = await t.mutation(
      internal.mutations.webhookPayloads.store,
      {
        service: "strava" as const,
        eventType: "activity.create",
        payload: {},
      }
    );

    await t.mutation(internal.mutations.webhookPayloads.updateStatus, {
      payloadId,
      status: "completed" as const,
      processingResult: { processed_challenges: 2 },
    });

    const payload = await t.run(async (ctx) => {
      return await ctx.db.get(payloadId);
    });

    expect(payload!.status).toBe("completed");
    expect(payload!.processedAt).toBeDefined();
    expect(payload!.processingResult.processed_challenges).toBe(2);
  });

  it("should transition to failed with error message", async () => {
    const payloadId = await t.mutation(
      internal.mutations.webhookPayloads.store,
      {
        service: "strava" as const,
        eventType: "activity.update",
        payload: {},
      }
    );

    await t.mutation(internal.mutations.webhookPayloads.updateStatus, {
      payloadId,
      status: "failed" as const,
      error: "Server Error: something went wrong",
    });

    const payload = await t.run(async (ctx) => {
      return await ctx.db.get(payloadId);
    });

    expect(payload!.status).toBe("failed");
    expect(payload!.error).toBe("Server Error: something went wrong");
    expect(payload!.processedAt).toBeDefined();
  });

  it("should store stripe webhook payloads", async () => {
    const payloadId = await t.mutation(
      internal.mutations.webhookPayloads.store,
      {
        service: "stripe" as const,
        eventType: "checkout.session.completed",
        payload: { id: "cs_123", object: "checkout.session" },
      }
    );

    const payload = await t.run(async (ctx) => {
      return await ctx.db.get(payloadId);
    });

    expect(payload!.service).toBe("stripe");
    expect(payload!.eventType).toBe("checkout.session.completed");
  });
});
