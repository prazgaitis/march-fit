"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BubbleBackground,
  SLIDE_BUBBLE_COLORS,
  type BubbleColors,
} from "./bubble-background";
import { FloatingPhotos } from "./floating-photos";

interface WrappedViewerProps {
  slides: Array<{ key: string; content: ReactNode }>;
  challengeId: string;
  activityPhotoIds?: string[];
}

/** Slides that show the user's floating activity photos */
const PHOTO_SLIDES = new Set([
  "final-standing",
  "community-totals",
  "thank-you",
  "activity-volume",
]);

const DEFAULT_BUBBLE_COLORS: BubbleColors = {
  first: "60,60,120",
  second: "80,40,140",
  third: "40,80,160",
  fourth: "100,60,100",
  fifth: "50,70,130",
};

export function WrappedViewer({ slides, challengeId, activityPhotoIds = [] }: WrappedViewerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = slides.length;

  const goTo = useCallback(
    (index: number, dir: "forward" | "backward") => {
      if (isAnimating) return;
      if (index < 0 || index >= total) return;
      setDirection(dir);
      setIsAnimating(true);
      setCurrentIndex(index);
      setTimeout(() => setIsAnimating(false), 400);
    },
    [total, isAnimating]
  );

  const goNext = useCallback(() => {
    if (currentIndex >= total - 1) {
      router.push(`/challenges/${challengeId}/dashboard`);
      return;
    }
    goTo(currentIndex + 1, "forward");
  }, [currentIndex, total, goTo, router, challengeId]);

  const goPrev = useCallback(() => {
    goTo(currentIndex - 1, "backward");
  }, [currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.push(`/challenges/${challengeId}/dashboard`);
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, router, challengeId]);

  // Touch handling
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) goNext();
    else if (delta > 50) goPrev();
  }

  // Tap navigation (desktop)
  function handleClick(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.3) goPrev();
    else if (x > 0.7) goNext();
  }

  const currentSlide = slides[currentIndex];
  const bubbleColors =
    SLIDE_BUBBLE_COLORS[currentSlide?.key ?? ""] ?? DEFAULT_BUBBLE_COLORS;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Animated bubble background */}
      <BubbleBackground
        key={currentSlide?.key}
        colors={bubbleColors}
        className="opacity-30"
      />

      {/* Progress bar */}
      <div className="relative z-10 flex-shrink-0 flex gap-1 px-3 pt-3 pb-2">
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            className="h-0.5 flex-1 rounded-full bg-zinc-800 overflow-hidden"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                i <= currentIndex ? "w-full" : "w-0",
                i < currentIndex ? "bg-white" : "bg-white/80"
              )}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={() => router.push(`/challenges/${challengeId}/dashboard`)}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Slide counter */}
      <div className="absolute left-3 top-4 z-20 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
        {currentIndex + 1} / {total}
      </div>

      {/* Slide content */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden cursor-pointer z-10"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floating user photos on select slides */}
        {activityPhotoIds.length > 0 &&
          PHOTO_SLIDES.has(currentSlide?.key ?? "") && (
            <FloatingPhotos
              key={`photos-${currentSlide?.key}`}
              photoIds={activityPhotoIds}
            />
          )}

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center p-6 z-10",
            isAnimating && direction === "forward" && "animate-slide-in-right",
            isAnimating && direction === "backward" && "animate-slide-in-left"
          )}
          key={currentIndex}
        >
          {currentSlide?.content}
        </div>
      </div>

      {/* Desktop nav arrows */}
      <div className="hidden md:flex absolute inset-y-0 left-0 items-center pl-2 z-20">
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/60 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="hidden md:flex absolute inset-y-0 right-0 items-center pr-2 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/60 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Tap hint (first slide only) */}
      {currentIndex === 0 && (
        <div className="absolute bottom-6 inset-x-0 text-center md:hidden z-20">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 animate-pulse">
            Tap to continue
          </p>
        </div>
      )}
    </div>
  );
}
