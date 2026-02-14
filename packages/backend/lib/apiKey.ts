import { createHash, randomBytes } from "crypto";

const API_KEY_PREFIX = "mf_";

/**
 * Generate a new API key.
 * Format: mf_<32 random hex chars> (e.g., mf_a1b2c3d4e5f6...)
 * Returns { rawKey, keyHash, keyPrefix }
 */
export function generateApiKey(): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomPart = randomBytes(24).toString("hex"); // 48 hex chars
  const rawKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 11); // "mf_" + first 8 hex chars
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
