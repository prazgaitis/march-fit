"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id, Doc } from "@repo/backend/_generated/dataModel";
import { Loader2, User, List, Check } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsContentProps {
  currentUser: {
    _id: Id<"users">;
    username: string;
    name?: string;
    email: string;
    avatarUrl?: string;
  };
  currentChallengeId: Id<"challenges">;
}

export function SettingsContent({
  currentUser,
  currentChallengeId,
}: SettingsContentProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(currentUser.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl ?? "");

  // Fetch user's challenges
  const userChallenges = useQuery(api.queries.participations.getUserChallenges, {
    userId: currentUser._id,
  });

  const updateUser = useMutation(api.mutations.users.updateUser);

  const handleSaveProfile = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateSuccess(false);
    setUpdateError(null);

    try {
      await updateUser({
        userId: currentUser._id,
        name: name.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      setUpdateSuccess(true);
      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      console.error("Failed to update profile:", error);
      setUpdateError("Failed to update your profile. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4">
            <UserAvatar
              user={{
                id: currentUser._id,
                username: currentUser.username,
                name: name || currentUser.name || null,
                avatarUrl: avatarUrl || currentUser.avatarUrl || null,
              }}
              size="xl"
            />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">@{currentUser.username}</p>
              <p>{currentUser.email}</p>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Avatar URL Field */}
          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
            <p className="text-xs text-muted-foreground">
              Enter a direct link to an image
            </p>
          </div>

          {/* Save Button */}
          <div className="space-y-2">
            <Button
              onClick={handleSaveProfile}
              disabled={isUpdating}
              className="w-full sm:w-auto"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            {updateSuccess && (
              <p className="text-sm text-green-600">Profile updated successfully!</p>
            )}
            {updateError && (
              <p className="text-sm text-red-600">{updateError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Challenge Switcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Your Challenges
          </CardTitle>
          <CardDescription>
            Switch between challenges you&apos;re participating in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userChallenges === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : userChallenges && userChallenges.length > 0 ? (
            <div className="space-y-2">
              {userChallenges.map((challenge: Doc<"challenges">) => {
                const isCurrent = challenge._id === currentChallengeId;
                return (
                  <Link
                    key={challenge._id}
                    href={`/challenges/${challenge._id}/dashboard`}
                    className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{challenge.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(challenge.startDate).toLocaleDateString()} -{" "}
                        {new Date(challenge.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    {isCurrent && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You&apos;re not participating in any challenges yet.
            </p>
          )}

          <div className="mt-4">
            <Button variant="outline" asChild className="w-full">
              <Link href="/challenges">Browse all challenges</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
