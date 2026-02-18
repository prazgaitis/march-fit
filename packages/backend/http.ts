import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { decryptKey } from "./lib/stripe";
import { authComponent, createAuth } from "./auth";
import { apiV1Router } from "./httpApi";

const http = httpRouter();
const STRAVA_OBJECT_TYPES = new Set(["activity", "athlete"]);
const STRAVA_ASPECT_TYPES = new Set(["create", "update", "delete"]);

type StravaWebhookPayload = Record<string, unknown> & {
  object_type: "activity" | "athlete";
  aspect_type: "create" | "update" | "delete";
};

function isStravaWebhookPayload(value: unknown): value is StravaWebhookPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.object_type === "string" &&
    STRAVA_OBJECT_TYPES.has(payload.object_type) &&
    typeof payload.aspect_type === "string" &&
    STRAVA_ASPECT_TYPES.has(payload.aspect_type)
  );
}

// Register Better Auth routes
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.SITE_URL || "",
      // Also allow www variant (matches trustedOrigins in auth.ts)
      ...(process.env.SITE_URL
        ? [process.env.SITE_URL.replace("://", "://www.")]
        : []),
    ].filter(Boolean),
  },
});

/**
 * Stripe webhook endpoint
 *
 * This endpoint receives webhook events from Stripe and processes payment confirmations.
 * Each challenge can have its own Stripe account, so we need to:
 * 1. Parse the event to get the challenge ID from metadata
 * 2. Look up the challenge's webhook secret
 * 3. Verify the signature
 * 4. Process the event
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Parse the event without verification first to get metadata
    let unverifiedEvent: Stripe.Event;
    try {
      unverifiedEvent = JSON.parse(body) as Stripe.Event;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // Get challengeId from the event metadata
    let challengeId: string | undefined;

    if (unverifiedEvent.type === "checkout.session.completed") {
      const session = unverifiedEvent.data.object as Stripe.Checkout.Session;
      challengeId = session.metadata?.challengeId;
    } else if (
      unverifiedEvent.type === "payment_intent.succeeded" ||
      unverifiedEvent.type === "payment_intent.payment_failed"
    ) {
      const paymentIntent = unverifiedEvent.data.object as Stripe.PaymentIntent;
      challengeId = paymentIntent.metadata?.challengeId;
    }

    if (!challengeId) {
      // Event doesn't have challenge metadata - might be a general Stripe event
      // Just acknowledge it
      return new Response("OK - no challenge metadata", { status: 200 });
    }

    // Look up the challenge's payment config to get the webhook secret
    const config = await ctx.runQuery(internal.queries.paymentConfigInternal.getConfigForWebhook, {
      challengeId: challengeId as any,
    });

    if (!config) {
      console.error("Payment config not found for challenge:", challengeId);
      return new Response("Payment config not found", { status: 400 });
    }

    // Get the appropriate webhook secret
    const encryptedWebhookSecret = config.testMode
      ? config.stripeTestWebhookSecret
      : config.stripeWebhookSecret;

    if (!encryptedWebhookSecret) {
      // No webhook secret configured - process without verification
      // (Not recommended for production, but allows testing)
      console.warn("Webhook secret not configured for challenge:", challengeId);
    } else {
      // Verify the webhook signature
      try {
        const webhookSecret = decryptKey(encryptedWebhookSecret);
        const stripe = new Stripe(webhookSecret, { apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion });
        stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response("Webhook signature verification failed", { status: 400 });
      }
    }

    // Process the event
    try {
      switch (unverifiedEvent.type) {
        case "checkout.session.completed": {
          const session = unverifiedEvent.data.object as Stripe.Checkout.Session;

          if (session.payment_status === "paid") {
            await ctx.runMutation(internal.mutations.payments.handlePaymentSuccess, {
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string | undefined,
              stripeCustomerId: session.customer as string | undefined,
              stripeCustomerEmail: session.customer_email || undefined,
              amountInCents: session.amount_total ?? undefined, // Actual amount paid (captures donation overpay)
            });
          }
          break;
        }

        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const session = unverifiedEvent.data.object as Stripe.Checkout.Session;

          await ctx.runMutation(internal.mutations.payments.handlePaymentFailure, {
            stripeCheckoutSessionId: session.id,
            failureReason:
              unverifiedEvent.type === "checkout.session.expired"
                ? "Session expired"
                : "Payment failed",
          });
          break;
        }

        default:
          // Unhandled event type - just acknowledge
          console.log("Unhandled Stripe event type:", unverifiedEvent.type);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return new Response("Webhook processing error", { status: 500 });
    }
  }),
});

/**
 * Strava webhook verification endpoint (GET)
 * Called by Strava when setting up webhook subscription
 */
http.route({
  path: "/strava/webhook",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.STRAVA_VERIFY_TOKEN) {
      console.log("Strava webhook subscription verified");
      return new Response(JSON.stringify({ "hub.challenge": challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid verification token" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/**
 * Strava webhook event handler (POST)
 * Stores raw payload and delegates processing to internalAction
 */
http.route({
  path: "/strava/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let payloadId: string | null = null;

    try {
      const body = await request.json();
      if (!isStravaWebhookPayload(body)) {
        throw new Error("Invalid Strava webhook payload");
      }
      const eventType = `${body.object_type}.${body.aspect_type}`;

      // Store raw webhook payload immediately
      payloadId = await ctx.runMutation(
        internal.mutations.webhookPayloads.store,
        {
          service: "strava" as const,
          eventType,
          payload: body,
        }
      );

      // Delegate all processing to the internalAction
      await ctx.runAction(
        internal.actions.strava.processStravaWebhook,
        {
          payloadId,
          event: body,
        }
      );
    } catch (error) {
      console.error("Strava Webhook Error:", error);

      // Mark payload as failed if we managed to store it
      if (payloadId) {
        try {
          await ctx.runMutation(internal.mutations.webhookPayloads.updateStatus, {
            payloadId: payloadId as any,
            status: "failed" as const,
            error: error instanceof Error ? error.message : String(error),
          });
        } catch (updateError) {
          console.error("Failed to update webhook payload status:", updateError);
        }
      }
    }

    // Always return 200 to Strava to prevent retries (payload stored for reprocessing)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ─── REST API v1 ─────────────────────────────────────────────────────────────
// All /api/v1/* routes are handled by the API router.
// Register each HTTP method with pathPrefix to catch all API routes.
const API_V1_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
for (const method of API_V1_METHODS) {
  http.route({
    pathPrefix: "/api/v1/",
    method,
    handler: apiV1Router,
  });
}

export default http;
