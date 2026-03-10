"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface MiniGameCardShellProps {
  icon: LucideIcon;
  title: string;
  meta?: string;
  headerRight?: ReactNode;
  iconClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  compact?: boolean;
}

export function MiniGameCardShell({
  icon: Icon,
  title,
  meta,
  headerRight,
  iconClassName,
  children,
  footer,
  className,
  bodyClassName,
  compact = false,
}: MiniGameCardShellProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <Icon
              className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400", iconClassName)}
            />
            <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              {title}
            </span>
            {meta ? (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="text-xs text-zinc-500">{meta}</span>
              </>
            ) : null}
          </div>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>

      <div className={cn("space-y-3", bodyClassName)}>{children}</div>

      {footer ? (
        <div className="mt-3 border-t border-zinc-800 pt-2 text-xs text-zinc-500">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
