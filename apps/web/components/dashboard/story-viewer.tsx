"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { StoryItem } from "./stories-row";

interface StoryViewerProps {
  stories: StoryItem[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const SLIDE_DURATION = 5000;

export function StoryViewer({
  stories,
  initialIndex,
  open,
  onClose,
}: StoryViewerProps) {
  const [storyIndex, setStoryIndex] = useState(initialIndex);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);

  const story = stories[storyIndex];
  const totalSlides = story?.mediaUrls.length ?? 0;

  // Reset state when opening or changing story
  useEffect(() => {
    if (open) {
      setStoryIndex(initialIndex);
      setMediaIndex(0);
      setProgress(0);
      elapsedRef.current = 0;
    }
  }, [open, initialIndex]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const goToNextSlide = useCallback(() => {
    setMediaIndex((prev) => {
      if (prev < totalSlides - 1) {
        elapsedRef.current = 0;
        return prev + 1;
      }
      // Move to next story
      setStoryIndex((si) => {
        if (si < stories.length - 1) {
          elapsedRef.current = 0;
          setMediaIndex(0);
          return si + 1;
        }
        // Last story, last slide — close
        onClose();
        return si;
      });
      return 0;
    });
  }, [totalSlides, stories.length, onClose]);

  const goToPrevSlide = useCallback(() => {
    setMediaIndex((prev) => {
      if (prev > 0) {
        elapsedRef.current = 0;
        return prev - 1;
      }
      // Move to previous story
      setStoryIndex((si) => {
        if (si > 0) {
          elapsedRef.current = 0;
          setMediaIndex(0);
          return si - 1;
        }
        return si;
      });
      return 0;
    });
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!open || paused) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    startTimeRef.current = performance.now() - elapsedRef.current;

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(elapsed / SLIDE_DURATION, 1);
      setProgress(pct);

      if (pct >= 1) {
        goToNextSlide();
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [open, paused, storyIndex, mediaIndex, goToNextSlide]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrevSlide();
          break;
        case "ArrowRight":
          goToNextSlide();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, goToPrevSlide, goToNextSlide]);

  // Touch handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    if (delta < -50) goToNextSlide();
    else if (delta > 50) goToPrevSlide();
    setTouchStart(null);
    setPaused(false);
  };

  // Tap left/right halves
  const handleTapNavigation = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goToPrevSlide();
    } else if (x > (rect.width * 2) / 3) {
      goToNextSlide();
    }
    // Middle third does nothing (could be used for pause)
  };

  if (!open || !story) return null;

  const currentUrl = story.mediaUrls[mediaIndex];
  const isVideo =
    currentUrl?.includes(".mp4") ||
    currentUrl?.includes(".mov") ||
    currentUrl?.includes(".webm") ||
    currentUrl?.includes("video");

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Progress bars */}
      <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        {story.mediaUrls.map((_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white transition-none"
              style={{
                width:
                  i < mediaIndex
                    ? "100%"
                    : i === mediaIndex
                      ? `${progress * 100}%`
                      : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header: user info + close */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <Avatar className="h-9 w-9 border-2 border-white/20">
          <AvatarImage
            src={story.user.avatarUrl ?? undefined}
            alt={story.user.name ?? story.user.username}
          />
          <AvatarFallback className="text-[10px]">
            {(story.user.name ?? story.user.username)
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {story.user.name ?? story.user.username}
          </p>
          <p className="text-xs text-white/60">
            {story.activityType && (
              <span className="mr-1.5">{story.activityType}</span>
            )}
            {formatDistanceToNow(new Date(story.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Media content */}
      <div
        className="flex h-full w-full items-center justify-center"
        onClick={handleTapNavigation}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
      >
        {isVideo ? (
          <video
            key={`${storyIndex}-${mediaIndex}`}
            src={currentUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            muted
          />
        ) : (
          <img
            key={`${storyIndex}-${mediaIndex}`}
            src={currentUrl}
            alt={`${story.user.username}'s activity`}
            className="h-full w-full object-contain"
            draggable={false}
          />
        )}
      </div>

      {/* Bottom info overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-16">
        <p className="text-lg font-bold text-white">
          {story.pointsEarned} pts
        </p>
        {story.activityType && (
          <p className="text-sm text-white/70">{story.activityType}</p>
        )}
      </div>

      {/* Desktop nav arrows */}
      {storyIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevSlide();
          }}
          className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 sm:flex"
          aria-label="Previous story"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {storyIndex < stories.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNextSlide();
          }}
          className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 sm:flex"
          aria-label="Next story"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
