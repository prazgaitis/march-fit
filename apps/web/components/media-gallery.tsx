"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaLightbox, type MediaLightboxItem } from "@/components/ui/media-lightbox";
import { useOptimizedMedia } from "@/hooks/use-optimized-media";
import {
  getOptimizedMediaUrl,
  getOptimizedVideoPlaybackUrl,
  isOptimizedVideo,
} from "@/lib/media-optimizer";

interface MediaGalleryProps {
  /** Fallback raw URLs (Convex storage). Used when no optimized IDs are present. */
  urls: string[];
  /** Tagged media IDs (`cfi:`/`cfs:`) or legacy Cloudinary public IDs. Preferred over raw urls when available. */
  optimizedMediaIds?: string[];
  /** Use compact aspect ratios for feed cards vs full for detail pages */
  variant?: "feed" | "detail";
}

interface GalleryItem {
  thumbUrl: string;   // shown in the feed/grid view
  fullUrl: string;    // shown in the lightbox
  isVideo: boolean;
  hlsUrl?: string;    // set when isVideo and we have an HLS source
}

function isVideoRawUrl(url: string): boolean {
  return (
    url.includes(".mp4") ||
    url.includes(".mov") ||
    url.includes(".webm") ||
    url.includes("video")
  );
}

function buildGalleryItems(
  optimizedMediaIds: string[] | undefined,
  rawUrls: string[],
  useOptimized: boolean,
  variant: "feed" | "detail",
): GalleryItem[] {
  if (useOptimized && optimizedMediaIds && optimizedMediaIds.length > 0) {
    return optimizedMediaIds.map((id) => {
      const isVideo = isOptimizedVideo(id);
      return {
        thumbUrl: getOptimizedMediaUrl(id, variant === "feed" ? "feed" : "full"),
        fullUrl: getOptimizedMediaUrl(id, "full"),
        isVideo,
        hlsUrl: isVideo ? getOptimizedVideoPlaybackUrl(id).hls : undefined,
      };
    });
  }
  return rawUrls.map((url) => {
    const isVideo = isVideoRawUrl(url);
    return {
      thumbUrl: url,
      fullUrl: url,
      isVideo,
      hlsUrl: isVideo ? url : undefined,
    };
  });
}

/**
 * Instagram-style swipeable carousel for feed, grid layout for detail pages.
 */
export function MediaGallery({
  urls,
  optimizedMediaIds,
  variant = "feed",
}: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const showOptimized = useOptimizedMedia();

  const items = buildGalleryItems(optimizedMediaIds, urls, showOptimized, variant);

  if (items.length === 0) return null;

  const lightboxItems: MediaLightboxItem[] = items.map((item) => ({
    imageUrl: item.fullUrl,
    hlsUrl: item.hlsUrl,
  }));

  const handleMediaClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setLightboxIndex(index);
  };

  return (
    <>
      {variant === "feed" ? (
        <MediaCarousel items={items} onMediaClick={handleMediaClick} />
      ) : (
        <MediaGrid items={items} onMediaClick={handleMediaClick} />
      )}

      <MediaLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

// ── Shared render helper ─────────────────────────────────────────

function MediaThumb({ item, eager }: { item: GalleryItem; eager?: boolean }) {
  return (
    <div className="relative h-full w-full">
      <img
        src={item.thumbUrl}
        alt={item.isVideo ? "Video thumbnail" : "Activity photo"}
        className="h-full w-full object-cover"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      {item.isVideo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Carousel (feed variant) ─────────────────────────────────────

function MediaCarousel({
  items,
  onMediaClick,
}: {
  items: GalleryItem[];
  onMediaClick: (e: React.MouseEvent, index: number) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMultiple = items.length > 1;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, items.length - 1)));
    },
    [items.length],
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    setTouchDelta(e.touches[0].clientX - touchStartX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null) return;
    const threshold = 50;
    if (touchDelta < -threshold && currentIndex < items.length - 1) {
      goTo(currentIndex + 1);
    } else if (touchDelta > threshold && currentIndex > 0) {
      goTo(currentIndex - 1);
    }
    setTouchStartX(null);
    setTouchDelta(0);
    setIsDragging(false);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Image area */}
      <div className="relative overflow-hidden bg-zinc-900">
        {/* Slides container */}
        <div
          ref={containerRef}
          className={cn(
            "flex",
            !isDragging && "transition-transform duration-300 ease-out",
          )}
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${isDragging ? touchDelta : 0}px))`,
          }}
          onTouchStart={hasMultiple ? handleTouchStart : undefined}
          onTouchMove={hasMultiple ? handleTouchMove : undefined}
          onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              className="aspect-square w-full flex-shrink-0 focus-visible:outline-none"
              onClick={(e) => onMediaClick(e, index)}
              aria-label={`View ${item.isVideo ? "video" : "photo"} ${index + 1} of ${items.length}`}
            >
              <MediaThumb item={item} eager={index === 0} />
            </button>
          ))}
        </div>

        {/* Desktop navigation arrows */}
        {hasMultiple && currentIndex > 0 && (
          <button
            onClick={() => goTo(currentIndex - 1)}
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80 sm:flex"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {hasMultiple && currentIndex < items.length - 1 && (
          <button
            onClick={() => goTo(currentIndex + 1)}
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80 sm:flex"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Image counter badge (desktop) */}
        {hasMultiple && (
          <div className="absolute right-3 top-3 z-10 hidden rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white sm:block">
            {currentIndex + 1}/{items.length}
          </div>
        )}
      </div>

      {/* Dot indicators — below image, IG-style */}
      {hasMultiple && (
        <div className="flex justify-center gap-1.5 py-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === currentIndex
                  ? "w-1.5 bg-blue-500"
                  : "w-1.5 bg-zinc-600 hover:bg-zinc-500",
              )}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Grid (detail variant) ───────────────────────────────────────

function MediaGrid({
  items,
  onMediaClick,
}: {
  items: GalleryItem[];
  onMediaClick: (e: React.MouseEvent, index: number) => void;
}) {
  return (
    <div
      className={cn(
        "grid gap-1.5",
        items.length === 1 && "grid-cols-1",
        items.length === 2 && "grid-cols-2",
        items.length === 3 && "aspect-[3/2] grid-cols-2 grid-rows-2",
        items.length >= 4 && "grid-cols-2",
      )}
    >
      {items.slice(0, 4).map((item, index) => {
        const isLastWithMore = index === 3 && items.length > 4;

        return (
          <button
            key={index}
            type="button"
            className={cn(
              "relative overflow-hidden rounded-lg bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              items.length === 1 && "aspect-video",
              items.length === 2 && "aspect-square",
              items.length === 3 && index === 0 && "row-span-2",
              items.length >= 4 && "aspect-square",
            )}
            onClick={(e) => onMediaClick(e, index)}
            aria-label={`View ${item.isVideo ? "video" : "photo"} ${index + 1} of ${items.length}`}
          >
            <MediaThumb item={item} />
            {isLastWithMore && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-lg font-semibold text-white">
                  +{items.length - 4}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
