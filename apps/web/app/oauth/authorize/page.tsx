"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "profile:read": "View your profile (name, username, avatar)",
  "challenges:read": "View challenges you participate in",
  "activities:read": "View your logged activities",
  "activities:write": "Log activities on your behalf",
};

function ConsentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope");
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const appName = searchParams.get("app_name") || "Unknown App";
  const appDescription = searchParams.get("app_description");
  const appIcon = searchParams.get("app_icon");

  const scopes = scope?.split(" ").filter(Boolean) || [];

  if (!clientId || !redirectUri || !scope) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-xl font-bold">Invalid Request</h1>
          <p className="mt-2 text-zinc-400">Missing required authorization parameters.</p>
        </div>
      </div>
    );
  }

  async function handleAllow() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authorization failed");
        return;
      }

      // Redirect to the app with the authorization code
      window.location.href = data.redirect_uri;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri!);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "User denied the request");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur">
        {/* App Identity */}
        <div className="mb-6 text-center">
          {appIcon && (
            <img
              src={appIcon}
              alt={appName}
              className="mx-auto mb-4 h-16 w-16 rounded-xl"
            />
          )}
          <h1 className="text-xl font-bold tracking-tight text-white">
            Authorize {appName}
          </h1>
          {appDescription && (
            <p className="mt-2 text-sm text-zinc-400">{appDescription}</p>
          )}
        </div>

        {/* Requested Permissions */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            This app wants to:
          </p>
          <ul className="space-y-2">
            {scopes.map((s) => (
              <li
                key={s}
                className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <span className="mt-0.5 text-indigo-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="text-sm text-zinc-300">
                  {SCOPE_DESCRIPTIONS[s] || s}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDeny}
            disabled={loading}
          >
            Deny
          </Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            onClick={handleAllow}
            disabled={loading}
          >
            {loading ? "Authorizing..." : "Allow"}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          You can revoke access at any time from your settings.
        </p>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          Loading...
        </div>
      }
    >
      <ConsentForm />
    </Suspense>
  );
}
