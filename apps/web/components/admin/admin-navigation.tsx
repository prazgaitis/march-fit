"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminNavigationItem {
  href: string;
  label: string;
  segment: string;
}

export interface AdminNavigationGroup {
  label: string;
  items: AdminNavigationItem[];
}

interface AdminNavigationProps {
  groups: AdminNavigationGroup[];
}

export function AdminNavigation({ groups }: AdminNavigationProps) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="flex items-center gap-0.5 -mb-px">
      {groups.map((group, groupIdx) => (
        <div key={group.label} className="flex items-center">
          {/* Divider between groups */}
          {groupIdx > 0 && (
            <div className="mx-1.5 h-4 w-px bg-zinc-800" />
          )}

          {/* Group label */}
          <span className="mr-1 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 select-none">
            {group.label}
          </span>

          {/* Group items */}
          {group.items.map((item) => {
            const isActive =
              segment === item.segment ||
              (!segment && item.segment === "(overview)");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-2.5 py-2 text-xs font-medium transition-colors",
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
        </div>
      ))}
    </nav>
  );
}
