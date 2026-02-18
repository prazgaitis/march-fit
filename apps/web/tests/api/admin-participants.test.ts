import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@repo/backend';
import { createTestContext, createTestUser, createTestChallenge } from '../helpers/convex';

describe('Admin Participants - Payment Display', () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  describe('getParticipants with payment status', () => {
    it('should return payment status when challenge requires payment', async () => {
      // Setup
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Add participant
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

        // Add payment config to make it require payment
        await ctx.db.insert("challengePaymentConfig", {
          challengeId,
          testMode: true,
          priceInCents: 5000, // $50
          currency: "usd",
          stripeTestSecretKey: "test_secret",
          stripeTestPublishableKey: "test_publishable",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Execute
      const participants = await t.query(api.queries.challenges.getParticipants, {
        challengeId,
        limit: 100,
      });

      const paymentInfo = await t.query(api.queries.paymentConfig.getPublicPaymentInfo, {
        challengeId,
      });

      // Assert
      expect(participants).toBeDefined();
      expect(participants.length).toBe(1);
      expect(participants[0].paymentStatus).toBe("paid");
      expect(paymentInfo.requiresPayment).toBe(true);
    });

    it('should allow N/A display when challenge does not require payment', async () => {
      // Setup
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Add participant (no payment config = no payment required)
      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid", // This should be ignored when payment not required
          updatedAt: Date.now(),
        });
      });

      // Execute
      const participants = await t.query(api.queries.challenges.getParticipants, {
        challengeId,
        limit: 100,
      });

      const paymentInfo = await t.query(api.queries.paymentConfig.getPublicPaymentInfo, {
        challengeId,
      });

      // Assert
      expect(participants).toBeDefined();
      expect(participants.length).toBe(1);
      // Payment status exists in data but UI should show N/A
      expect(participants[0].paymentStatus).toBe("paid");
      // Payment info should indicate no payment required
      expect(paymentInfo.requiresPayment).toBe(false);
      expect(paymentInfo.priceInCents).toBe(0);
    });

    it('should indicate no payment required when payment config exists but price is zero', async () => {
      // Setup
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Add participant
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

        // Add payment config with zero price
        await ctx.db.insert("challengePaymentConfig", {
          challengeId,
          testMode: true,
          priceInCents: 0, // Free
          currency: "usd",
          stripeTestSecretKey: "test_secret",
          stripeTestPublishableKey: "test_publishable",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Execute
      const paymentInfo = await t.query(api.queries.paymentConfig.getPublicPaymentInfo, {
        challengeId,
      });

      // Assert
      expect(paymentInfo.requiresPayment).toBe(false);
      expect(paymentInfo.priceInCents).toBe(0);
    });

    it('should indicate no payment required when payment config exists but keys are missing', async () => {
      // Setup
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Add participant
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

        // Add payment config without required keys
        await ctx.db.insert("challengePaymentConfig", {
          challengeId,
          testMode: true,
          priceInCents: 5000,
          currency: "usd",
          // Missing stripeTestSecretKey and stripeTestPublishableKey
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Execute
      const paymentInfo = await t.query(api.queries.paymentConfig.getPublicPaymentInfo, {
        challengeId,
      });

      // Assert
      expect(paymentInfo.requiresPayment).toBe(false);
    });
  });
});
