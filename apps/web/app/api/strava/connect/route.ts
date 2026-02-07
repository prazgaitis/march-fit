import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { getServerAuth } from "@/lib/server-auth";

const STATE_COOKIE = "strava_oauth_state";
const DEFAULT_SUCCESS_URL = "/integrations?success=strava_connected";
const DEFAULT_ERROR_URL = "/integrations?error=strava_auth_failed";

function sanitizeRedirectUrl(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

export async function GET(request: NextRequest) {
  const { userId } = await getServerAuth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/integrations");
  }

  const searchParams = request.nextUrl.searchParams;
  const successUrl = sanitizeRedirectUrl(searchParams.get("successUrl"), DEFAULT_SUCCESS_URL);
  const errorUrl = sanitizeRedirectUrl(searchParams.get("errorUrl"), DEFAULT_ERROR_URL);

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(
    JSON.stringify({
      nonce,
      successUrl,
      errorUrl,
    })
  ).toString("base64");

  const redirectUri = `${request.nextUrl.origin}/api/strava/callback`;
  const scope = "activity:read_all";

  const authUrl = `https://www.strava.com/oauth/authorize?` +
    `client_id=${process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${encodeURIComponent(state)}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: STATE_COOKIE,
    value: nonce,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
