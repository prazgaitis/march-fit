"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    media.addEventListener("change", listener);

    // Cleanup
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/**
 * Returns `true` on mobile viewports (<=767px).
 *
 * Uses `useSyncExternalStore` with a server snapshot of `false` so that the
 * first client render matches the server (no hydration mismatch), and then
 * immediately syncs to the real value on the client. Components that need to
 * avoid a layout flash should hide mobile-only UI with CSS (`lg:hidden`)
 * rather than conditionally rendering based on this hook.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia("(max-width: 767px)");
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false, // server snapshot
  );
}
