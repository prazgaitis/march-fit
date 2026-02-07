import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend";

import { getServerAuth } from "@/lib/server-auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const STATE_COOKIE = "strava_oauth_state";
const DEFAULT_SUCCESS_URL = "/integrations?success=strava_connected";
const DEFAULT_ERROR_URL = "/integrations?error=strava_auth_failed";

function sanitizeRedirectUrl(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

function redirectWithCookieClear(request: NextRequest, url: string, clearState: boolean) {
  const response = NextResponse.redirect(new URL(url, request.url));
  if (clearState) {
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    username: string;
    profile: string;
  };
}

export async function GET(request: NextRequest) {
  const { userId, convexToken } = await getServerAuth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in?redirect_url=/integrations", request.url));
  }

  // Get the authorization code from the URL
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  let successUrl = DEFAULT_SUCCESS_URL;
  let errorUrl = DEFAULT_ERROR_URL;
  let stateNonce: string | null = null;

  // Parse state if provided
  if (state) {
    try {
      const decodedState = Buffer.from(state, "base64").toString("utf-8");
      const parsedState = JSON.parse(decodedState);
      if (parsedState.successUrl) successUrl = parsedState.successUrl;
      if (parsedState.errorUrl) errorUrl = parsedState.errorUrl;
      if (parsedState.nonce) stateNonce = parsedState.nonce;
    } catch {
      // Invalid state, use defaults
    }
  }

  successUrl = sanitizeRedirectUrl(successUrl, DEFAULT_SUCCESS_URL);
  errorUrl = sanitizeRedirectUrl(errorUrl, DEFAULT_ERROR_URL);

  const cookieNonce = request.cookies.get(STATE_COOKIE)?.value ?? null;
  if (!stateNonce || !cookieNonce || stateNonce !== cookieNonce) {
    console.error("Strava OAuth state mismatch");
    return redirectWithCookieClear(request, errorUrl, true);
  }

  if (error || !code) {
    console.error("Strava OAuth error:", error);
    return redirectWithCookieClear(request, errorUrl, true);
  }

  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Strava token exchange failed:", errorText);
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = (await tokenResponse.json()) as StravaTokenResponse;

    // Get auth token for authenticated Convex call
    if (convexToken) {
      convex.setAuth(convexToken);
    }

    // Store the tokens in Convex
    await convex.mutation(api.mutations.integrations.connectStrava, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athleteId: tokenData.athlete.id,
    });

    console.log(
      `Strava connected for athlete ${tokenData.athlete.id} (${tokenData.athlete.username})`
    );
  } catch (err) {
    console.error("Error connecting Strava:", err);
    return redirectWithCookieClear(request, errorUrl, true);
  }

  // Redirect must be outside try/catch due to Next.js behavior
  return redirectWithCookieClear(request, successUrl, true);
}
