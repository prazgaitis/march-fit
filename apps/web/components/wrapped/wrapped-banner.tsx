"use client";

import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface WrappedBannerProps {
  challengeId: string;
}

export function WrappedBanner({ challengeId }: WrappedBannerProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden until we check

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  useEffect(() => {
    const key = `wrapped-banner-dismissed-${challengeId}`;
    setDismissed(localStorage.getItem(key) === "true");
  }, [challengeId]);

  if (!challenge?.wrappedEnabled || dismissed) {
    return null;
  }

  function handleDismiss() {
    localStorage.setItem(`wrapped-banner-dismissed-${challengeId}`, "true");
    setDismissed(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4">
      <Link
        href={`/challenges/${challengeId}/wrapped`}
        className="group relative block rounded-lg border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/10 via-indigo-500/10 to-cyan-500/10 p-4 transition-all hover:border-fuchsia-500/50 hover:from-fuchsia-500/15 hover:via-indigo-500/15 hover:to-cyan-500/15"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDismiss();
          }}
          className="absolute right-2 top-2 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 pr-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30">
            <Sparkles className="h-4 w-4 text-fuchsia-300" />
          </div>
          <div>
            <p className="text-sm font-semibold bg-gradient-to-r from-fuchsia-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Your {challenge.name} Wrapped is ready!
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tap to see your personalized challenge summary
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
