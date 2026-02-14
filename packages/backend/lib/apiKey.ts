const API_KEY_PREFIX = "mf_";

/**
 * Generate a new API key.
 * Format: mf_<48 random hex chars>
 * Returns { rawKey, keyHash, keyPrefix }
 */
export async function generateApiKey(): Promise<{
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 11); // "mf_" + first 8 hex chars
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256.
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
