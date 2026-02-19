/**
 * Tests for Admin HTTP API: payment config endpoints.
 *
 * POST /api/v1/challenges/:id/payment-config
 * GET  /api/v1/challenges/:id/payment-config
 *
 * The HTTP routing layer is tested at the convex-test level by calling the
 * underlying internal mutations/queries directly (same pattern as http-api.test.ts).
 * Auth scenarios (401/403) are validated by asserting behaviour of the public
 * mutation that requires Convex identity (which the HTTP layer replaces with
 * API-key auth) and by verifying the admin check logic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "@repo/backend/_generated/dataModel";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read the raw DB record (to inspect stored/encrypted values). */
async function getRawConfig(
  t: Awaited<ReturnType<typeof createTestContext>>,
  challengeId: Id<"challenges">
) {
  return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
    return ctx.db
      .query("challengePaymentConfig")
      .withIndex("challengeId", (q) => q.eq("challengeId", challengeId))
      .first();
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Payment Config HTTP API — internal mutations/queries", () => {
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

  // ── 401 / 403 auth behaviour ───────────────────────────────────────────────

  describe("Auth: 401 — unauthenticated (no API key / no Convex identity)", () => {
    it("savePaymentConfig public mutation rejects unauthenticated callers", async () => {
      // Without a Convex identity the mutation calls getCurrentUser → null → throws
      await expect(
        t.mutation(api.mutations.paymentConfig.savePaymentConfig, {
          challengeId,
          testMode: false,
          priceInCents: 3000,
        })
      ).rejects.toThrow(/not authenticated/i);
    });
  });

  describe("Auth: 403 — authenticated but not challenge admin", () => {
    it("savePaymentConfig public mutation rejects non-admin users", async () => {
      const nonAdminId = await createTestUser(t, {
        email: "member@example.com",
        username: "member",
        role: "user",
      });

      const nonAdminT = t.withIdentity({
        subject: "subject-member@example.com",
        email: "member@example.com",
      });

      await expect(
        nonAdminT.mutation(api.mutations.paymentConfig.savePaymentConfig, {
          challengeId,
          testMode: false,
          priceInCents: 3000,
        })
      ).rejects.toThrow(/not authorized/i);
    });
  });

  // ── POST: savePaymentConfigInternal ───────────────────────────────────────

  describe("POST /api/v1/challenges/:id/payment-config (savePaymentConfigInternal)", () => {
    it("creates a new payment config with basic fields", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          currency: "usd",
        }
      );

      const raw = await getRawConfig(t, challengeId);
      expect(raw).not.toBeNull();
      expect(raw!.priceInCents).toBe(3000);
      expect(raw!.currency).toBe("usd");
      expect(raw!.testMode).toBe(false);
    });

    it("encrypts stripe secret key before storing", async () => {
      const rawSecretKey = "sk_live_supersecret";

      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          stripeSecretKey: rawSecretKey,
        }
      );

      const raw = await getRawConfig(t, challengeId);
      expect(raw).not.toBeNull();
      // The stored value must not equal the raw key (it's encrypted)
      expect(raw!.stripeSecretKey).toBeDefined();
      expect(raw!.stripeSecretKey).not.toBe(rawSecretKey);
    });

    it("encrypts all stripe secret/webhook keys before storing", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: true,
          priceInCents: 5000,
          stripeSecretKey: "sk_live_abc",
          stripeTestSecretKey: "sk_test_def",
          stripeWebhookSecret: "whsec_live",
          stripeTestWebhookSecret: "whsec_test",
        }
      );

      const raw = await getRawConfig(t, challengeId);
      expect(raw!.stripeSecretKey).not.toBe("sk_live_abc");
      expect(raw!.stripeTestSecretKey).not.toBe("sk_test_def");
      expect(raw!.stripeWebhookSecret).not.toBe("whsec_live");
      expect(raw!.stripeTestWebhookSecret).not.toBe("whsec_test");
    });

    it("stores publishable keys as plain text (not encrypted)", async () => {
      const pubKey = "pk_live_testpub";
      const testPubKey = "pk_test_testpub";

      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 2000,
          stripePublishableKey: pubKey,
          stripeTestPublishableKey: testPubKey,
        }
      );

      const raw = await getRawConfig(t, challengeId);
      // Publishable keys are public — stored as-is
      expect(raw!.stripePublishableKey).toBe(pubKey);
      expect(raw!.stripeTestPublishableKey).toBe(testPubKey);
    });

    it("updates an existing config without overwriting unspecified fields", async () => {
      // Initial create
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          stripePublishableKey: "pk_live_initial",
        }
      );

      // Update only price
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 4500,
        }
      );

      const raw = await getRawConfig(t, challengeId);
      expect(raw!.priceInCents).toBe(4500);
      // Original publishable key preserved
      expect(raw!.stripePublishableKey).toBe("pk_live_initial");
    });

    it("stores allowCustomAmount flag", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 1000,
          allowCustomAmount: true,
        }
      );

      const raw = await getRawConfig(t, challengeId);
      expect(raw!.allowCustomAmount).toBe(true);
    });

    it("returns { configId, updated: false } for new config", async () => {
      const result = await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
        }
      );
      expect(result.updated).toBe(false);
      expect(result.configId).toBeDefined();
    });

    it("returns { configId, updated: true } when updating existing config", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
        }
      );

      const result = await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: true,
          priceInCents: 5000,
        }
      );
      expect(result.updated).toBe(true);
    });
  });

  // ── GET: getPaymentConfigInternal ─────────────────────────────────────────

  describe("GET /api/v1/challenges/:id/payment-config (getPaymentConfigInternal)", () => {
    it("returns null when no config exists", async () => {
      const result = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );
      expect(result).toBeNull();
    });

    it("returns config with correct shape when config exists", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          currency: "usd",
          allowCustomAmount: false,
        }
      );

      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      expect(config).not.toBeNull();
      expect(config!.priceInCents).toBe(3000);
      expect(config!.currency).toBe("usd");
      expect(config!.testMode).toBe(false);
      expect(config!.allowCustomAmount).toBe(false);
    });

    it("NEVER returns raw secret key values — only boolean flags", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: true,
          priceInCents: 5000,
          stripeSecretKey: "sk_live_secret",
          stripeTestSecretKey: "sk_test_secret",
          stripeWebhookSecret: "whsec_live",
          stripeTestWebhookSecret: "whsec_test",
        }
      );

      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      // Must have boolean flags
      expect(config!.hasLiveKeys).toBe(false); // no live publishable key → false
      expect(config!.hasTestKeys).toBe(false); // no test publishable key → false
      expect(config!.hasWebhookSecret).toBe(true);
      expect(config!.hasTestWebhookSecret).toBe(true);

      // Must NOT have any raw secret key fields in the response
      expect((config as any).stripeSecretKey).toBeUndefined();
      expect((config as any).stripeTestSecretKey).toBeUndefined();
      expect((config as any).stripeWebhookSecret).toBeUndefined();
      expect((config as any).stripeTestWebhookSecret).toBeUndefined();
    });

    it("hasLiveKeys is true only when BOTH live secret and publishable keys are set", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          stripeSecretKey: "sk_live_abc",
          stripePublishableKey: "pk_live_abc",
        }
      );

      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      expect(config!.hasLiveKeys).toBe(true);
    });

    it("hasLiveKeys is false when only one of the live key pair is set", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          stripeSecretKey: "sk_live_abc",
          // stripePublishableKey omitted
        }
      );

      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      expect(config!.hasLiveKeys).toBe(false);
    });

    it("hasTestKeys is true only when BOTH test secret and publishable keys are set", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: true,
          priceInCents: 3000,
          stripeTestSecretKey: "sk_test_abc",
          stripeTestPublishableKey: "pk_test_abc",
        }
      );

      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      expect(config!.hasTestKeys).toBe(true);
    });

    it("returns publishable keys in plain text (safe to expose)", async () => {
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: false,
          priceInCents: 3000,
          stripePublishableKey: "pk_live_public",
          stripeTestPublishableKey: "pk_test_public",
        }
      );

      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      expect(config!.stripePublishableKey).toBe("pk_live_public");
      expect(config!.stripeTestPublishableKey).toBe("pk_test_public");
    });

    it("POST then GET round-trip: admin saves config and retrieves masked version", async () => {
      // Simulate POST
      await t.mutation(
        internal.mutations.paymentConfig.savePaymentConfigInternal,
        {
          challengeId,
          testMode: true,
          priceInCents: 2999,
          currency: "usd",
          stripeSecretKey: "sk_live_secret",
          stripePublishableKey: "pk_live_public",
          stripeTestSecretKey: "sk_test_secret",
          stripeTestPublishableKey: "pk_test_public",
          stripeWebhookSecret: "whsec_live123",
          allowCustomAmount: true,
        }
      );

      // Simulate GET
      const config = await t.query(
        internal.queries.paymentConfig.getPaymentConfigInternal,
        { challengeId }
      );

      expect(config).not.toBeNull();
      expect(config!.priceInCents).toBe(2999);
      expect(config!.currency).toBe("usd");
      expect(config!.testMode).toBe(true);
      expect(config!.allowCustomAmount).toBe(true);
      expect(config!.hasLiveKeys).toBe(true);
      expect(config!.hasTestKeys).toBe(true);
      expect(config!.hasWebhookSecret).toBe(true);
      expect(config!.hasTestWebhookSecret).toBe(false);

      // Publishable keys returned as-is
      expect(config!.stripePublishableKey).toBe("pk_live_public");
      expect(config!.stripeTestPublishableKey).toBe("pk_test_public");

      // Secret keys NOT present
      expect((config as any).stripeSecretKey).toBeUndefined();
      expect((config as any).stripeTestSecretKey).toBeUndefined();
      expect((config as any).stripeWebhookSecret).toBeUndefined();
    });
  });
});
