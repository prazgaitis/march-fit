"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { betterAuthClient } from "@/lib/better-auth/client";
import { PasswordInput } from "@/components/ui/password-input";

function friendlyError(message: string | undefined): string {
  if (!message) return "Unable to create your account. Please try again.";
  const lower = message.toLowerCase();
  if (lower.includes("already exist"))
    return "An account with this email already exists. Try signing in instead.";
  if (lower.includes("invalid") && lower.includes("password"))
    return "Incorrect email or password. Please try again.";
  return "Something went wrong. Please try again.";
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function BetterAuthSignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect_url") ?? "/challenges";

  const session = betterAuthClient.useSession();

  useEffect(() => {
    if (session.data?.user) {
      router.replace(redirectTo);
    }
  }, [session.data?.user, redirectTo, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const anyLoading = isSubmitting || isGoogleLoading;

  if (session.isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await betterAuthClient.signUp.email({
        name,
        email,
        password,
        callbackURL: redirectTo,
      });

      if (result.error) {
        setError(friendlyError(result.error.message));
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      console.error("Better Auth sign-up failed", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black px-4 py-12 sm:px-6">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/20 blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 h-[24rem] w-[24rem] rounded-full bg-indigo-500/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">
              March Fitness
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              Create your account
            </h1>
            <p className="text-sm text-zinc-400">
              Join the March Fitness community.
            </p>
          </div>

          {/* Google */}
          <button
            type="button"
            disabled={anyLoading}
            onClick={async () => {
              setIsGoogleLoading(true);
              setError(null);
              try {
                const result = await betterAuthClient.signIn.social({
                  provider: "google",
                  callbackURL: redirectTo,
                });
                if (result.error) {
                  setError("Google sign-in failed. Please try again.");
                  setIsGoogleLoading(false);
                }
              } catch {
                setError("Google sign-in failed. Please try again.");
                setIsGoogleLoading(false);
              }
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-950/80 px-3 text-zinc-600">
                or with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                placeholder="Your name"
              />
            </div>

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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Password
              </label>
              <PasswordInput
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-auto w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white shadow-none placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus-visible:ring-indigo-500/30"
                toggleClassName="text-zinc-500 hover:text-zinc-300"
                placeholder="Min. 8 characters"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={anyLoading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* Bottom link */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
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
