"use client";

import { LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { betterAuthClient } from "@/lib/better-auth/client";

type UserButtonUser = {
  id: string;
  name: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export function UserButton({ user }: { user: UserButtonUser }) {
  if (!user?.id) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-full ring-2 ring-zinc-700 transition hover:ring-indigo-500 focus:outline-none focus-visible:ring-indigo-500"
          aria-label="User menu"
        >
          <UserAvatar
            user={{
              id: user.id,
              name: user.name || "User",
              username: user.email ?? user.name ?? "user",
              avatarUrl: user.avatarUrl ?? null,
            }}
            size="sm"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-zinc-900 border-zinc-800"
        sideOffset={8}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            {user.email && (
              <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem
          onClick={async () => {
            await betterAuthClient.signOut();
            window.location.href = "/";
          }}
          className="flex items-center gap-2 px-2 py-3 text-sm text-red-400 cursor-pointer hover:bg-zinc-800 hover:text-red-300 focus:bg-zinc-800 focus:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
