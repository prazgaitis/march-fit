/**
 * Tests for the payment checkout flow.
 *
 * The Stripe SDK calls (createCheckoutSession, verifyCheckoutSession) are
 * actions that cannot run in convex-test. These tests cover the internal
 * mutations and queries that those actions delegate to:
 *
 * - prepareCheckout: creates payment record + updates participation
 * - completeVerification: marks payment as completed
 * - handlePaymentSuccess: webhook handler for successful payments
 * - handlePaymentFailure: webhook handler for failed payments
 * - getCheckoutData: internal query for checkout session creation
 * - getVerifyData: internal query for session verification (no auth needed)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { internal } from "@repo/backend/_generated/api";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestPaymentConfig,
  createTestPaymentRecord,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "@repo/backend/_generated/dataModel";

describe("Payment checkout flow", () => {
  let t: ReturnType<typeof createTestContext>;
  let adminId: Id<"users">;
  let userId: Id<"users">;
  let challengeId: Id<"challenges">;

  beforeEach(async () => {
    t = createTestContext();
    adminId = await createTestUser(t, {
      email: "admin@example.com",
      username: "admin",
      role: "admin",
    });
    userId = await createTestUser(t, {
      email: "user@example.com",
      username: "testuser",
      name: "Test User",
    });
    challengeId = await createTestChallenge(t, adminId as string);
  });

  // ── prepareCheckout ──────────────────────────────────────────

  describe("prepareCheckout", () => {
    it("creates payment record and updates existing participation to pending", async () => {
      const participationId = await createTestParticipation(
        t,
        userId as string,
        challengeId as string,
        { paymentStatus: "unpaid" }
      );

      await t.mutation(internal.mutations.payments.prepareCheckout, {
        userId,
        challengeId,
        stripeCheckoutSessionId: "cs_test_abc123",
        amountInCents: 3000,
        currency: "usd",
      });

      // Payment record should exist
      const paymentRecord = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db
          .query("paymentRecords")
          .withIndex("stripeCheckoutSessionId", (q) =>
            q.eq("stripeCheckoutSessionId", "cs_test_abc123")
          )
          .first();
      });
      expect(paymentRecord).not.toBeNull();
      expect(paymentRecord!.status).toBe("pending");
      expect(paymentRecord!.amountInCents).toBe(3000);

      // Participation should be updated to pending
      const participation = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db.get(participationId);
      });
      expect(participation!.paymentStatus).toBe("pending");
      expect(participation!.paymentReference).toBe("cs_test_abc123");
    });

    it("creates new participation if none exists", async () => {
      await t.mutation(internal.mutations.payments.prepareCheckout, {
        userId,
        challengeId,
        stripeCheckoutSessionId: "cs_test_new_user",
        amountInCents: 3000,
        currency: "usd",
      });

      const participation = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation).not.toBeNull();
      expect(participation!.paymentStatus).toBe("pending");
      expect(participation!.totalPoints).toBe(0);
    });
  });

  // ── handlePaymentSuccess ─────────────────────────────────────

  describe("handlePaymentSuccess", () => {
    it("marks payment and participation as completed/paid", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      const paymentRecordId = await createTestPaymentRecord(
        t,
        userId as string,
        challengeId as string,
        { stripeCheckoutSessionId: "cs_test_success" }
      );

      const result = await t.mutation(
        internal.mutations.payments.handlePaymentSuccess,
        {
          stripeCheckoutSessionId: "cs_test_success",
          stripePaymentIntentId: "pi_test_123",
          stripeCustomerEmail: "user@example.com",
        }
      );
      expect(result.success).toBe(true);

      // Payment record should be completed
      const paymentRecord = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db.get(paymentRecordId);
      });
      expect(paymentRecord!.status).toBe("completed");
      expect(paymentRecord!.stripePaymentIntentId).toBe("pi_test_123");

      // Participation should be paid
      const participation = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.paymentStatus).toBe("paid");
      expect(participation!.paymentReceivedAt).toBeDefined();
    });

    it("updates amountInCents when provided (donation mode)", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_donation",
        amountInCents: 3000, // minimum
      });

      await t.mutation(internal.mutations.payments.handlePaymentSuccess, {
        stripeCheckoutSessionId: "cs_test_donation",
        amountInCents: 7500, // user donated more
      });

      const paymentRecord = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db
          .query("paymentRecords")
          .withIndex("stripeCheckoutSessionId", (q) =>
            q.eq("stripeCheckoutSessionId", "cs_test_donation")
          )
          .first();
      });
      expect(paymentRecord!.amountInCents).toBe(7500);
    });

    it("returns error when payment record not found", async () => {
      const result = await t.mutation(
        internal.mutations.payments.handlePaymentSuccess,
        {
          stripeCheckoutSessionId: "cs_nonexistent",
        }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Payment record not found");
    });
  });

  // ── handlePaymentFailure ─────────────────────────────────────

  describe("handlePaymentFailure", () => {
    it("marks payment as failed and updates participation", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      const paymentRecordId = await createTestPaymentRecord(
        t,
        userId as string,
        challengeId as string,
        { stripeCheckoutSessionId: "cs_test_fail" }
      );

      const result = await t.mutation(
        internal.mutations.payments.handlePaymentFailure,
        {
          stripeCheckoutSessionId: "cs_test_fail",
          failureReason: "Card declined",
        }
      );
      expect(result.success).toBe(true);

      const paymentRecord = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db.get(paymentRecordId);
      });
      expect(paymentRecord!.status).toBe("failed");
      expect(paymentRecord!.failureReason).toBe("Card declined");

      const participation = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.paymentStatus).toBe("failed");
    });
  });

  // ── completeVerification ─────────────────────────────────────

  describe("completeVerification", () => {
    it("marks payment and participation as completed/paid", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_verify",
      });

      const result = await t.mutation(
        internal.mutations.payments.completeVerification,
        {
          userId,
          challengeId,
          sessionId: "cs_test_verify",
          stripePaymentIntentId: "pi_test_verify",
        }
      );
      expect(result.success).toBe(true);

      const participation = await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
        return ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation!.paymentStatus).toBe("paid");
    });

    it("returns alreadyCompleted if payment was already processed", async () => {
      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_already",
        status: "completed",
      });

      const result = await t.mutation(
        internal.mutations.payments.completeVerification,
        {
          userId,
          challengeId,
          sessionId: "cs_test_already",
        }
      );
      expect(result.success).toBe(true);
      expect(result.alreadyCompleted).toBe(true);
    });

    it("throws when payment record not found", async () => {
      await expect(
        t.mutation(internal.mutations.payments.completeVerification, {
          userId,
          challengeId,
          sessionId: "cs_nonexistent",
        })
      ).rejects.toThrow("Payment record not found");
    });
  });

  // ── getCheckoutData (internal query) ─────────────────────────

  describe("getCheckoutData", () => {
    it("returns user, challenge, and config data", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "unpaid",
      });
      await createTestPaymentConfig(t, challengeId as string, {
        stripeTestSecretKey: "encrypted_sk_test",
        stripeTestPublishableKey: "pk_test_abc",
      });

      const result = await t.query(
        internal.queries.paymentConfigInternal.getCheckoutData,
        {
          email: "user@example.com",
          challengeId,
        }
      );

      expect(result.error).toBeNull();
      expect(result.userId).toBe(userId);
      expect(result.challengeName).toBe("Test Challenge");
      expect(result.config).toBeDefined();
      expect(result.config!.priceInCents).toBe(3000);
    });

    it("returns error when user already paid", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "paid",
      });
      await createTestPaymentConfig(t, challengeId as string);

      const result = await t.query(
        internal.queries.paymentConfigInternal.getCheckoutData,
        {
          email: "user@example.com",
          challengeId,
        }
      );
      expect(result.error).toBe("Already paid for this challenge");
    });

    it("returns error when no payment config exists", async () => {
      const result = await t.query(
        internal.queries.paymentConfigInternal.getCheckoutData,
        {
          email: "user@example.com",
          challengeId,
        }
      );
      expect(result.error).toBe("Payment not configured for this challenge");
    });

    it("returns error when user not found", async () => {
      const result = await t.query(
        internal.queries.paymentConfigInternal.getCheckoutData,
        {
          email: "nonexistent@example.com",
          challengeId,
        }
      );
      expect(result.error).toBe("User not found");
    });
  });

  // ── getVerifyData (internal query, no auth needed) ───────────

  describe("getVerifyData", () => {
    it("returns userId and config for a pending payment", async () => {
      await createTestPaymentConfig(t, challengeId as string, {
        stripeTestSecretKey: "encrypted_sk",
      });
      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_verify_data",
      });

      const result = await t.query(
        internal.queries.paymentConfigInternal.getVerifyData,
        {
          challengeId,
          stripeCheckoutSessionId: "cs_test_verify_data",
        }
      );

      expect(result.error).toBeNull();
      expect(result.userId).toBe(userId);
      expect(result.alreadyCompleted).toBe(false);
      expect(result.config).not.toBeNull();
    });

    it("returns alreadyCompleted for completed payments", async () => {
      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_done",
        status: "completed",
      });

      const result = await t.query(
        internal.queries.paymentConfigInternal.getVerifyData,
        {
          challengeId,
          stripeCheckoutSessionId: "cs_test_done",
        }
      );

      expect(result.error).toBeNull();
      expect(result.alreadyCompleted).toBe(true);
    });

    it("returns error when payment record not found", async () => {
      const result = await t.query(
        internal.queries.paymentConfigInternal.getVerifyData,
        {
          challengeId,
          stripeCheckoutSessionId: "cs_nonexistent",
        }
      );
      expect(result.error).toBe("Payment record not found");
    });
  });
});
