import { useEffect, useRef, useCallback } from "react";

/**
 * Hook that triggers a callback when a sentinel element scrolls into view.
 * Returns a ref to attach to a sentinel div placed at the bottom of a list.
 */
export function useInfiniteScroll(
  loadMore: () => void,
  { enabled = true, rootMargin = "0px 0px 400px 0px" }: { enabled?: boolean; rootMargin?: string } = {},
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return setSentinel;
}
