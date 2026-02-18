import { convexTest } from "convex-test";
import { schema } from "@repo/backend";
import { GenericMutationCtx } from "convex/server";
import { DataModel, Id } from "@repo/backend/_generated/dataModel";


// Import all backend modules lazily from the packages/backend directory
// This runs in Vite/Vitest context which supports import.meta.glob
const modulesRaw = import.meta.glob("../../../../packages/backend/**/*.{ts,js}");

// Normalize module keys to match what convex-test expects
// e.g., "../../../../packages/backend/mutations/activities.ts" -> "mutations/activities.ts"
const modules = Object.fromEntries(
  Object.entries(modulesRaw).map(([key, value]) => {
    const normalizedKey = key.replace(/^.*\/packages\/backend\//, "");
    return [normalizedKey, value];
  })
);

export const createTestContext = () => {
  return convexTest(schema, modules);
};

// Helper to create a user in the test database
export const createTestUser = async (t: ReturnType<typeof createTestContext>, overrides: Partial<DataModel["users"]["document"]> = {}) => {
  const userId = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
      username: "testuser",
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
  return userId;
};

// Helper to create a challenge
export const createTestChallenge = async (t: ReturnType<typeof createTestContext>, creatorId: string, overrides: Partial<DataModel["challenges"]["document"]> = {}) => {
  const challengeId = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return await ctx.db.insert("challenges", {
      name: "Test Challenge",
      description: "A test challenge",
      creatorId: creatorId as Id<"users">,
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      durationDays: 30,
      streakMinPoints: 10,
      weekCalcMethod: "from_start",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
  return challengeId;
};

/** Create an activity type for a challenge. */
export const createTestActivityType = async (
  t: ReturnType<typeof createTestContext>,
  challengeId: string,
  overrides: Partial<DataModel["activityTypes"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("activityTypes", {
      challengeId: challengeId as Id<"challenges">,
      name: "Test Activity",
      scoringConfig: { type: "fixed", basePoints: 10 },
      contributesToStreak: true,
      isNegative: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
};

/** Create an achievement for a challenge. */
export const createTestAchievement = async (
  t: ReturnType<typeof createTestContext>,
  challengeId: string,
  criteria: DataModel["achievements"]["document"]["criteria"],
  overrides: Partial<DataModel["achievements"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("achievements", {
      challengeId: challengeId as Id<"challenges">,
      name: "Test Achievement",
      description: "A test achievement",
      bonusPoints: 100,
      criteria,
      frequency: "once_per_challenge",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
};

/** Create a userChallenges (participation) record. */
export const createTestParticipation = async (
  t: ReturnType<typeof createTestContext>,
  userId: string,
  challengeId: string,
  overrides: Partial<DataModel["userChallenges"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("userChallenges", {
      userId: userId as Id<"users">,
      challengeId: challengeId as Id<"challenges">,
      joinedAt: Date.now(),
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: "paid",
      updatedAt: Date.now(),
      ...overrides,
    });
  });
};
