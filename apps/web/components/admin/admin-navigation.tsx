"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminNavigationItem {
  href: string;
  label: string;
  segment: string;
}

interface AdminNavigationProps {
  items: AdminNavigationItem[];
}

export function AdminNavigation({ items }: AdminNavigationProps) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="flex items-center gap-0.5 -mb-px">
      {items.map((item) => {
        const isActive =
          segment === item.segment ||
          (!segment && item.segment === "(overview)");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "text-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {item.label}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
