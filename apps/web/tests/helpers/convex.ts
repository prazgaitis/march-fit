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
