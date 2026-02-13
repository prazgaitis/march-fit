#!/usr/bin/env npx tsx

/**
 * Strava Webhook Subscription Management Script
 *
 * Usage:
 *   npx tsx scripts/strava-webhook.ts view      # View existing subscriptions
 *   npx tsx scripts/strava-webhook.ts create    # Create a new subscription
 *   npx tsx scripts/strava-webhook.ts delete    # Delete existing subscription
 *
 * Required environment variables:
 *   NEXT_PUBLIC_STRAVA_CLIENT_ID - Strava app client ID
 *   STRAVA_CLIENT_SECRET - Strava app client secret
 *   STRAVA_VERIFY_TOKEN - Random string for webhook verification
 *   STRAVA_WEBHOOK_URL - Your webhook callback URL (e.g., https://yourdomain.com/api/webhooks/strava)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env.local" }); // fill in any vars not in .env.production

const CLIENT_ID = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN;
const DEFAULT_WEBHOOK_URL = process.env.CONVEX_SITE_URL
  ? `${process.env.CONVEX_SITE_URL}/strava/webhook`
  : "https://canny-labrador-252.convex.site/strava/webhook";
const CALLBACK_URL = process.env.STRAVA_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL;

const STRAVA_API = "https://www.strava.com/api/v3/push_subscriptions";

async function viewSubscriptions() {
  console.log("Fetching existing Strava webhook subscriptions...\n");

  const url = `${STRAVA_API}?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to fetch subscriptions:", error);
    process.exit(1);
  }

  const subscriptions = await response.json();

  if (subscriptions.length === 0) {
    console.log("No webhook subscriptions found.");
  } else {
    console.log("Existing subscriptions:");
    for (const sub of subscriptions) {
      console.log(`  ID: ${sub.id}`);
      console.log(`  Callback URL: ${sub.callback_url}`);
      console.log(`  Created: ${sub.created_at}`);
      console.log(`  Updated: ${sub.updated_at}`);
      console.log("");
    }
  }

  return subscriptions;
}

async function createSubscription() {
  if (!VERIFY_TOKEN) {
    console.error("Error: STRAVA_VERIFY_TOKEN environment variable is not set.");
    console.error("Set it to a random string that matches your webhook route, e.g.:");
    console.error("  export STRAVA_VERIFY_TOKEN=your-random-secret-token");
    process.exit(1);
  }

  console.log("Creating Strava webhook subscription...\n");
  console.log(`  Callback URL: ${CALLBACK_URL}`);
  console.log(`  Verify Token: ${VERIFY_TOKEN.substring(0, 4)}...`);
  console.log("");

  const formData = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    callback_url: CALLBACK_URL,
    verify_token: VERIFY_TOKEN,
  });

  const response = await fetch(STRAVA_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Failed to create subscription:");
    console.error(JSON.stringify(error, null, 2));

    if (error.errors?.[0]?.code === "already exists") {
      console.log("\nA subscription already exists. Use 'view' to see it or 'delete' to remove it first.");
    }

    process.exit(1);
  }

  const result = await response.json();
  console.log("Subscription created successfully!");
  console.log(`  Subscription ID: ${result.id}`);
}

async function deleteSubscription() {
  const subscriptions = await viewSubscriptions();

  if (subscriptions.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const subId = subscriptions[0].id;
  console.log(`Deleting subscription ${subId}...`);

  const url = `${STRAVA_API}/${subId}?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  const response = await fetch(url, { method: "DELETE" });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to delete subscription:", error);
    process.exit(1);
  }

  console.log("Subscription deleted successfully!");
}

async function main() {
  // Validate required env vars
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Error: Missing required environment variables.");
    console.error("Required:");
    console.error("  NEXT_PUBLIC_STRAVA_CLIENT_ID");
    console.error("  STRAVA_CLIENT_SECRET");
    process.exit(1);
  }

  const command = process.argv[2] || "view";

  switch (command) {
    case "view":
      await viewSubscriptions();
      break;
    case "create":
      await createSubscription();
      break;
    case "delete":
      await deleteSubscription();
      break;
    default:
      console.log("Usage: npx tsx scripts/strava-webhook.ts [view|create|delete]");
      console.log("");
      console.log("Commands:");
      console.log("  view    - View existing webhook subscriptions");
      console.log("  create  - Create a new webhook subscription");
      console.log("  delete  - Delete the existing webhook subscription");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
