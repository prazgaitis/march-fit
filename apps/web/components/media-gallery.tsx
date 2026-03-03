"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/ui/media-lightbox";

interface MediaGalleryProps {
  urls: string[];
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

export function MediaGallery({ urls, variant = "feed" }: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  const handleMediaClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setLightboxIndex(index);
  };

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          urls.length === 1 && "grid-cols-1",
          urls.length === 2 && "grid-cols-2",
          urls.length >= 3 && "grid-cols-2",
        )}
      >
        {urls.slice(0, 4).map((url, index) => {
          const isVideo = isVideoUrl(url);
          const isLastWithMore = index === 3 && urls.length > 4;

          return (
            <button
              key={index}
              type="button"
              className={cn(
                "relative overflow-hidden rounded-lg bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                urls.length === 1 ? "aspect-video" : "aspect-square",
                urls.length === 3 && index === 0 && "row-span-2",
              )}
              onClick={(e) => handleMediaClick(e, index)}
              aria-label={`View ${isVideo ? "video" : "photo"} ${index + 1} of ${urls.length}`}
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
                    +{urls.length - 4}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <MediaLightbox
        urls={urls}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}
