"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id, Doc } from "@repo/backend/_generated/dataModel";
import { Loader2, User, List, Check, Shield } from "lucide-react";
import { betterAuthClient } from "@/lib/better-auth/client";

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
  allowGenderEdit?: boolean;
  currentGender?: "male" | "female" | null;
}

export function SettingsContent({
  currentUser,
  currentChallengeId,
  allowGenderEdit,
  currentGender,
}: SettingsContentProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(currentUser.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl ?? "");
  // Gender: "male" | "female" | "prefer_not" (maps to undefined/clear)
  const [gender, setGender] = useState<"male" | "female" | "prefer_not">(
    currentGender === "male" ? "male" : currentGender === "female" ? "female" : "prefer_not"
  );

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
        ...(allowGenderEdit
          ? { gender: gender === "prefer_not" ? undefined : gender }
          : {}),
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

          {/* Gender Field (only shown when allowGenderEdit is enabled) */}
          {allowGenderEdit && (
            <div className="space-y-2">
              <Label>Gender (for prize categories)</Label>
              <div className="flex flex-col gap-2">
                {(["female", "male", "prefer_not"] as const).map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={option}
                      checked={gender === option}
                      onChange={() => setGender(option)}
                      className="accent-primary"
                    />
                    {option === "female"
                      ? "Female"
                      : option === "male"
                        ? "Male"
                        : "Prefer not to say"}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                ℹ️ If you don&apos;t set a gender, you&apos;ll be placed in the Men&apos;s/Open
                category for prize tracking.
              </p>
            </div>
          )}

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

      {/* Account Security */}
      <AccountSecurityCard email={currentUser.email} />


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

function AccountSecurityCard({ email }: { email: string }) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  async function handleSendResetLink() {
    setIsSending(true);
    setError(null);
    try {
      const result = await betterAuthClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setError("Failed to send reset link. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setChangeError("New password must be at least 8 characters.");
      return;
    }
    setIsChanging(true);
    setChangeError(null);
    try {
      const result = await betterAuthClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (result.error) {
        const msg = result.error.message?.toLowerCase() ?? "";
        if (msg.includes("invalid") || msg.includes("incorrect"))
          setChangeError("Current password is incorrect.");
        else setChangeError("Failed to change password. Please try again.");
        return;
      }
      setChangeSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setShowChangePassword(false);
    } catch {
      setChangeError("Something went wrong. Please try again.");
    } finally {
      setIsChanging(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Account Security
        </CardTitle>
        <CardDescription>Manage your password and login methods</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="text-sm text-green-600">
            Password reset link sent to {email}. Check your inbox.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Set or reset your password to enable email + password login.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={handleSendResetLink}
                disabled={isSending}
                className="w-full sm:w-auto"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Password Reset Link"
                )}
              </Button>
              {!showChangePassword && (
                <Button
                  variant="ghost"
                  onClick={() => setShowChangePassword(true)}
                  className="w-full sm:w-auto"
                >
                  Change Password
                </Button>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}

        {showChangePassword && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>
            {changeError && (
              <p className="text-sm text-red-600">{changeError}</p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleChangePassword}
                disabled={isChanging || !currentPassword || !newPassword}
                className="w-full sm:w-auto"
              >
                {isChanging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowChangePassword(false);
                  setChangeError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {changeSuccess && (
          <p className="text-sm text-green-600">Password changed successfully!</p>
        )}
      </CardContent>
    </Card>
  );
}
