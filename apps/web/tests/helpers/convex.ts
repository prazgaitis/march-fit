import { convexTest } from "convex-test";
import { schema } from "@repo/backend";
import { GenericMutationCtx } from "convex/server";
import { DataModel, Id } from "@repo/backend/_generated/dataModel";
import aggregateSchema from "./aggregate-schema";

const modulesRaw = import.meta.glob("../../../../packages/backend/**/*.{ts,js}");
const aggregateModulesRaw = import.meta.glob(
  "../../../../node_modules/@convex-dev/aggregate/dist/component/**/*.{js,ts}"
);

const modules = Object.fromEntries(
  Object.entries(modulesRaw).map(([key, value]) => {
    const normalizedKey = key.replace(/^.*\/packages\/backend\//, "");
    return [normalizedKey, value];
  })
);

export const createTestContext = () => {
  const t = convexTest(schema, modules);
  t.registerComponent("activityPointsAggregate", aggregateSchema, aggregateModulesRaw);
  return t;
};

export const createTestUser = async (
  t: ReturnType<typeof createTestContext>,
  overrides: Partial<DataModel["users"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
      username: "testuser",
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
};

export const createTestChallenge = async (
  t: ReturnType<typeof createTestContext>,
  creatorId: string,
  overrides: Partial<DataModel["challenges"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("challenges", {
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
};

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

export const createTestPaymentConfig = async (
  t: ReturnType<typeof createTestContext>,
  challengeId: string,
  overrides: Partial<DataModel["challengePaymentConfig"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("challengePaymentConfig", {
      challengeId: challengeId as Id<"challenges">,
      testMode: true,
      priceInCents: 3000,
      currency: "usd",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
};

export const createTestPaymentRecord = async (
  t: ReturnType<typeof createTestContext>,
  userId: string,
  challengeId: string,
  overrides: Partial<DataModel["paymentRecords"]["document"]> = {}
) => {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("paymentRecords", {
      challengeId: challengeId as Id<"challenges">,
      userId: userId as Id<"users">,
      stripeCheckoutSessionId: "cs_test_" + Math.random().toString(36).slice(2),
      amountInCents: 3000,
      currency: "usd",
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
};
