"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { betterAuthClient } from "@/lib/better-auth/client";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await betterAuthClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        setError("Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black px-4 py-12 sm:px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-block">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">
                March Fitness
              </span>
            </Link>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mb-6 space-y-2 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">
                Check your email
              </h1>
              <p className="text-sm text-zinc-400">
                If an account exists for{" "}
                <span className="text-zinc-200">{email}</span>, we&apos;ve sent
                a password reset link.
              </p>
            </div>

            <Link
              href="/sign-in"
              className="block w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              Forgot your password?
            </h1>
            <p className="text-sm text-zinc-400">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                placeholder="you@example.com"
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
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Remember your password?{" "}
          <Link
            href="/sign-in"
            className="text-indigo-400 transition hover:text-indigo-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
