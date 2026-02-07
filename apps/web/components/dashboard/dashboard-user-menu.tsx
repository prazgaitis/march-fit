"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Doc, Id } from "@repo/backend/_generated/dataModel";
import {
  ChevronUp,
  Home,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { betterAuthClient } from "@/lib/better-auth/client";

interface DashboardUserMenuProps {
  challengeId: string;
  currentUserId: string;
  currentUser: Doc<"users">;
  collapsed?: boolean;
}

export function DashboardUserMenu({
  challengeId,
  currentUserId,
  currentUser,
  collapsed,
}: DashboardUserMenuProps) {
  const adminStatus = useQuery(api.queries.participations.isUserChallengeAdmin, {
    challengeId: challengeId as Id<"challenges">,
  });

  const isAdmin = adminStatus?.isAdmin ?? false;

  const handleSignOut = () => {
    void betterAuthClient.signOut();
  };

  // User data for avatar
  const userData = {
    id: currentUserId,
    name: currentUser.name ?? "User",
    username: currentUser.username ?? currentUser.email ?? "user",
    avatarUrl: currentUser.avatarUrl ?? null,
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full ring-2 ring-zinc-700 transition-all hover:ring-zinc-600 focus:outline-none focus:ring-indigo-500">
              <UserAvatar user={userData} size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            className="w-56 bg-zinc-900 border-zinc-800"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-white">
                  {userData.name}
                </p>
                <p className="text-xs text-zinc-400">@{userData.username}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-800" />

            {isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/challenges/${challengeId}/admin`}
                    className="flex cursor-pointer items-center gap-2 text-indigo-400"
                  >
                    <Shield className="h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
              </>
            )}

            <DropdownMenuItem asChild>
              <Link
                href={`/challenges/${challengeId}/users/${currentUserId}`}
                className="flex cursor-pointer items-center gap-2"
              >
                <User className="h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/challenges"
                className="flex cursor-pointer items-center gap-2"
              >
                <Home className="h-4 w-4" />
                All Challenges
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/integrations"
                className="flex cursor-pointer items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Integrations
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-zinc-800" />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex cursor-pointer items-center gap-2 text-red-400 focus:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-lg p-2 text-left transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <div className="flex items-center gap-3">
            <UserAvatar user={userData} size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">
                {userData.name}
              </span>
              <span className="text-xs text-zinc-400">@{userData.username}</span>
            </div>
          </div>
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-[--radix-dropdown-menu-trigger-width] bg-zinc-900 border-zinc-800"
      >
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link
                href={`/challenges/${challengeId}/admin`}
                className="flex cursor-pointer items-center gap-2 text-indigo-400"
              >
                <Shield className="h-4 w-4" />
                Admin Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800" />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link
            href={`/challenges/${challengeId}/users/${currentUserId}`}
            className="flex cursor-pointer items-center gap-2"
          >
            <User className="h-4 w-4" />
            My Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            href="/challenges"
            className="flex cursor-pointer items-center gap-2"
          >
            <Home className="h-4 w-4" />
            All Challenges
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            href="/integrations"
            className="flex cursor-pointer items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Integrations
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-zinc-800" />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex cursor-pointer items-center gap-2 text-red-400 focus:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
