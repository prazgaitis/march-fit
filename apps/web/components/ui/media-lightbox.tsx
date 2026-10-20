"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HlsVideo } from "@/components/ui/hls-video";

export interface MediaLightboxItem {
  /** URL used for images and as the poster frame for videos. */
  imageUrl: string;
  /** Present when this item is a video — an HLS manifest URL. */
  hlsUrl?: string;
}

interface MediaLightboxProps {
  items: MediaLightboxItem[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function MediaLightbox({
  items,
  initialIndex = 0,
  open,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset index when opened with a new initialIndex
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setTouchDelta(0);
    }
  }, [open, initialIndex]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => (i < items.length - 1 ? i + 1 : i));
  }, [items.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrev();
          break;
        case "ArrowRight":
          goToNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, goToPrev, goToNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    const threshold = 50;
    if (touchDelta < -threshold) {
      goToNext();
    } else if (touchDelta > threshold) {
      goToPrev();
    }
    setTouchStart(null);
    setTouchDelta(0);
    setIsDragging(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  };

  if (!open || items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-white transition-colors hover:bg-zinc-800"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Image counter */}
      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-zinc-900/80 px-3 py-1 text-sm text-white">
          {currentIndex + 1} / {items.length}
        </div>
      )}

      {/* Navigation arrows (desktop) */}
      {items.length > 1 && currentIndex > 0 && (
        <button
          onClick={goToPrev}
          className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/80 p-2 text-white transition-colors hover:bg-zinc-800 sm:flex"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {items.length > 1 && currentIndex < items.length - 1 && (
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/80 p-2 text-white transition-colors hover:bg-zinc-800 sm:flex"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Main content area with touch handling */}
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center p-4 sm:p-12"
        onClick={handleBackdropClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            "relative max-h-full max-w-full",
            !isDragging && "transition-transform duration-200 ease-out",
          )}
          style={{
            transform: isDragging ? `translateX(${touchDelta}px)` : undefined,
          }}
        >
          {currentItem.hlsUrl ? (
            <HlsVideo
              key={currentItem.hlsUrl}
              src={currentItem.hlsUrl}
              poster={currentItem.imageUrl}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              controls
              autoPlay
              playsInline
            />
          ) : (
            <img
              key={currentItem.imageUrl}
              src={currentItem.imageUrl}
              alt={`Media ${currentIndex + 1} of ${items.length}`}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              draggable={false}
            />
          )}
        </div>
      </div>

      {/* Dot indicators for mobile */}
      {items.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:hidden">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/40",
              )}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
