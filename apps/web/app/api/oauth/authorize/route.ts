import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { getServerConvexSiteUrl } from "@/lib/server-convex-env";

/**
 * POST /api/oauth/authorize
 *
 * Called by the consent page after the user clicks "Allow".
 * Forwards the authorization grant to the Convex HTTP API which creates the
 * auth code and returns the redirect URI.
 */
export async function POST(request: NextRequest) {
  const auth = await getServerAuth();
  if (!auth.userId) {
    return NextResponse.json(
      { error: "Not authenticated. Please sign in first." },
      { status: 401 }
    );
  }

  const body = await request.json();

  // Forward to Convex HTTP API
  const convexSiteUrl = getServerConvexSiteUrl();
  const res = await fetch(`${convexSiteUrl}/api/v1/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      user_id: auth.userId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data);
}
