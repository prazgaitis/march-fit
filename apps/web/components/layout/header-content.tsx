import { preloadAuthQuery } from "@/lib/server-auth";
import { api } from "@repo/backend";
import { ConditionalHeader } from "./conditional-header";

/**
 * Async server component that fetches auth data inside Suspense.
 * This allows the root layout shell to stream immediately while
 * the auth query resolves in parallel.
 */
export async function HeaderContent() {
  const preloadedUser = await preloadAuthQuery(api.queries.users.current);
  return <ConditionalHeader preloadedUser={preloadedUser} />;
}

/**
 * Skeleton shown while HeaderContent is suspended.
 * Matches the header dimensions to prevent layout shift.
 */
export function HeaderSkeleton() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
          <span className="font-black text-xl uppercase tracking-wide text-white">March Fitness</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-800" />
        </div>
      </div>
    </header>
  );
}
