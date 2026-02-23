"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { betterAuthClient } from "@/lib/better-auth/client";

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
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-black/60 p-8 shadow-xl backdrop-blur">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-white">
              Invalid or expired link
            </h1>
            <p className="text-sm text-zinc-400">
              This password reset link is no longer valid. Please request a new
              one.
            </p>
          </div>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-500"
            >
              Request New Link
            </Link>
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

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-black/60 p-8 shadow-xl backdrop-blur">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-white">Password updated</h1>
            <p className="text-sm text-zinc-400">
              Your password has been reset. You can now sign in with your new
              password.
            </p>
          </div>

          <div className="text-center">
            <Link
              href="/sign-in"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-500"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
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
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-black/60 p-8 shadow-xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-white">Set a new password</h1>
          <p className="text-sm text-zinc-400">
            Choose a new password for your account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200">
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200">
              Confirm password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>

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
