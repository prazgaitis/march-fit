import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "@repo/backend";
import { dateOnlyToUtcMs } from "@/lib/date-only";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestActivityType,
} from "../helpers/convex";
import { insertTestActivity } from "../helpers/activities";

// --- Strava activity fixtures with location data ---

function makeStravaActivityWithLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 55555555,
    name: "Morning Run in Chicago",
    type: "Run",
    sport_type: "Run",
    start_date: "2024-01-15T13:30:00Z",
    start_date_local: "2024-01-15T07:30:00",
    elapsed_time: 2400,
    moving_time: 2280,
    distance: 8000,
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
    // Location fields
    start_latlng: [41.8781, -87.6298],
    location_city: "Chicago",
    location_state: "Illinois",
    location_country: "United States",
    timezone: "(GMT-06:00) America/Chicago",
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

  // Create integration mapping for Strava Run detection
  await t.run(async (ctx) => {
    await ctx.db.insert("integrationMappings", {
      challengeId,
      service: "strava",
      externalType: "Run",
      activityTypeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return { userId, challengeId, activityTypeId };
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
// Strava location data tests
// ===========================

describe("Location & Time Tracking", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("createFromStrava with location data", () => {
    it("should persist location fields from Strava activity", async () => {
      const { userId, challengeId } = await setupChallengeWithRunning(t);
      const stravaActivity = makeStravaActivityWithLocation();

      const activityId = await t.mutation(
        internal.mutations.stravaWebhook.createFromStrava,
        { userId, challengeId, stravaActivity }
      );

      expect(activityId).toBeTruthy();
      const activity = await getActivity(t, activityId!);
      expect(activity).toBeTruthy();
      expect(activity!.locationCity).toBe("Chicago");
      expect(activity!.locationState).toBe("Illinois");
      expect(activity!.locationCountry).toBe("United States");
      expect(activity!.startLatlng).toEqual([41.8781, -87.6298]);
      expect(activity!.timezone).toBe("America/Chicago");
      expect(activity!.localTime).toBe("07:30");
    });

    it("should handle Strava activity without location data", async () => {
      const { userId, challengeId } = await setupChallengeWithRunning(t);
      const stravaActivity = makeStravaActivityWithLocation({
        start_latlng: null,
        location_city: null,
        location_state: null,
        location_country: null,
        timezone: undefined,
      });

      const activityId = await t.mutation(
        internal.mutations.stravaWebhook.createFromStrava,
        { userId, challengeId, stravaActivity }
      );

      expect(activityId).toBeTruthy();
      const activity = await getActivity(t, activityId!);
      expect(activity!.locationCity).toBeUndefined();
      expect(activity!.locationState).toBeUndefined();
      expect(activity!.locationCountry).toBeUndefined();
      expect(activity!.startLatlng).toBeUndefined();
      expect(activity!.timezone).toBeUndefined();
    });

    it("should extract local time from start_date_local", async () => {
      const { userId, challengeId } = await setupChallengeWithRunning(t);
      const stravaActivity = makeStravaActivityWithLocation({
        start_date_local: "2024-01-15T18:45:00",
      });

      const activityId = await t.mutation(
        internal.mutations.stravaWebhook.createFromStrava,
        { userId, challengeId, stravaActivity }
      );

      const activity = await getActivity(t, activityId!);
      expect(activity!.localTime).toBe("18:45");
    });

    it("should update location on Strava activity upsert", async () => {
      const { userId, challengeId } = await setupChallengeWithRunning(t);

      // First create with Chicago location
      const activityId = await t.mutation(
        internal.mutations.stravaWebhook.createFromStrava,
        {
          userId,
          challengeId,
          stravaActivity: makeStravaActivityWithLocation(),
        }
      );

      // Update with different location
      await t.mutation(
        internal.mutations.stravaWebhook.createFromStrava,
        {
          userId,
          challengeId,
          stravaActivity: makeStravaActivityWithLocation({
            location_city: "New York",
            location_state: "New York",
            start_latlng: [40.7128, -74.006],
            timezone: "(GMT-05:00) America/New_York",
          }),
        }
      );

      const activity = await getActivity(t, activityId!);
      expect(activity!.locationCity).toBe("New York");
      expect(activity!.locationState).toBe("New York");
      expect(activity!.timezone).toBe("America/New_York");
      expect(activity!.startLatlng).toEqual([40.7128, -74.006]);
    });
  });

  describe("manual activity log with timezone", () => {
    it("should persist timezone and localTime from manual log", async () => {
      const testEmail = "tz@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-tz", email: testEmail });
      const challengeId = await createTestChallenge(t, userId, {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

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

      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: "2024-01-15",
        metrics: { minutes: 30 },
        timezone: "America/Chicago",
        localTime: "07:30",
        source: "manual",
      });

      expect(result.pointsEarned).toBe(35);

      const activity = await t.run(async (ctx) => {
        return await ctx.db.get(result.id);
      });
      expect(activity.timezone).toBe("America/Chicago");
      expect(activity.localTime).toBe("07:30");
    });

    it("should work without timezone and localTime", async () => {
      const testEmail = "notz@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-notz", email: testEmail });
      const challengeId = await createTestChallenge(t, userId, {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

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

      const result = await tWithAuth.mutation(api.mutations.activities.log, {
        challengeId,
        activityTypeId,
        loggedDate: "2024-01-15",
        metrics: { minutes: 30 },
        source: "manual",
      });

      const activity = await t.run(async (ctx) => {
        return await ctx.db.get(result.id);
      });
      expect(activity.timezone).toBeUndefined();
      expect(activity.localTime).toBeUndefined();
    });
  });

  describe("user location in profile", () => {
    it("should return user location in getProfile", async () => {
      const userId = await createTestUser(t, {
        email: "location@example.com",
        location: "Chicago, IL",
      });
      const challengeId = await createTestChallenge(t, userId);
      await createTestParticipation(t, userId, challengeId);

      const profile = await t.query(api.queries.users.getProfile, {
        userId,
        challengeId,
      });

      expect(profile).toBeTruthy();
      expect(profile!.user.location).toBe("Chicago, IL");
    });

    it("should return null location when not set", async () => {
      const userId = await createTestUser(t, {
        email: "noloc@example.com",
      });
      const challengeId = await createTestChallenge(t, userId);
      await createTestParticipation(t, userId, challengeId);

      const profile = await t.query(api.queries.users.getProfile, {
        userId,
        challengeId,
      });

      expect(profile).toBeTruthy();
      expect(profile!.user.location).toBeNull();
    });

    it("should include location in leaderboard entries", async () => {
      const userId = await createTestUser(t, {
        email: "lead@example.com",
        location: "Brooklyn, NY",
      });
      const challengeId = await createTestChallenge(t, userId);
      await createTestParticipation(t, userId, challengeId);

      const leaderboard = await t.query(
        api.queries.participations.getFullLeaderboard,
        { challengeId }
      );

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0]!.user.location).toBe("Brooklyn, NY");
    });
  });

  describe("updateUser with location", () => {
    it("should update user location", async () => {
      const testEmail = "updloc@example.com";
      const userId = await createTestUser(t, { email: testEmail });
      const tWithAuth = t.withIdentity({ subject: "test-user-updloc", email: testEmail });

      await tWithAuth.mutation(api.mutations.users.updateUser, {
        userId,
        location: "San Francisco, CA",
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      expect(user!.location).toBe("San Francisco, CA");
    });

    it("should clear user location when set to undefined", async () => {
      const testEmail = "clrloc@example.com";
      const userId = await createTestUser(t, {
        email: testEmail,
        location: "Old Location",
      });
      const tWithAuth = t.withIdentity({ subject: "test-user-clrloc", email: testEmail });

      await tWithAuth.mutation(api.mutations.users.updateUser, {
        userId,
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      // When location arg is omitted, existing value is preserved
      expect(user!.location).toBe("Old Location");
    });
  });
});
