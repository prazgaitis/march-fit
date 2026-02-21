"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  Calendar,
  CheckCircle,
  FileText,
  Flame,
  Loader2,
  Megaphone,
  Play,
  Save,
  Settings,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import { formatDateOnlyFromUtcMs, formatDateOnlyFromLocalDate, parseDateOnlyToLocalDate } from "@/lib/date-only";
import { DatePicker } from "@/components/ui/date-picker";

type Tab = "general" | "welcome" | "announcements";

export default function SettingsAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    streakMinPoints: "",
    weekCalcMethod: "sunday",
    visibility: "public" as "public" | "private",
    welcomeVideoUrl: "",
    welcomeMessage: "",
    announcement: "",
    allowGenderEdit: false,
    finalDaysStart: "",
  });

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  const updateChallenge = useMutation(api.mutations.challenges.updateChallenge);

  // Initialize form with challenge data
  useEffect(() => {
    if (challenge) {
      setFormData({
        name: challenge.name,
        description: challenge.description || "",
        startDate: typeof challenge.startDate === "string" ? challenge.startDate : formatDateOnlyFromUtcMs(challenge.startDate),
        endDate: typeof challenge.endDate === "string" ? challenge.endDate : formatDateOnlyFromUtcMs(challenge.endDate),
        streakMinPoints: challenge.streakMinPoints.toString(),
        weekCalcMethod: challenge.weekCalcMethod,
        visibility: challenge.visibility || "public",
        welcomeVideoUrl: challenge.welcomeVideoUrl || "",
        welcomeMessage: challenge.welcomeMessage || "",
        announcement: challenge.announcement || "",
        allowGenderEdit: challenge.allowGenderEdit ?? false,
        finalDaysStart: challenge.finalDaysStart != null ? String(challenge.finalDaysStart) : "",
      });
    }
  }, [challenge]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      await updateChallenge({
        challengeId: challengeId as Id<"challenges">,
        name: formData.name,
        description: formData.description || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        streakMinPoints: parseInt(formData.streakMinPoints) || 10,
        weekCalcMethod: formData.weekCalcMethod,
        visibility: formData.visibility,
        welcomeVideoUrl: formData.welcomeVideoUrl || undefined,
        welcomeMessage: formData.welcomeMessage || undefined,
        announcement: formData.announcement || undefined,
        allowGenderEdit: formData.allowGenderEdit,
        finalDaysStart: formData.finalDaysStart !== "" ? parseInt(formData.finalDaysStart) || undefined : undefined,
      });

      setSaveResult({ success: true, message: "Settings saved successfully" });
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAnnouncement = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      await updateChallenge({
        challengeId: challengeId as Id<"challenges">,
        announcement: "",
      });
      setFormData((prev) => ({ ...prev, announcement: "" }));
      setSaveResult({ success: true, message: "Announcement cleared" });
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to clear",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Extract video ID for preview
  const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    // If it's already an embed URL, return as-is
    if (url.includes("youtube.com/embed/")) {
      return url;
    }

    // For Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  };

  const embedUrl = getYouTubeEmbedUrl(formData.welcomeVideoUrl);

  if (challenge === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "general"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Settings className="h-3 w-3" />
          General
        </button>
        <button
          onClick={() => setActiveTab("welcome")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "welcome"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Video className="h-3 w-3" />
          Welcome Content
        </button>
        <button
          onClick={() => setActiveTab("announcements")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "announcements"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Megaphone className="h-3 w-3" />
          Announcements
          {challenge?.announcement && (
            <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
              Active
            </span>
          )}
        </button>
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-4">
          {/* Challenge Name */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <FileText className="h-4 w-4 text-zinc-400" />
              Basic Information
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Challenge Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="My Fitness Challenge"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe your challenge..."
                  rows={3}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Visibility</Label>
                <select
                  value={formData.visibility}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      visibility: e.target.value as "public" | "private",
                    }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="public">Public</option>
                  <option value="private">Private (invitation only)</option>
                </select>
                <p className="text-[10px] text-zinc-500">
                  Private challenges are hidden from the browse list and require an admin invitation to join
                </p>
              </div>
              {/* Gender Collection Toggle */}
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Gender Collection</Label>
                <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2">
                  <div>
                    <p className="text-sm text-zinc-200">Allow gender editing</p>
                    <p className="text-[10px] text-zinc-500">
                      Allow participants to set or update their gender. Used for prize categories on the leaderboard.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.allowGenderEdit}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        allowGenderEdit: !prev.allowGenderEdit,
                      }))
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      formData.allowGenderEdit ? "bg-amber-500" : "bg-zinc-600"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        formData.allowGenderEdit ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <Calendar className="h-4 w-4 text-zinc-400" />
              Challenge Period
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Start Date</Label>
                <DatePicker
                  value={parseDateOnlyToLocalDate(formData.startDate)}
                  onChange={(date) => {
                    if (!date) return;
                    setFormData((prev) => ({
                      ...prev,
                      startDate: formatDateOnlyFromLocalDate(date),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">End Date</Label>
                <DatePicker
                  value={parseDateOnlyToLocalDate(formData.endDate)}
                  onChange={(date) => {
                    if (!date) return;
                    setFormData((prev) => ({
                      ...prev,
                      endDate: formatDateOnlyFromLocalDate(date),
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Scoring Settings */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <Flame className="h-4 w-4 text-zinc-400" />
              Scoring Settings
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">
                  Minimum Points for Streak
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.streakMinPoints}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      streakMinPoints: e.target.value,
                    }))
                  }
                  placeholder="10"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
                <p className="text-[10px] text-zinc-500">
                  Points required per day to maintain a streak
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">
                  Final Days Start (day #)
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.finalDaysStart}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      finalDaysStart: e.target.value,
                    }))
                  }
                  placeholder="29"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
                <p className="text-[10px] text-zinc-500">
                  Day number when the Final Days window begins (re-shows weekly-special activities). Leave blank to use last 2 days.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Week Calculation</Label>
                <select
                  value={formData.weekCalcMethod}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      weekCalcMethod: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="sunday">Week starts Sunday</option>
                  <option value="monday">Week starts Monday</option>
                </select>
                <p className="text-[10px] text-zinc-500">
                  Used for weekly leaderboard calculations
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Content Tab */}
      {activeTab === "welcome" && (
        <div className="space-y-4">
          {/* Welcome Video */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <Play className="h-4 w-4 text-zinc-400" />
              Welcome Video
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">
                  YouTube or Vimeo URL
                </Label>
                <Input
                  value={formData.welcomeVideoUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      welcomeVideoUrl: e.target.value,
                    }))
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
                <p className="text-[10px] text-zinc-500">
                  Paste a YouTube or Vimeo link to show participants when they join
                </p>
              </div>

              {/* Video Preview */}
              {embedUrl && (
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">Preview</Label>
                  <div className="aspect-video overflow-hidden rounded-lg border border-zinc-700 bg-black">
                    <iframe
                      src={embedUrl}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {formData.welcomeVideoUrl && !embedUrl && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                  <XCircle className="mr-1 inline h-3 w-3" />
                  Could not parse video URL. Please use a valid YouTube or Vimeo link.
                </div>
              )}
            </div>
          </div>

          {/* Welcome Message */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <FileText className="h-4 w-4 text-zinc-400" />
              Welcome Message
            </h3>
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">
                Message for New Participants
              </Label>
              <textarea
                value={formData.welcomeMessage}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    welcomeMessage: e.target.value,
                  }))
                }
                placeholder="Welcome to the challenge! Here's what you need to know..."
                rows={6}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <p className="text-[10px] text-zinc-500">
                This message will be shown to participants on the welcome screen
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <Megaphone className="h-4 w-4 text-zinc-400" />
              Current Announcement
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">
                  Announcement Message
                </Label>
                <textarea
                  value={formData.announcement}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      announcement: e.target.value,
                    }))
                  }
                  placeholder="**Important:** Don't forget to log your activities today!"
                  rows={4}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <p className="text-[10px] text-zinc-500">
                  Supports Markdown formatting. This will be shown as a banner on the challenge dashboard.
                  Users can dismiss it. Updating the announcement will show it again to all users.
                </p>
              </div>

              {challenge?.announcement && (
                <div className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800 p-3">
                  <div>
                    <p className="text-xs text-zinc-400">Current announcement is active</p>
                    {challenge.announcementUpdatedAt && (
                      <p className="text-[10px] text-zinc-500">
                        Last updated: {format(new Date(challenge.announcementUpdatedAt), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearAnnouncement}
                    disabled={isSaving}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {formData.announcement && (
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Preview</Label>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <Megaphone className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-200 prose prose-sm prose-amber prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-amber-300 prose-a:underline prose-strong:text-amber-100">
                    <ReactMarkdown>{formData.announcement}</ReactMarkdown>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Supports Markdown: **bold**, *italic*, [links](url), - bullet lists
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result Message */}
      {saveResult && (
        <div
          className={cn(
            "rounded border p-3 text-sm",
            saveResult.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {saveResult.success ? (
            <CheckCircle className="mr-2 inline h-4 w-4" />
          ) : (
            <XCircle className="mr-2 inline h-4 w-4" />
          )}
          {saveResult.message}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-amber-500 text-black hover:bg-amber-400"
        >
          {isSaving ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-1 h-3 w-3" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
