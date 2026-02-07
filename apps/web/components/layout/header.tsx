"use client";

import Link from "next/link";
import { Preloaded } from "convex/react";
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import { api } from "@repo/backend";

import { UserButton } from "@/components/auth/user-button";

export function Header({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.queries.users.current>;
}) {
  const user = usePreloadedAuthQuery(preloadedUser);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-3">
            <div className="h-6 w-6 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
            <span className="font-black text-xl uppercase tracking-wide text-white">March Fitness</span>
          </Link>
        </div>

        <nav className="flex items-center space-x-6">
          {user ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-zinc-400">
                Welcome, {user.name || "User"}
              </span>
              <UserButton
                user={{
                  id: user._id,
                  name: user.name ?? null,
                  email: user.email ?? null,
                  avatarUrl: user.avatarUrl ?? null,
                }}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center px-6 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-300 transition hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white px-6 py-2 text-sm font-semibold uppercase tracking-wide text-black transition hover:border-white hover:bg-black hover:text-white"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
