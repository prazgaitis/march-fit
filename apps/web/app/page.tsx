import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuth, fetchAuthQuery } from "@/lib/server-auth";
import { dateOnlyToUtcMs } from "@/lib/date-only";
import { api } from "@repo/backend";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await getServerAuth();

  // Redirect logged-in users to their active challenge dashboard
  if (userId) {
    let redirectTo = "/challenges";

    try {
      const challenges = await fetchAuthQuery<
        Array<{ id: string; startDate: string; endDate: string }>
      >(api.queries.challenges.listForUser, { userId, limit: 20 });

      const now = Date.now();
      const active = challenges?.find((c) => {
        const start = dateOnlyToUtcMs(c.startDate);
        const end = dateOnlyToUtcMs(c.endDate);
        return now >= start && now <= end;
      });

      if (active) {
        redirectTo = `/challenges/${active.id}/dashboard`;
      }
    } catch {
      // If query fails, fall through to /challenges
    }

    redirect(redirectTo);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative flex min-h-screen flex-col overflow-hidden px-6 py-10 sm:px-12 lg:px-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-10 -top-28 h-[30rem] w-[30rem] rounded-full bg-indigo-500/40 blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] translate-x-1/3 translate-y-1/3 rounded-full bg-fuchsia-500/30 blur-[160px]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>

        <header className="relative z-10 flex items-center justify-between text-xs uppercase tracking-[0.4em] text-zinc-500">
          <span>March 2026 Edition</span>
        </header>

        <div className="relative z-10 mt-auto flex flex-col gap-12 pb-24 pt-16 sm:pt-24">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.6em] text-zinc-400">Disrupt your routine</p>
            <h1 className="font-black uppercase leading-[0.85]">
              <span className="block text-[clamp(4.5rem,15vw,18rem)]">March</span>
              <span className="block bg-gradient-to-r from-white via-zinc-100 to-zinc-500 bg-clip-text text-[clamp(4.5rem,15vw,18rem)] text-transparent">
                Fitness
              </span>
              <span className="block text-[clamp(4.5rem,15vw,18rem)]">Club</span>
            </h1>
          </div>

          <div className="max-w-xl space-y-4 text-lg text-zinc-300">
            <p>
              Where competition meets community.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white px-10 py-4 text-base font-semibold uppercase tracking-[0.2em] text-black transition hover:border-white hover:bg-black hover:text-white"
            >
              Join The Club
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-10 py-4 text-base font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
            >
              Member Login
            </Link>
          </div>
        </div>

        <footer className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-xs uppercase tracking-[0.35em] text-zinc-500">
          <span>Competition for a good cause</span>
          <span>24/7 · Worldwide</span>
        </footer>
      </section>
    </main>
  );
}
