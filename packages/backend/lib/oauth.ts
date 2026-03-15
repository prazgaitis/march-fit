/**
 * OAuth 2.0 Provider helpers for "Login with March Fit".
 *
 * Token prefixes:
 *   mfapp_  — client ID
 *   mfcs_   — client secret
 *   mfac_   — authorization code
 *   mfoauth_ — access token
 *   mfrt_   — refresh token
 */

// ─── Constants ─────────────────────────────────────────────────────────────

export const OAUTH_CLIENT_ID_PREFIX = "mfapp_";
export const OAUTH_CLIENT_SECRET_PREFIX = "mfcs_";
export const OAUTH_AUTH_CODE_PREFIX = "mfac_";
export const OAUTH_ACCESS_TOKEN_PREFIX = "mfoauth_";
export const OAUTH_REFRESH_TOKEN_PREFIX = "mfrt_";

/** Access tokens expire after 1 hour */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Refresh tokens expire after 30 days */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Authorization codes expire after 10 minutes */
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

/** Valid OAuth scopes */
export const VALID_SCOPES = [
  "profile:read",
  "challenges:read",
  "activities:read",
  "activities:write",
] as const;

export type OAuthScope = (typeof VALID_SCOPES)[number];

// ─── Token Generation ──────────────────────────────────────────────────────

function generateRandom(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashToken(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateClientId(): string {
  return `${OAUTH_CLIENT_ID_PREFIX}${generateRandom(16)}`;
}

export async function generateClientSecret(): Promise<{
  raw: string;
  hash: string;
  prefix: string;
}> {
  const raw = `${OAUTH_CLIENT_SECRET_PREFIX}${generateRandom(32)}`;
  const hash = await hashToken(raw);
  const prefix = raw.slice(0, OAUTH_CLIENT_SECRET_PREFIX.length + 8);
  return { raw, hash, prefix };
}

export async function generateAuthCode(): Promise<{
  raw: string;
}> {
  const raw = `${OAUTH_AUTH_CODE_PREFIX}${generateRandom(32)}`;
  return { raw };
}

export async function generateAccessToken(): Promise<{
  raw: string;
  hash: string;
  prefix: string;
}> {
  const raw = `${OAUTH_ACCESS_TOKEN_PREFIX}${generateRandom(32)}`;
  const hash = await hashToken(raw);
  const prefix = raw.slice(0, OAUTH_ACCESS_TOKEN_PREFIX.length + 8);
  return { raw, hash, prefix };
}

export async function generateRefreshToken(): Promise<{
  raw: string;
  hash: string;
  prefix: string;
}> {
  const raw = `${OAUTH_REFRESH_TOKEN_PREFIX}${generateRandom(32)}`;
  const hash = await hashToken(raw);
  const prefix = raw.slice(0, OAUTH_REFRESH_TOKEN_PREFIX.length + 8);
  return { raw, hash, prefix };
}

// ─── PKCE ──────────────────────────────────────────────────────────────────

/**
 * Verify a PKCE code_verifier against a stored code_challenge (S256 method).
 */
export async function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  const encoded = new TextEncoder().encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  // Base64url encode the hash
  const base64url = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64url === codeChallenge;
}

// ─── Scope Validation ──────────────────────────────────────────────────────

export function validateScopes(scopes: string[]): scopes is OAuthScope[] {
  return scopes.every((s) =>
    (VALID_SCOPES as readonly string[]).includes(s)
  );
}

export function scopesAreSubset(
  requested: string[],
  allowed: string[]
): boolean {
  return requested.every((s) => allowed.includes(s));
}

// ─── Scope requirements per API endpoint pattern ───────────────────────────

/**
 * Returns the required OAuth scopes for a given HTTP method + route pattern.
 * Returns null if the endpoint is not accessible via OAuth tokens.
 */
export function getRequiredScopes(
  method: string,
  pattern: string
): OAuthScope[] | null {
  // Profile
  if (pattern === "/api/v1/me") return ["profile:read"];

  // Challenges (read)
  if (method === "GET" && pattern.startsWith("/api/v1/challenges"))
    return ["challenges:read"];

  // Activities (read)
  if (method === "GET" && pattern.startsWith("/api/v1/activities"))
    return ["activities:read"];

  // Activities (write) — POST to challenge activities
  if (
    method === "POST" &&
    pattern === "/api/v1/challenges/:id/activities"
  )
    return ["activities:write"];

  // Activity delete
  if (method === "DELETE" && pattern.startsWith("/api/v1/activities"))
    return ["activities:write"];

  // OAuth endpoints don't need scope checks (handled separately)
  if (pattern.startsWith("/api/v1/oauth")) return null;

  // All other endpoints are not accessible via OAuth tokens
  return null;
}
