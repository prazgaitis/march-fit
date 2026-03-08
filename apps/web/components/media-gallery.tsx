"use client";

import { useState, useMemo } from "react";
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

export function MediaGallery({
  urls,
  optimizedMediaIds,
  variant = "feed",
}: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const showOptimized = useOptimizedMedia();

  // Decide which URLs to render
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
      <div
        className={cn(
          "grid gap-2",
          displayUrls.length === 1 && "grid-cols-1",
          displayUrls.length === 2 && "grid-cols-2",
          displayUrls.length >= 3 && "grid-cols-2",
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
                displayUrls.length === 1 ? "aspect-video" : "aspect-square",
                displayUrls.length === 3 && index === 0 && "row-span-2",
              )}
              onClick={(e) => handleMediaClick(e, index)}
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

      <MediaLightbox
        urls={fullUrls}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}
