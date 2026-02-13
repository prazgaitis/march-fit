import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChallengesGrid } from "@/components/challenges/challenges-grid";
import { getCurrentUser } from "@/lib/auth";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";

export const dynamic = "force-dynamic";

function ChallengesSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-900/50" />
      ))}
    </div>
  );
}

export default function ChallengesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground page-with-header">
      <div className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-5xl font-black uppercase tracking-tight mb-4">
            <span className="block">Active</span>
            <span className="block bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 bg-clip-text text-transparent">
              Challenges
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Choose your challenge, compete with the community, and push your limits.
          </p>
        </div>

        <Suspense fallback={<ChallengesSkeleton />}>
          <ChallengesContent />
        </Suspense>
      </div>
    </main>
  );
}

async function ChallengesContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const challengesStart = performance.now();
  const challenges = await getConvexClient()
    .query(api.queries.challenges.listPublic, {
      limit: 20,
      offset: 0,
    })
    .catch((error) => {
      console.error("[perf] challenges listPublic failed", error);
      return null;
    });
  console.log(
    `[perf] challenges listPublic: ${Math.round(performance.now() - challengesStart)}ms`,
  );

  return <ChallengesGrid challenges={challenges} />;
}
