"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { betterAuthClient } from "@/lib/better-auth/client";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute -bottom-20 -right-20 h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">
              March Fitness
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (tokenError || !token) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 space-y-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              Invalid or expired link
            </h1>
            <p className="text-sm text-zinc-400">
              This password reset link is no longer valid. Please request a new
              one.
            </p>
          </div>

          <Link
            href="/forgot-password"
            className="block w-full rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Request New Link
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link
            href="/sign-in"
            className="text-indigo-400 transition hover:text-indigo-300"
          >
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 space-y-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              Password updated
            </h1>
            <p className="text-sm text-zinc-400">
              Your password has been reset. You can now sign in with your new
              password.
            </p>
          </div>

          <Link
            href="/sign-in"
            className="block w-full rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await betterAuthClient.resetPassword({
        newPassword: password,
        token: token!,
      });

      if (result.error) {
        setError("Failed to reset password. The link may have expired.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Set a new password
          </h1>
          <p className="text-sm text-zinc-400">
            Choose a new password for your account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Confirm password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              placeholder="Re-enter password"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link
          href="/sign-in"
          className="text-indigo-400 transition hover:text-indigo-300"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
