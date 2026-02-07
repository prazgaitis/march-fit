import { describe, it, expect, beforeEach } from 'vitest';
import { StravaActivityMapper, StravaActivity } from '../../lib/services/StravaActivityMapper';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

const stravaRunningActivity: StravaActivity = {
  id: 12345678,
  name: "Morning Run",
  type: "Run",
  sport_type: "Run",
  start_date: "2024-03-15T07:30:00Z",
  elapsed_time: 2400, // 40 minutes in seconds
  moving_time: 2280, // 38 minutes in seconds
  distance: 8000, // 8km in meters
  average_speed: 3.51, // m/s
  max_speed: 4.2, // m/s
  average_heartrate: 150,
  max_heartrate: 175,
  total_elevation_gain: 120,
  kudos_count: 5,
  achievement_count: 2,
  athlete_count: 1,
  photo_count: 0,
  private: false,
  flagged: false
};

const stravaRideActivity: StravaActivity = {
  id: 87654321,
  name: "Evening Bike Ride",
  type: "Ride",
  sport_type: "Ride",
  start_date: "2024-03-15T18:00:00Z",
  elapsed_time: 3600, // 60 minutes in seconds
  moving_time: 3480, // 58 minutes in seconds
  distance: 25000, // 25km in meters
  average_speed: 7.18, // m/s
  max_speed: 12.5, // m/s
  average_heartrate: 140,
  max_heartrate: 165,
  total_elevation_gain: 300,
  kudos_count: 8,
  achievement_count: 1,
  athlete_count: 1,
  photo_count: 2,
  private: false,
  flagged: false
};

const stravaSwimActivity: StravaActivity = {
  id: 11223344,
  name: "Pool Swim",
  type: "Swim",
  sport_type: "Swim",
  start_date: "2024-03-15T06:00:00Z",
  elapsed_time: 1800, // 30 minutes in seconds
  moving_time: 1620, // 27 minutes in seconds
  distance: 1500, // 1.5km in meters
  average_speed: 0.93, // m/s
  max_speed: 1.1, // m/s
  kudos_count: 3,
  achievement_count: 0,
  athlete_count: 1,
  photo_count: 0,
  private: false,
  flagged: false
};

const stravaWorkoutActivity: StravaActivity = {
  id: 99887766,
  name: "Strength Training",
  type: "Workout",
  sport_type: "WeightTraining",
  start_date: "2024-03-15T12:00:00Z",
  elapsed_time: 2700, // 45 minutes in seconds
  moving_time: 2100, // 35 minutes in seconds
  kudos_count: 4,
  achievement_count: 0,
  athlete_count: 1,
  photo_count: 1,
  private: false,
  flagged: false
};

describe('Strava Activity Mapping', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  const fetchActivityTypes = async (challengeId: string) => {
    return t.run(async (ctx) => {
      const types = await ctx.db
        .query("activityTypes")
        .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
        .collect();
      
      return types.map((t) => ({ id: t._id, name: t.name }));
    });
  };

  describe('StravaActivityMapper', () => {
    it('should map running activity to our format', async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Create a running activity type
      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 2,
            basePoints: 10,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const mapper = new StravaActivityMapper(challengeId, userId, fetchActivityTypes);
      const mapped = await mapper.mapActivity(stravaRunningActivity, activityTypeId);

      expect(mapped.challengeId).toBe(challengeId);
      expect(mapped.activityTypeId).toBe(activityTypeId);
      expect(mapped.loggedDate).toBe('2024-03-15');
      expect(mapped.source).toBe('strava');
      expect(mapped.externalId).toBe('12345678');
      expect(mapped.metrics).toEqual({
        minutes: 40,
        distance_km: 8,
        average_pace_min_per_km: '5:00',
        elevation_gain_m: 120,
        average_heartrate: 150,
        max_heartrate: 175,
      });
      expect(mapped.externalData).toEqual(stravaRunningActivity);
    });

    it('should map cycling activity to our format', async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Cycling',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 1.5,
            basePoints: 5,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const mapper = new StravaActivityMapper(challengeId, userId, fetchActivityTypes);
      const mapped = await mapper.mapActivity(stravaRideActivity, activityTypeId);

      expect(mapped.challengeId).toBe(challengeId);
      expect(mapped.activityTypeId).toBe(activityTypeId);
      expect(mapped.loggedDate).toBe('2024-03-15');
      expect(mapped.source).toBe('strava');
      expect(mapped.externalId).toBe('87654321');
      expect(mapped.metrics).toEqual({
        minutes: 60,
        distance_km: 25,
        average_speed_kmh: '25.8',
        elevation_gain_m: 300,
        average_heartrate: 140,
        max_heartrate: 165,
      });
    });

    it('should map swimming activity to our format', async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Swimming',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 3,
            basePoints: 15,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const mapper = new StravaActivityMapper(challengeId, userId, fetchActivityTypes);
      const mapped = await mapper.mapActivity(stravaSwimActivity, activityTypeId);

      expect(mapped.challengeId).toBe(challengeId);
      expect(mapped.activityTypeId).toBe(activityTypeId);
      expect(mapped.loggedDate).toBe('2024-03-15');
      expect(mapped.source).toBe('strava');
      expect(mapped.externalId).toBe('11223344');
      expect(mapped.metrics).toEqual({
        minutes: 30,
        distance_km: 1.5,
        average_pace_min_per_100m: '1:48',
      });
    });

    it('should map strength training activity to our format', async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      const activityTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Strength Training',
          scoringConfig: {
            unit: 'minutes',
            pointsPerUnit: 4,
            basePoints: 20,
          },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const mapper = new StravaActivityMapper(challengeId, userId, fetchActivityTypes);
      const mapped = await mapper.mapActivity(stravaWorkoutActivity, activityTypeId);

      expect(mapped.challengeId).toBe(challengeId);
      expect(mapped.activityTypeId).toBe(activityTypeId);
      expect(mapped.loggedDate).toBe('2024-03-15');
      expect(mapped.source).toBe('strava');
      expect(mapped.externalId).toBe('99887766');
      expect(mapped.metrics).toEqual({
        minutes: 45,
      });
    });

    it('should handle activity type mapping based on sport type', async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Create multiple activity types
      const runningTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Running',
          scoringConfig: { unit: 'minutes', pointsPerUnit: 2 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const cyclingTypeId = await t.run(async (ctx) => {
        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: 'Cycling',
          scoringConfig: { unit: 'minutes', pointsPerUnit: 1.5 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const mapper = new StravaActivityMapper(challengeId, userId, fetchActivityTypes);

      // Test automatic type detection
      const runningActivityTypeId = await mapper.detectActivityType(stravaRunningActivity);
      const cyclingActivityTypeId = await mapper.detectActivityType(stravaRideActivity);

      // Should find the appropriate activity types if they exist
      expect(runningActivityTypeId).toBe(runningTypeId);
      expect(cyclingActivityTypeId).toBe(cyclingTypeId);
    });

    it('should handle unknown activity types gracefully', async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      const mapper = new StravaActivityMapper(challengeId, userId, fetchActivityTypes);

      const unknownActivity: StravaActivity = {
        ...stravaRunningActivity,
        type: 'UnknownSport',
        sport_type: 'UnknownSport',
      };

      const activityTypeId = await mapper.detectActivityType(unknownActivity);
      expect(activityTypeId).toBeNull();
    });

    it('should calculate correct pace for running activities', () => {
      const mapper = new StravaActivityMapper('challenge-id', 'user-id');

      // Test running pace calculation (8km in 2400 seconds = 5:00 per km)
      const pace = mapper.calculateRunningPace(8000, 2400);
      expect(pace).toBe('5:00');

      // Test faster pace (5km in 1200 seconds = 4:00 per km)
      const fastPace = mapper.calculateRunningPace(5000, 1200);
      expect(fastPace).toBe('4:00');
    });

    it('should calculate correct pace for swimming activities', () => {
      const mapper = new StravaActivityMapper('challenge-id', 'user-id');

      // Test swimming pace calculation (1500m in 1620 seconds = 1:48 per 100m)
      const pace = mapper.calculateSwimmingPace(1500, 1620);
      expect(pace).toBe('1:48');
    });

    it('should convert speed from m/s to km/h correctly', () => {
      const mapper = new StravaActivityMapper('challenge-id', 'user-id');

      // Test speed conversion (7.18 m/s = 25.848 km/h ≈ 25.8)
      const speed = mapper.convertSpeedToKmh(7.18);
      expect(speed).toBe('25.8');
    });
  });
});
