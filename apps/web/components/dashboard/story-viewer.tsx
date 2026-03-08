"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ChevronLeft, ChevronRight, Heart, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { StoryItem } from "./stories-row";

interface StoryViewerProps {
  stories: StoryItem[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const SLIDE_DURATION = 10000;

export function StoryViewer({
  stories,
  initialIndex,
  open,
  onClose,
}: StoryViewerProps) {
  const [storyIndex, setStoryIndex] = useState(initialIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);

  // Like state (optimistic)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});
  const [isLiking, setIsLiking] = useState(false);

  // Comment state
  const [commentInput, setCommentInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({});
  const commentInputRef = useRef<HTMLInputElement>(null);

  const toggleLike = useMutation(api.mutations.likes.toggle);
  const createComment = useMutation(api.mutations.comments.create);

  const story = stories[storyIndex];
  const totalSlides = story?.slides.length ?? 0;
  const slide = story?.slides[slideIndex];

  const isLiked = slide ? (likedMap[slide.activityId] ?? slide.likedByUser) : false;
  const likeCount = slide ? (likeCountMap[slide.activityId] ?? slide.likes) : 0;
  const commentCount = slide ? (commentCountMap[slide.activityId] ?? slide.comments) : 0;

  // Reset state when opening or changing story
  useEffect(() => {
    if (open) {
      setStoryIndex(initialIndex);
      setSlideIndex(0);
      setProgress(0);
      elapsedRef.current = 0;
      setCommentInput("");
      setLikedMap({});
      setLikeCountMap({});
      setCommentCountMap({});
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
    setSlideIndex((prev) => {
      if (prev < totalSlides - 1) {
        elapsedRef.current = 0;
        return prev + 1;
      }
      // Move to next story
      setStoryIndex((si) => {
        if (si < stories.length - 1) {
          elapsedRef.current = 0;
          setSlideIndex(0);
          setCommentInput("");
          return si + 1;
        }
        onClose();
        return si;
      });
      return 0;
    });
  }, [totalSlides, stories.length, onClose]);

  const goToPrevSlide = useCallback(() => {
    setSlideIndex((prev) => {
      if (prev > 0) {
        elapsedRef.current = 0;
        return prev - 1;
      }
      setStoryIndex((si) => {
        if (si > 0) {
          elapsedRef.current = 0;
          setSlideIndex(0);
          setCommentInput("");
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
  }, [open, paused, storyIndex, slideIndex, goToNextSlide]);

  // Preload upcoming slide images so transitions feel instant
  useEffect(() => {
    if (!open || !story) return;

    const urlsToPreload: string[] = [];

    // Next slides in current story
    for (let i = slideIndex + 1; i < Math.min(slideIndex + 3, story.slides.length); i++) {
      const url = story.slides[i]?.mediaUrl;
      if (url && !url.includes(".mp4") && !url.includes(".mov") && !url.includes(".webm") && !url.includes("video")) {
        urlsToPreload.push(url);
      }
    }

    // First slides of the next story
    if (storyIndex < stories.length - 1) {
      const nextStory = stories[storyIndex + 1];
      const url = nextStory?.slides[0]?.mediaUrl;
      if (url && !url.includes(".mp4") && !url.includes(".mov") && !url.includes(".webm") && !url.includes("video")) {
        urlsToPreload.push(url);
      }
    }

    for (const url of urlsToPreload) {
      const img = new Image();
      img.src = url;
    }
  }, [open, story, storyIndex, slideIndex, stories]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement === commentInputRef.current) {
        if (e.key === "Escape") commentInputRef.current?.blur();
        return;
      }
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

  const handleTapNavigation = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goToPrevSlide();
    } else if (x > (rect.width * 2) / 3) {
      goToNextSlide();
    }
  };

  const handleToggleLike = async () => {
    if (!slide || isLiking) return;
    setIsLiking(true);
    const wasLiked = isLiked;
    setLikedMap((prev) => ({ ...prev, [slide.activityId]: !wasLiked }));
    setLikeCountMap((prev) => ({
      ...prev,
      [slide.activityId]: (prev[slide.activityId] ?? slide.likes) + (wasLiked ? -1 : 1),
    }));
    try {
      await toggleLike({ activityId: slide.activityId as Id<"activities"> });
    } catch {
      setLikedMap((prev) => ({ ...prev, [slide.activityId]: wasLiked }));
      setLikeCountMap((prev) => ({
        ...prev,
        [slide.activityId]: (prev[slide.activityId] ?? slide.likes) + (wasLiked ? 1 : -1),
      }));
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!slide || !commentInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setPaused(true);
    const text = commentInput.trim();
    setCommentInput("");
    setCommentCountMap((prev) => ({
      ...prev,
      [slide.activityId]: (prev[slide.activityId] ?? slide.comments) + 1,
    }));
    try {
      await createComment({
        activityId: slide.activityId as Id<"activities">,
        content: text,
      });
    } catch {
      setCommentCountMap((prev) => ({
        ...prev,
        [slide.activityId]: prev[slide.activityId] ?? slide.comments,
      }));
    } finally {
      setIsSubmitting(false);
      setPaused(false);
    }
  };

  if (!open || !story || !slide) return null;

  const isVideo =
    slide.mediaUrl?.includes(".mp4") ||
    slide.mediaUrl?.includes(".mov") ||
    slide.mediaUrl?.includes(".webm") ||
    slide.mediaUrl?.includes("video");

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Progress bars — one per slide */}
      <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        {story.slides.map((_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white transition-none"
              style={{
                width:
                  i < slideIndex
                    ? "100%"
                    : i === slideIndex
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
            {slide.activityType && (
              <span className="mr-1.5">{slide.activityType}</span>
            )}
            {formatDistanceToNow(new Date(slide.createdAt), {
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
            key={`${storyIndex}-${slideIndex}`}
            src={slide.mediaUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            muted
          />
        ) : (
          <img
            key={`${storyIndex}-${slideIndex}`}
            src={slide.mediaUrl}
            alt={`${story.user.username}'s activity`}
            className="h-full w-full object-contain"
            draggable={false}
          />
        )}
      </div>

      {/* Bottom overlay: points + like/comment */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-16">
        {/* Points info */}
        <div className="mb-2">
          <p className="text-lg font-bold text-white">
            {slide.pointsEarned.toFixed(2)} pts
          </p>
          {slide.activityType && (
            <p className="text-sm text-white/70">{slide.activityType}</p>
          )}
        </div>

        {/* Engagement counts */}
        {(likeCount > 0 || commentCount > 0) && (
          <div className="mb-2 flex items-center gap-3 text-sm text-white/60">
            {likeCount > 0 && (
              <span>{likeCount} {likeCount === 1 ? "like" : "likes"}</span>
            )}
            {commentCount > 0 && (
              <span>{commentCount} {commentCount === 1 ? "comment" : "comments"}</span>
            )}
          </div>
        )}

        {/* Comment input + like button on same row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitComment();
          }}
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={commentInputRef}
            type="text"
            placeholder="Add a comment..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onFocus={() => setPaused(true)}
            onBlur={() => {
              if (!commentInput.trim()) setPaused(false);
            }}
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 backdrop-blur-sm"
          />
          {commentInput.trim() ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition-all hover:bg-indigo-400"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLike();
              }}
              disabled={isLiking}
              className="flex h-9 w-9 shrink-0 items-center justify-center"
            >
              <Heart
                className={cn(
                  "h-6 w-6 transition-all",
                  isLiked
                    ? "fill-red-500 text-red-500 scale-110"
                    : "text-white hover:text-red-400",
                )}
              />
            </button>
          )}
        </form>
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
