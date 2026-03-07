"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Bell, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface NotificationSettingsSectionProps {
  userId: Id<"users">;
}

const NOTIFICATION_CATEGORIES = [
  {
    key: "emailLikes" as const,
    label: "Likes",
    description: "When someone likes your activity or comment",
  },
  {
    key: "emailComments" as const,
    label: "Comments",
    description: "When someone comments on your activity",
  },
  {
    key: "emailFollows" as const,
    label: "New followers",
    description: "When someone starts following you",
  },
  {
    key: "emailChallengeJoins" as const,
    label: "Challenge joins",
    description: "When someone joins the challenge or uses your invite",
  },
  {
    key: "emailAchievements" as const,
    label: "Achievements",
    description: "When you earn an achievement or maintain a streak",
  },
  {
    key: "emailStravaImports" as const,
    label: "Strava imports",
    description: "When a Strava activity is imported",
  },
  {
    key: "emailMiniGames" as const,
    label: "Mini-games",
    description: "Partner, hunter, or prey activity during mini-games",
  },
  {
    key: "emailAdmin" as const,
    label: "Admin actions",
    description: "When an admin comments on or edits your activity",
  },
] as const;

type PreferenceKey = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export function NotificationSettingsSection({
  userId,
}: NotificationSettingsSectionProps) {
  const prefs = useQuery(api.queries.notificationPreferences.getByUser, {
    userId,
  });
  const updatePrefs = useMutation(
    api.mutations.notificationPreferences.update,
  );
  const [saving, setSaving] = useState<PreferenceKey | null>(null);

  const isLoading = prefs === undefined;

  async function handleToggle(key: PreferenceKey, checked: boolean) {
    setSaving(key);
    try {
      await updatePrefs({ userId, [key]: checked });
    } catch (error) {
      console.error("Failed to update notification preference:", error);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which notifications you want to receive by email
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const enabled = prefs?.[category.key] ?? false;
              const isSaving = saving === category.key;

              return (
                <div
                  key={category.key}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={category.key}
                      className="text-sm font-medium"
                    >
                      {category.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaving && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      id={category.key}
                      checked={enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(category.key, checked)
                      }
                      disabled={isSaving}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
