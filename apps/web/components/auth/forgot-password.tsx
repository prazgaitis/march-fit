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
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-black/60 p-8 shadow-xl backdrop-blur">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-white">Check your email</h1>
            <p className="text-sm text-zinc-400">
              If an account exists for{" "}
              <span className="text-zinc-200">{email}</span>, we&apos;ve sent a
              password reset link. It may take a minute to arrive.
            </p>
          </div>

          <p className="text-center text-sm text-zinc-400">
            <Link
              href="/sign-in"
              className="text-indigo-400 hover:text-indigo-300"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-black/60 p-8 shadow-xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-white">
            Forgot your password?
          </h1>
          <p className="text-sm text-zinc-400">
            Enter the email you used to sign up and we&apos;ll send you a reset
            link.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          Remember your password?{" "}
          <Link
            href="/sign-in"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
