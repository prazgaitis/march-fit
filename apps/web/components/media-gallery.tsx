"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/ui/media-lightbox";
import { useOptimizedMedia } from "@/hooks/use-optimized-media";
import {
  getOptimizedMediaUrl,
  isOptimizedVideo,
} from "@/lib/media-optimizer";

interface MediaGalleryProps {
  urls: string[];
  /** Optimized media public IDs (from Cloudinary). Preferred over raw urls when available. */
  optimizedMediaIds?: string[];
  /** Use compact aspect ratios for feed cards vs full for detail pages */
  variant?: "feed" | "detail";
}

function isVideoUrl(url: string) {
  return (
    url.includes(".mp4") ||
    url.includes(".mov") ||
    url.includes(".webm") ||
    url.includes("video")
  );
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

  const useOptimizedUrls =
    showOptimized && optimizedMediaIds && optimizedMediaIds.length > 0;

  const displayUrls = useOptimizedUrls
    ? optimizedMediaIds.map((id) =>
        getOptimizedMediaUrl(id, variant === "feed" ? "feed" : "full"),
      )
    : urls;

  const fullUrls = useOptimizedUrls
    ? optimizedMediaIds.map((id) => getOptimizedMediaUrl(id, "full"))
    : urls;

  const isVideoAtIndex = useOptimizedUrls
    ? (index: number) => isOptimizedVideo(optimizedMediaIds[index])
    : (index: number) => isVideoUrl(displayUrls[index]);

  if (!displayUrls || displayUrls.length === 0) return null;

  const handleMediaClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setLightboxIndex(index);
  };

  return (
    <>
      {variant === "feed" ? (
        <MediaCarousel
          displayUrls={displayUrls}
          isVideoAtIndex={isVideoAtIndex}
          onMediaClick={handleMediaClick}
        />
      ) : (
        <MediaGrid
          displayUrls={displayUrls}
          isVideoAtIndex={isVideoAtIndex}
          onMediaClick={handleMediaClick}
        />
      )}

      <MediaLightbox
        urls={fullUrls}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

// ── Carousel (feed variant) ─────────────────────────────────────

function MediaCarousel({
  displayUrls,
  isVideoAtIndex,
  onMediaClick,
}: {
  displayUrls: string[];
  isVideoAtIndex: (index: number) => boolean;
  onMediaClick: (e: React.MouseEvent, index: number) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMultiple = displayUrls.length > 1;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, displayUrls.length - 1)));
    },
    [displayUrls.length],
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
    if (touchDelta < -threshold && currentIndex < displayUrls.length - 1) {
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {displayUrls.map((url, index) => {
            const isVideo = isVideoAtIndex(index);
            return (
              <button
                key={index}
                type="button"
                className="aspect-square w-full flex-shrink-0 focus-visible:outline-none"
                onClick={(e) => onMediaClick(e, index)}
                aria-label={`View ${isVideo ? "video" : "photo"} ${index + 1} of ${displayUrls.length}`}
              >
                {isVideo ? (
                  <video
                    src={url}
                    className="h-full w-full object-cover"
                    preload="metadata"
                    muted
                  />
                ) : (
                  <img
                    src={url}
                    alt={`Activity photo ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                )}
              </button>
            );
          })}
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
        {hasMultiple && currentIndex < displayUrls.length - 1 && (
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
            {currentIndex + 1}/{displayUrls.length}
          </div>
        )}
      </div>

      {/* Dot indicators — below image, IG-style */}
      {hasMultiple && (
        <div className="flex justify-center gap-1.5 py-2">
          {displayUrls.map((_, i) => (
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
  displayUrls,
  isVideoAtIndex,
  onMediaClick,
}: {
  displayUrls: string[];
  isVideoAtIndex: (index: number) => boolean;
  onMediaClick: (e: React.MouseEvent, index: number) => void;
}) {
  return (
    <div
      className={cn(
        "grid gap-1.5",
        displayUrls.length === 1 && "grid-cols-1",
        displayUrls.length === 2 && "grid-cols-2",
        displayUrls.length === 3 && "aspect-[3/2] grid-cols-2 grid-rows-2",
        displayUrls.length >= 4 && "grid-cols-2",
      )}
    >
      {displayUrls.slice(0, 4).map((url, index) => {
        const isVideo = isVideoAtIndex(index);
        const isLastWithMore = index === 3 && displayUrls.length > 4;

        return (
          <button
            key={index}
            type="button"
            className={cn(
              "relative overflow-hidden rounded-lg bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              displayUrls.length === 1 && "aspect-video",
              displayUrls.length === 2 && "aspect-square",
              displayUrls.length === 3 && index === 0 && "row-span-2",
              displayUrls.length >= 4 && "aspect-square",
            )}
            onClick={(e) => onMediaClick(e, index)}
            aria-label={`View ${isVideo ? "video" : "photo"} ${index + 1} of ${displayUrls.length}`}
          >
            {isVideo ? (
              <video
                src={url}
                className="h-full w-full object-cover"
                preload="metadata"
                muted
              />
            ) : (
              <img
                src={url}
                alt={`Activity media ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
            {isLastWithMore && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-lg font-semibold text-white">
                  +{displayUrls.length - 4}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
