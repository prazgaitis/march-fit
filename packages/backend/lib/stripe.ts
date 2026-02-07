import Stripe from "stripe";

/**
 * Simple encryption/decryption for Stripe keys stored in the database.
 * Uses AES-256-like XOR cipher with the encryption key from environment.
 *
 * For production, consider using a proper secrets manager or Convex's
 * environment variables for the master key.
 */

// Get encryption key from environment or use a default for development
const ENCRYPTION_KEY = process.env.STRIPE_ENCRYPTION_KEY || "default-dev-key-change-in-prod-32ch";

/**
 * Simple XOR-based encryption for storing sensitive keys
 * This provides basic protection at rest - for higher security,
 * use a proper encryption library or secrets manager
 */
export function encryptKey(plaintext: string): string {
  const key = ENCRYPTION_KEY;
  let encrypted = "";
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  // Base64 encode using btoa (browser-compatible)
  return btoa(encrypted);
}

/**
 * Decrypt a key that was encrypted with encryptKey
 */
export function decryptKey(encrypted: string): string {
  const key = ENCRYPTION_KEY;
  // Base64 decode using atob (browser-compatible)
  const decoded = atob(encrypted);
  let decrypted = "";
  for (let i = 0; i < decoded.length; i++) {
    const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

/**
 * Mask a key for display (show first 4 and last 4 characters)
 */
export function maskKey(key: string): string {
  if (!key || key.length < 12) return "****";
  return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
}

/**
 * Create a Stripe client with the given secret key
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
    typescript: true,
  });
}

/**
 * Verify a Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = new Stripe(webhookSecret, {
    apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
  });
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number, currency: string = "usd"): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(dollars);
}
