/**
 * Shared helpers for calling the Cloudflare REST API (Images + Stream).
 * Used by the direct-upload action (`actions/cloudflareMedia.ts`) and the
 * server-side upload path for Strava-synced photos (`actions/strava.ts`).
 */

export type CloudflareResult<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
};

/** Reads the Cloudflare account ID and API token from environment and throws if either is missing. */
export function cloudflareCredentials(): { accountId: string; apiToken: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set to call the Cloudflare API",
    );
  }
  return { accountId, apiToken };
}

/** Parses a Cloudflare API response, throwing on HTTP or `success=false` errors. */
export async function parseCloudflareResponse<T>(
  response: Response,
  label: string,
): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cloudflare ${label} failed: ${response.status} ${text}`);
  }
  const body = JSON.parse(text) as CloudflareResult<T>;
  if (!body.success) {
    const msg =
      body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ?? "(no error detail)";
    throw new Error(`Cloudflare ${label} returned success=false — ${msg}`);
  }
  return body.result;
}

/**
 * Upload a blob to Cloudflare Images (server-side, not via direct upload URL).
 * Returns the tagged ID `cfi:<id>`.
 */
export async function uploadBlobToCloudflareImages(
  blob: Blob,
  label: string,
): Promise<string> {
  const { accountId, apiToken } = cloudflareCredentials();
  const formData = new FormData();
  formData.append("file", blob);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    },
  );
  const result = await parseCloudflareResponse<{ id: string }>(response, `Images upload (${label})`);
  return `cfi:${result.id}`;
}

/**
 * Upload a blob to Cloudflare Stream (server-side).
 * Returns the tagged ID `cfs:<uid>`.
 */
export async function uploadBlobToCloudflareStream(
  blob: Blob,
  label: string,
): Promise<string> {
  const { accountId, apiToken } = cloudflareCredentials();
  const formData = new FormData();
  formData.append("file", blob);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    },
  );
  const result = await parseCloudflareResponse<{ uid: string }>(response, `Stream upload (${label})`);
  return `cfs:${result.uid}`;
}
