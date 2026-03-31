"use client";

import { getOptimizedMediaUrl } from "@/lib/media-optimizer";
import { cn } from "@/lib/utils";

interface FloatingPhotosProps {
  photoIds: string[];
  className?: string;
}

/**
 * Preset positions for floating photos scattered around the slide.
 * Each defines position, size, rotation, opacity, and animation class.
 * Positions are chosen to frame content without obscuring the center.
 */
const PHOTO_SLOTS = [
  {
    className:
      "top-[8%] left-[4%] w-20 h-20 sm:w-24 sm:h-24 rotate-[-6deg] animate-photo-float-1",
    opacity: 0.5,
  },
  {
    className:
      "top-[6%] right-[6%] w-18 h-18 sm:w-22 sm:h-22 rotate-[4deg] animate-photo-float-2",
    opacity: 0.45,
  },
  {
    className:
      "bottom-[12%] left-[6%] w-22 h-22 sm:w-26 sm:h-26 rotate-[3deg] animate-photo-float-3",
    opacity: 0.5,
  },
  {
    className:
      "bottom-[10%] right-[4%] w-20 h-20 sm:w-24 sm:h-24 rotate-[-4deg] animate-photo-float-1",
    opacity: 0.45,
  },
  {
    className:
      "top-[35%] left-[2%] w-16 h-16 sm:w-20 sm:h-20 rotate-[7deg] animate-photo-float-2",
    opacity: 0.35,
  },
  {
    className:
      "top-[40%] right-[2%] w-16 h-16 sm:w-20 sm:h-20 rotate-[-5deg] animate-photo-float-3",
    opacity: 0.35,
  },
] as const;

/**
 * Renders a set of floating, gently-animated user photos
 * positioned around the edges of the slide. They appear softly
 * behind the main content to add personality.
 */
export function FloatingPhotos({ photoIds, className }: FloatingPhotosProps) {
  if (photoIds.length === 0) return null;

  // Cycle through available photos for each slot
  const visibleSlots = PHOTO_SLOTS.slice(0, Math.min(photoIds.length, PHOTO_SLOTS.length));

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-0 overflow-hidden", className)}>
      {visibleSlots.map((slot, i) => {
        const photoId = photoIds[i % photoIds.length];
        const url = getOptimizedMediaUrl(photoId, "thumbnail");
        return (
          <div
            key={`${photoId}-${i}`}
            className={cn(
              "absolute rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl",
              slot.className,
            )}
            style={{ opacity: slot.opacity }}
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}
