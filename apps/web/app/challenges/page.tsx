import { redirect } from "next/navigation";
import { ChallengesGrid } from "@/components/challenges/challenges-grid";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

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

        <ChallengesGrid />
      </div>
    </main>
  );
}
