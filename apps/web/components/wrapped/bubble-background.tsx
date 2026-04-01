"use client";

import { cn } from "@/lib/utils";

export interface BubbleColors {
  first: string;
  second: string;
  third: string;
  fourth: string;
  fifth: string;
}

interface BubbleBackgroundProps {
  colors?: BubbleColors;
  className?: string;
  children?: React.ReactNode;
}

const DEFAULT_COLORS: BubbleColors = {
  first: "18,113,255",
  second: "221,74,255",
  third: "0,220,255",
  fourth: "200,50,50",
  fifth: "180,180,50",
};

/**
 * Animated gradient-blob background using CSS keyframes.
 * Inspired by animate-ui's BubbleBackground but dependency-free.
 * Uses mix-blend-mode and radial gradients with gooey SVG filter.
 */
export function BubbleBackground({
  colors = DEFAULT_COLORS,
  className,
  children,
}: BubbleBackgroundProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {/* SVG gooey filter */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="bubble-goo">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="10"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Animated blob layer */}
      <div
        className="absolute inset-0"
        style={{ filter: "url(#bubble-goo) blur(40px)" }}
      >
        {/* Blob 1 - vertical float */}
        <div
          className="absolute h-[80%] w-[80%] left-[10%] top-[10%] rounded-full mix-blend-hard-light animate-bubble-float-y"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.first}, 0.8) 0%, rgba(${colors.first}, 0) 50%)`,
          }}
        />

        {/* Blob 2 - slow rotate from left offset */}
        <div className="absolute inset-0 flex items-center justify-center origin-[calc(50%-200px)] animate-bubble-rotate-slow">
          <div
            className="h-[80%] w-[80%] rounded-full mix-blend-hard-light"
            style={{
              background: `radial-gradient(circle at center, rgba(${colors.second}, 0.8) 0%, rgba(${colors.second}, 0) 50%)`,
            }}
          />
        </div>

        {/* Blob 3 - rotate from right offset */}
        <div className="absolute inset-0 flex items-center justify-center origin-[calc(50%+200px)] animate-bubble-rotate-medium">
          <div
            className="absolute h-[80%] w-[80%] rounded-full mix-blend-hard-light top-[calc(50%+100px)] left-[calc(50%-250px)]"
            style={{
              background: `radial-gradient(circle at center, rgba(${colors.third}, 0.8) 0%, rgba(${colors.third}, 0) 50%)`,
            }}
          />
        </div>

        {/* Blob 4 - horizontal float */}
        <div
          className="absolute h-[80%] w-[80%] left-[10%] top-[10%] rounded-full mix-blend-hard-light opacity-70 animate-bubble-float-x"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.fourth}, 0.8) 0%, rgba(${colors.fourth}, 0) 50%)`,
          }}
        />

        {/* Blob 5 - large rotate */}
        <div className="absolute inset-0 flex items-center justify-center origin-[calc(50%-400px)_calc(50%+100px)] animate-bubble-rotate-slow">
          <div
            className="absolute h-[160%] w-[160%] rounded-full mix-blend-hard-light top-[calc(50%-80%)] left-[calc(50%-80%)]"
            style={{
              background: `radial-gradient(circle at center, rgba(${colors.fifth}, 0.8) 0%, rgba(${colors.fifth}, 0) 50%)`,
            }}
          />
        </div>
      </div>

      {/* Content layer */}
      {children && (
        <div className="relative z-10 h-full w-full">{children}</div>
      )}
    </div>
  );
}

// ─── Per-slide color palettes ──────────────────────────────────────────────

export const SLIDE_BUBBLE_COLORS: Record<string, BubbleColors> = {
  "final-standing": {
    first: "217,175,50",   // gold
    second: "180,130,20",
    third: "255,200,50",
    fourth: "120,80,10",
    fifth: "200,160,40",
  },
  "activity-volume": {
    first: "0,180,220",    // cyan
    second: "0,140,200",
    third: "20,220,255",
    fourth: "0,100,180",
    fifth: "40,200,240",
  },
  streak: {
    first: "240,120,20",   // orange-red
    second: "220,60,20",
    third: "255,160,40",
    fourth: "200,40,10",
    fifth: "240,80,30",
  },
  "favorite-activity": {
    first: "120,80,220",   // purple
    second: "160,60,240",
    third: "80,40,200",
    fourth: "180,100,255",
    fifth: "100,60,210",
  },
  "distance-time": {
    first: "20,180,120",   // emerald
    second: "0,200,140",
    third: "40,160,100",
    fourth: "10,220,160",
    fifth: "30,170,110",
  },
  "pr-day": {
    first: "255,180,0",    // amber
    second: "240,140,20",
    third: "255,200,60",
    fourth: "220,120,0",
    fifth: "250,160,10",
  },
  "weekly-progression": {
    first: "60,120,220",   // blue
    second: "40,100,240",
    third: "80,140,200",
    fourth: "30,80,220",
    fifth: "70,130,230",
  },
  "category-breakdown": {
    first: "0,180,200",    // teal
    second: "20,160,180",
    third: "0,200,220",
    fourth: "10,140,160",
    fifth: "30,190,210",
  },
  "biggest-fan": {
    first: "120,60,220",   // violet
    second: "0,200,220",
    third: "160,80,240",
    fourth: "40,180,200",
    fifth: "140,70,230",
  },
  "mini-games": {
    first: "220,160,0",    // yellow-orange
    second: "240,120,20",
    third: "200,180,40",
    fourth: "255,140,0",
    fifth: "230,170,10",
  },
  achievements: {
    first: "200,160,40",   // gold
    second: "180,140,20",
    third: "220,180,60",
    fourth: "160,120,10",
    fifth: "210,170,50",
  },
  "community-totals": {
    first: "20,180,120",   // emerald-teal
    second: "0,200,160",
    third: "40,160,140",
    fourth: "10,220,180",
    fifth: "30,190,130",
  },
  "category-leaders": {
    first: "217,175,50",   // gold
    second: "200,150,30",
    third: "240,190,60",
    fourth: "180,130,20",
    fifth: "220,165,40",
  },
  "top-10": {
    first: "100,80,220",   // indigo-fuchsia
    second: "160,60,200",
    third: "80,60,240",
    fourth: "200,40,180",
    fifth: "120,70,210",
  },
  "thank-you": {
    first: "220,160,40",   // warm gradient
    second: "220,60,180",
    third: "40,200,220",
    fourth: "180,40,100",
    fifth: "60,140,220",
  },
};
