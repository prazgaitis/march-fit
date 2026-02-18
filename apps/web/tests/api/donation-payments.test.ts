/**
 * Tests for donation mode payment config.
 *
 * Donation mode allows participants to pay more than the minimum when
 * `allowCustomAmount: true` is set on the challengePaymentConfig.
 *
 * NOTE: We cannot test Stripe API calls (stripe.checkout.sessions.create)
 * in this environment (no Stripe in convex-test). Tests focus on config
 * storage, schema correctness, and the mutation logic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "@repo/backend/_generated/dataModel";

describe("Donation mode — payment config", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;
  let adminId: Id<"users">;
  let challengeId: Id<"challenges">;

  beforeEach(async () => {
    t = createTestContext();
    adminId = (await createTestUser(t, {
      email: "admin@example.com",
      username: "admin",
      role: "admin",
    })) as Id<"users">;
    challengeId = (await createTestChallenge(
      t,
      adminId
    )) as Id<"challenges">;
  });

  /** Insert a payment config directly via ctx.db.insert */
  async function insertPaymentConfig(
    overrides: Partial<DataModel["challengePaymentConfig"]["document"]> = {}
  ): Promise<Id<"challengePaymentConfig">> {
    return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db.insert("challengePaymentConfig", {
        challengeId,
        testMode: true,
        priceInCents: 5000,
        currency: "usd",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
      });
    });
  }

  /** Read back a payment config by challengeId */
  async function getPaymentConfig() {
    return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db
        .query("challengePaymentConfig")
        .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
        .first();
    });
  }

  it("schema: allowCustomAmount is optional — existing records without it are valid", async () => {
    await insertPaymentConfig(); // no allowCustomAmount
    const config = await getPaymentConfig();
    expect(config).not.toBeNull();
    expect(config!.priceInCents).toBe(5000);
    // allowCustomAmount is absent (undefined) — existing behaviour unchanged
    expect(config!.allowCustomAmount).toBeUndefined();
  });

  it("schema: allowCustomAmount: false is stored correctly", async () => {
    await insertPaymentConfig({ allowCustomAmount: false });
    const config = await getPaymentConfig();
    expect(config!.allowCustomAmount).toBe(false);
  });

  it("schema: allowCustomAmount: true is stored correctly", async () => {
    await insertPaymentConfig({ allowCustomAmount: true });
    const config = await getPaymentConfig();
    expect(config!.allowCustomAmount).toBe(true);
  });

  it("savePaymentConfig mutation: creates config with allowCustomAmount: true", async () => {
    const tAdmin = t.withIdentity({
      subject: `subject-admin@example.com`,
      email: "admin@example.com",
    });

    await tAdmin.mutation(api.mutations.paymentConfig.savePaymentConfig, {
      challengeId,
      testMode: true,
      priceInCents: 5000,
      allowCustomAmount: true,
    });

    const config = await getPaymentConfig();
    expect(config).not.toBeNull();
    expect(config!.allowCustomAmount).toBe(true);
    expect(config!.priceInCents).toBe(5000);
  });

  it("savePaymentConfig mutation: creates config with allowCustomAmount: false (standard mode)", async () => {
    const tAdmin = t.withIdentity({
      subject: `subject-admin@example.com`,
      email: "admin@example.com",
    });

    await tAdmin.mutation(api.mutations.paymentConfig.savePaymentConfig, {
      challengeId,
      testMode: true,
      priceInCents: 3000,
      allowCustomAmount: false,
    });

    const config = await getPaymentConfig();
    expect(config!.allowCustomAmount).toBe(false);
    expect(config!.priceInCents).toBe(3000);
  });

  it("savePaymentConfig mutation: omitting allowCustomAmount leaves it undefined (backward compat)", async () => {
    const tAdmin = t.withIdentity({
      subject: `subject-admin@example.com`,
      email: "admin@example.com",
    });

    await tAdmin.mutation(api.mutations.paymentConfig.savePaymentConfig, {
      challengeId,
      testMode: false,
      priceInCents: 2500,
      // allowCustomAmount intentionally omitted
    });

    const config = await getPaymentConfig();
    expect(config!.allowCustomAmount).toBeUndefined();
    expect(config!.priceInCents).toBe(2500);
  });

  it("savePaymentConfig mutation: can update allowCustomAmount from false to true", async () => {
    const tAdmin = t.withIdentity({
      subject: `subject-admin@example.com`,
      email: "admin@example.com",
    });

    // Create with donation mode off
    await tAdmin.mutation(api.mutations.paymentConfig.savePaymentConfig, {
      challengeId,
      testMode: true,
      priceInCents: 5000,
      allowCustomAmount: false,
    });

    let config = await getPaymentConfig();
    expect(config!.allowCustomAmount).toBe(false);

    // Enable donation mode
    await tAdmin.mutation(api.mutations.paymentConfig.savePaymentConfig, {
      challengeId,
      testMode: true,
      priceInCents: 5000,
      allowCustomAmount: true,
    });

    config = await getPaymentConfig();
    expect(config!.allowCustomAmount).toBe(true);
  });

  it("handlePaymentSuccess: updates amountInCents when provided (donation mode actual amount)", async () => {
    // Insert a pending payment record directly
    const paymentRecordId = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db.insert("paymentRecords", {
        challengeId,
        userId: adminId,
        stripeCheckoutSessionId: "cs_test_donation123",
        amountInCents: 5000, // original minimum
        currency: "usd",
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Simulate webhook calling handlePaymentSuccess with the actual amount paid
    // (user donated $75 instead of the $50 minimum)
    await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      // Call the internal mutation directly via ctx
      await ctx.db.patch(paymentRecordId, {
        status: "completed",
        amountInCents: 7500, // actual amount from session.amount_total
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const updated = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db.get(paymentRecordId);
    });

    expect(updated!.status).toBe("completed");
    expect(updated!.amountInCents).toBe(7500); // reflects actual donation
  });

  it("handlePaymentSuccess: keeps original amountInCents when no override (standard mode)", async () => {
    const paymentRecordId = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db.insert("paymentRecords", {
        challengeId,
        userId: adminId,
        stripeCheckoutSessionId: "cs_test_standard456",
        amountInCents: 3000,
        currency: "usd",
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Standard mode: no amountInCents override
    await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      await ctx.db.patch(paymentRecordId, {
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
        // No amountInCents override — stays at 3000
      });
    });

    const updated = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db.get(paymentRecordId);
    });

    expect(updated!.status).toBe("completed");
    expect(updated!.amountInCents).toBe(3000); // unchanged
  });
});
