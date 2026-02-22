/**
 * Tests for on_signup email triggering.
 *
 * Covers:
 * - triggerOnSignup creates emailSends records for enabled sequences
 * - triggerOnSignup skips disabled/manual sequences and prevents duplicates
 * - participations.join() succeeds with and without email sequences
 * - handlePaymentSuccess and completeVerification trigger email scheduling
 *
 * Note: The Resend API key is not set in tests, so actual email delivery will
 * fail. The triggerOnSignup handler catches those errors and marks sends as
 * "failed". These tests verify the scheduling and DB logic.
 *
 * Scheduled functions (ctx.scheduler.runAfter) cannot be fully exercised in
 * convex-test. The triggerOnSignup logic is therefore tested directly via
 * internal mutation calls, and the join/payment tests verify that the mutations
 * succeed and that the scheduling-check code path does not error.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "@repo/backend/_generated/api";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestParticipation,
  createTestPaymentRecord,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "@repo/backend/_generated/dataModel";

/**
 * Insert an emailSequence for a challenge.
 */
async function createEmailSequence(
  t: ReturnType<typeof createTestContext>,
  challengeId: Id<"challenges">,
  overrides: Partial<DataModel["emailSequences"]["document"]> = {},
): Promise<Id<"emailSequences">> {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db.insert("emailSequences", {
      challengeId,
      name: "Welcome Email",
      subject: "Welcome!",
      body: "<p>Welcome to the challenge!</p>",
      trigger: "on_signup",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  });
}

/**
 * Get all emailSends for a given user and challenge.
 */
async function getEmailSends(
  t: ReturnType<typeof createTestContext>,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
) {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db
      .query("emailSends")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("challengeId"), challengeId),
        ),
      )
      .collect();
  });
}

describe("Signup email triggering", () => {
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

  // ── triggerOnSignup internal mutation ─────────────────────────

  describe("triggerOnSignup", () => {
    it("creates emailSends records for enabled on_signup sequences", async () => {
      const seqId = await createEmailSequence(t, challengeId);

      await t.mutation(internal.mutations.emailSequences.triggerOnSignup, {
        challengeId,
        userId,
      });

      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(1);
      expect(sends[0].emailSequenceId).toBe(seqId);
      expect(sends[0].userId).toBe(userId);
      // Status will be "failed" because Resend API key isn't set in tests,
      // but the record is created, proving the trigger logic executed.
      expect(["pending", "sent", "failed"]).toContain(sends[0].status);
    });

    it("skips disabled on_signup sequences", async () => {
      await createEmailSequence(t, challengeId, { enabled: false });

      const result = await t.mutation(
        internal.mutations.emailSequences.triggerOnSignup,
        { challengeId, userId },
      );

      expect(result.sent).toBe(0);
      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(0);
    });

    it("skips manual trigger sequences", async () => {
      await createEmailSequence(t, challengeId, { trigger: "manual" });

      const result = await t.mutation(
        internal.mutations.emailSequences.triggerOnSignup,
        { challengeId, userId },
      );

      expect(result.sent).toBe(0);
      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(0);
    });

    it("does not send duplicate emails", async () => {
      await createEmailSequence(t, challengeId);

      // Trigger once
      await t.mutation(internal.mutations.emailSequences.triggerOnSignup, {
        challengeId,
        userId,
      });

      // Trigger again — should not create another send
      await t.mutation(internal.mutations.emailSequences.triggerOnSignup, {
        challengeId,
        userId,
      });

      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(1);
    });

    it("handles multiple on_signup sequences (sends to all enabled)", async () => {
      await createEmailSequence(t, challengeId, {
        name: "Welcome 1",
        subject: "Welcome 1",
      });
      await createEmailSequence(t, challengeId, {
        name: "Welcome 2",
        subject: "Welcome 2",
      });
      await createEmailSequence(t, challengeId, {
        name: "Disabled Welcome",
        subject: "Disabled",
        enabled: false,
      });

      await t.mutation(internal.mutations.emailSequences.triggerOnSignup, {
        challengeId,
        userId,
      });

      const sends = await getEmailSends(t, userId, challengeId);
      // Should create sends for the 2 enabled sequences, not the disabled one
      expect(sends).toHaveLength(2);
    });

    it("sends enabled sequences even when first sequence is disabled (regression)", async () => {
      // This was the original bug: .first() only checked the first sequence
      await createEmailSequence(t, challengeId, {
        name: "Disabled First",
        enabled: false,
      });
      await createEmailSequence(t, challengeId, {
        name: "Enabled Second",
        enabled: true,
      });

      await t.mutation(internal.mutations.emailSequences.triggerOnSignup, {
        challengeId,
        userId,
      });

      const sends = await getEmailSends(t, userId, challengeId);
      // Only 1 send because only 1 of the 2 sequences is enabled
      expect(sends).toHaveLength(1);
    });

    it("returns 0 when no sequences exist", async () => {
      const result = await t.mutation(
        internal.mutations.emailSequences.triggerOnSignup,
        { challengeId, userId },
      );

      expect(result.sent).toBe(0);
      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(0);
    });
  });

  // ── participations.join() email trigger ───────────────────────

  describe("participations.join() email scheduling", () => {
    it("succeeds when no email sequences exist", async () => {
      const joinerAuth = t.withIdentity({
        subject: "joiner-id",
        email: "user@example.com",
      });

      const participationId = await joinerAuth.mutation(
        api.mutations.participations.join,
        { challengeId },
      );

      expect(participationId).toBeDefined();
    });

    it("succeeds when only disabled on_signup sequences exist (no scheduling)", async () => {
      await createEmailSequence(t, challengeId, { enabled: false });

      const joinerAuth = t.withIdentity({
        subject: "joiner-id",
        email: "user@example.com",
      });

      const participationId = await joinerAuth.mutation(
        api.mutations.participations.join,
        { challengeId },
      );

      expect(participationId).toBeDefined();
    });

    it("succeeds when only manual sequences exist (no scheduling)", async () => {
      await createEmailSequence(t, challengeId, { trigger: "manual" });

      const joinerAuth = t.withIdentity({
        subject: "joiner-id",
        email: "user@example.com",
      });

      const participationId = await joinerAuth.mutation(
        api.mutations.participations.join,
        { challengeId },
      );

      expect(participationId).toBeDefined();
    });
  });

  // ── Payment flow email trigger ────────────────────────────────

  describe("handlePaymentSuccess email scheduling", () => {
    it("succeeds without on_signup sequences", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_no_emails",
      });

      const result = await t.mutation(
        internal.mutations.payments.handlePaymentSuccess,
        { stripeCheckoutSessionId: "cs_test_no_emails" },
      );

      expect(result.success).toBe(true);

      // No email sends should be created
      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(0);
    });

    it("marks participation as paid", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_paid",
      });

      const result = await t.mutation(
        internal.mutations.payments.handlePaymentSuccess,
        {
          stripeCheckoutSessionId: "cs_test_paid",
          stripePaymentIntentId: "pi_test_123",
        },
      );

      expect(result.success).toBe(true);

      const participation = await t.run(
        async (ctx: GenericMutationCtx<DataModel>) => {
          return ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q) =>
              q.eq("userId", userId).eq("challengeId", challengeId),
            )
            .first();
        },
      );
      expect(participation!.paymentStatus).toBe("paid");
    });
  });

  describe("completeVerification email scheduling", () => {
    it("succeeds without on_signup sequences", async () => {
      await createTestParticipation(t, userId as string, challengeId as string, {
        paymentStatus: "pending",
      });

      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_verify_no_email",
      });

      const result = await t.mutation(
        internal.mutations.payments.completeVerification,
        {
          userId,
          challengeId,
          sessionId: "cs_test_verify_no_email",
          stripePaymentIntentId: "pi_verify_123",
        },
      );

      expect(result.success).toBe(true);

      const participation = await t.run(
        async (ctx: GenericMutationCtx<DataModel>) => {
          return ctx.db
            .query("userChallenges")
            .withIndex("userChallengeUnique", (q) =>
              q.eq("userId", userId).eq("challengeId", challengeId),
            )
            .first();
        },
      );
      expect(participation!.paymentStatus).toBe("paid");
    });

    it("does not trigger emails for already completed payments", async () => {
      await createEmailSequence(t, challengeId);

      await createTestPaymentRecord(t, userId as string, challengeId as string, {
        stripeCheckoutSessionId: "cs_test_already_done",
        status: "completed",
      });

      const result = await t.mutation(
        internal.mutations.payments.completeVerification,
        {
          userId,
          challengeId,
          sessionId: "cs_test_already_done",
        },
      );

      expect(result.success).toBe(true);
      expect(result.alreadyCompleted).toBe(true);

      // No email sends should be created (already completed)
      const sends = await getEmailSends(t, userId, challengeId);
      expect(sends).toHaveLength(0);
    });
  });
});
