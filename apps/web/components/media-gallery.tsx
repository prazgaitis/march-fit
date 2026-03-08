"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/ui/media-lightbox";
import {
  getCloudinaryMediaUrl,
  isCloudinaryVideo,
  type CloudinaryTransform,
} from "@/lib/cloudinary";
import { useCloudinaryDisplay } from "@/hooks/use-cloudinary-display";

interface MediaGalleryProps {
  urls: string[];
  cloudinaryPublicIds?: string[];
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

interface MediaItem {
  src: string;
  fullSrc: string;
  isVideo: boolean;
}

export function MediaGallery({
  urls,
  cloudinaryPublicIds = [],
  variant = "feed",
}: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const showCloudinary = useCloudinaryDisplay();

  const feedTransform: CloudinaryTransform = variant === "detail" ? "full" : "feed";

  const items: MediaItem[] = useMemo(() => {
    const result: MediaItem[] = [];

    // Cloudinary media (only shown to beta users until fully rolled out)
    const effectiveCloudinaryIds = showCloudinary ? cloudinaryPublicIds : [];
    for (const id of effectiveCloudinaryIds) {
      const isVideo = isCloudinaryVideo(id);
      result.push({
        src: getCloudinaryMediaUrl(id, feedTransform),
        fullSrc: getCloudinaryMediaUrl(id, isVideo ? "video_feed" : "full"),
        isVideo,
      });
    }

    // Legacy Convex storage URLs
    for (const url of urls) {
      result.push({
        src: url,
        fullSrc: url,
        isVideo: isVideoUrl(url),
      });
    }

    return result;
  }, [urls, cloudinaryPublicIds, feedTransform, showCloudinary]);

  if (items.length === 0) return null;

  const handleMediaClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setLightboxIndex(index);
  };

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          items.length === 1 && "grid-cols-1",
          items.length === 2 && "grid-cols-2",
          items.length >= 3 && "grid-cols-2",
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
                items.length === 1 ? "aspect-video" : "aspect-square",
                items.length === 3 && index === 0 && "row-span-2",
              )}
              onClick={(e) => handleMediaClick(e, index)}
              aria-label={`View ${item.isVideo ? "video" : "photo"} ${index + 1} of ${items.length}`}
            >
              {item.isVideo ? (
                <video
                  src={item.src}
                  className="h-full w-full object-cover"
                  preload="metadata"
                  muted
                />
              ) : (
                <img
                  src={item.src}
                  alt={`Activity media ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
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

      <MediaLightbox
        urls={items.map((i) => i.fullSrc)}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}
