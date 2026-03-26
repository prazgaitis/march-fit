"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import type { LucideIcon } from "lucide-react";
import {
  Crown,
  Flame,
  Heart,
  Loader2,
  Medal,
  Pencil,
  Plus,
  Save,
  Shield,
  Star,
  Trash2,
  Trophy,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isMediaOptimizerConfigured,
  uploadOptimizedMedia,
  getOptimizedMediaUrl,
} from "@/lib/media-optimizer";

// ─── Icon map ───────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: "shield", label: "Shield", Icon: Shield },
  { value: "star", label: "Star", Icon: Star },
  { value: "trophy", label: "Trophy", Icon: Trophy },
  { value: "medal", label: "Medal", Icon: Medal },
  { value: "flame", label: "Flame", Icon: Flame },
  { value: "zap", label: "Zap", Icon: Zap },
  { value: "crown", label: "Crown", Icon: Crown },
  { value: "heart", label: "Heart", Icon: Heart },
] as const;

const BADGE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map(({ value, Icon }) => [value, Icon]),
);

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BadgesAdminPage() {
  const { id: challengeId } = useParams<{ id: string }>();

  const badges = useQuery(api.queries.badges.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });
  const awarded = useQuery(api.queries.badges.getAwardedByChallenge, {
    challengeId: challengeId as Id<"challenges">,
  });
  const achievements = useQuery(api.queries.achievements.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });
  const participants = useQuery(api.queries.participations.getMentionable, {
    challengeId: challengeId as Id<"challenges">,
  });

  const createBadge = useMutation(api.mutations.badges.createBadge);
  const updateBadge = useMutation(api.mutations.badges.updateBadge);
  const deleteBadge = useMutation(api.mutations.badges.deleteBadge);
  const awardBadge = useMutation(api.mutations.badges.awardBadge);
  const removeBadgeMut = useMutation(api.mutations.badges.removeBadge);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!badges || !achievements || !participants) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Badge Definitions ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Badge Definitions
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {badges.length} badge{badges.length !== 1 && "s"} configured
            </p>
          </div>
          {!showForm && !editingId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="border-zinc-700 text-zinc-300"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Badge
            </Button>
          )}
        </div>

        {showForm && (
          <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <BadgeForm
              achievements={achievements}
              onSave={async (data) => {
                await createBadge({
                  challengeId: challengeId as Id<"challenges">,
                  name: data.name,
                  description: data.description || undefined,
                  icon: data.icon || undefined,
                  imagePublicId: data.imagePublicId || undefined,
                  achievementId: data.achievementId
                    ? (data.achievementId as Id<"achievements">)
                    : undefined,
                });
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
              submitLabel="Create Badge"
            />
          </div>
        )}

        <div className="space-y-2">
          {badges.map((badge: any) =>
            editingId === badge._id ? (
              <div
                key={badge._id}
                className="rounded-lg border border-zinc-700 bg-zinc-900 p-4"
              >
                <BadgeForm
                  achievements={achievements}
                  initial={{
                    name: badge.name,
                    description: badge.description ?? "",
                    icon: badge.icon ?? "shield",
                    imagePublicId: badge.imagePublicId ?? "",
                    achievementId: badge.achievementId ?? "",
                  }}
                  onSave={async (data) => {
                    await updateBadge({
                      badgeId: badge._id as Id<"badges">,
                      name: data.name,
                      description: data.description || undefined,
                      icon: data.icon || undefined,
                      imagePublicId: data.imagePublicId || undefined,
                      clearImagePublicId: !data.imagePublicId && !!badge.imagePublicId,
                      achievementId: data.achievementId
                        ? (data.achievementId as Id<"achievements">)
                        : undefined,
                      clearAchievementId: !data.achievementId && !!badge.achievementId,
                    });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save Changes"
                />
              </div>
            ) : (
              <BadgeRow
                key={badge._id}
                badge={badge}
                onEdit={() => setEditingId(badge._id)}
                onDelete={async () => {
                  if (confirm(`Delete badge "${badge.name}"? This will remove it from all users.`)) {
                    await deleteBadge({ badgeId: badge._id as Id<"badges"> });
                  }
                }}
              />
            ),
          )}
          {badges.length === 0 && !showForm && (
            <p className="py-6 text-center text-xs text-zinc-600">
              No badges configured yet
            </p>
          )}
        </div>
      </section>

      {/* ── Award Badges ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-4">
          Award Badges
        </h2>
        {badges.length > 0 ? (
          <AwardSection
            badges={badges}
            participants={participants}
            challengeId={challengeId}
            onAward={async (badgeId, userId) => {
              await awardBadge({
                badgeId: badgeId as Id<"badges">,
                userId: userId as Id<"users">,
                challengeId: challengeId as Id<"challenges">,
              });
            }}
          />
        ) : (
          <p className="text-xs text-zinc-600">
            Create a badge first before awarding
          </p>
        )}
      </section>

      {/* ── Awarded Badges ────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-4">
          Awarded Badges
        </h2>
        <div className="space-y-2">
          {(awarded ?? []).filter(Boolean).map((item: any) => (
            <div
              key={item.userBadgeId}
              className="flex items-center justify-between rounded-lg bg-zinc-900/50 p-3"
            >
              <div className="flex items-center gap-3">
                <BadgeIconDisplay
                  imagePublicId={item.imagePublicId}
                  icon={item.icon}
                  name={item.badgeName}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {item.userName}
                  </p>
                  <p className="text-xs text-zinc-500">{item.badgeName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-600">
                  {new Date(item.awardedAt).toLocaleDateString()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-400 hover:text-red-300"
                  onClick={async () => {
                    if (confirm(`Remove "${item.badgeName}" from ${item.userName}?`)) {
                      await removeBadgeMut({
                        userBadgeId: item.userBadgeId as Id<"userBadges">,
                      });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(!awarded || awarded.filter(Boolean).length === 0) && (
            <p className="py-6 text-center text-xs text-zinc-600">
              No badges awarded yet
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Badge Icon Display ─────────────────────────────────────────────────────

function BadgeIconDisplay({
  imagePublicId,
  icon,
  name,
  size = "md",
}: {
  imagePublicId: string | null;
  icon: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const containerClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const IconComponent = BADGE_ICON_MAP[icon ?? "shield"] ?? Shield;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-indigo-500/20",
        containerClass,
      )}
      title={name}
    >
      {imagePublicId ? (
        <img
          src={getOptimizedMediaUrl(imagePublicId, "thumbnail")}
          alt={name}
          className={cn("rounded-full object-cover", containerClass)}
        />
      ) : (
        <IconComponent className={cn(iconClass, "text-indigo-400")} />
      )}
    </div>
  );
}

// ─── Badge Row ──────────────────────────────────────────────────────────────

function BadgeRow({
  badge,
  onEdit,
  onDelete,
}: {
  badge: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-900/50 p-3">
      <div className="flex items-center gap-3">
        <BadgeIconDisplay
          imagePublicId={badge.imagePublicId ?? null}
          icon={badge.icon ?? null}
          name={badge.name}
        />
        <div>
          <p className="text-sm font-medium text-zinc-200">{badge.name}</p>
          {badge.description && (
            <p className="text-xs text-zinc-500">{badge.description}</p>
          )}
          {badge.achievementName && (
            <p className="text-[10px] text-amber-500/80">
              Auto: {badge.achievementName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          className="h-7 text-zinc-400 hover:text-zinc-200"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-7 text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Badge Form ─────────────────────────────────────────────────────────────

interface BadgeFormData {
  name: string;
  description: string;
  icon: string;
  imagePublicId: string;
  achievementId: string;
}

const EMPTY_FORM: BadgeFormData = {
  name: "",
  description: "",
  icon: "shield",
  imagePublicId: "",
  achievementId: "",
};

function BadgeForm({
  achievements,
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  achievements: any[];
  initial?: BadgeFormData;
  onSave: (data: BadgeFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<BadgeFormData>(initial ?? EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadOptimizedMedia(file);
      setForm((prev) => ({ ...prev, imagePublicId: result.publicId }));
    } catch (err) {
      console.error("Badge image upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Name</Label>
          <Input
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Badge name"
            className="border-zinc-700 bg-zinc-800 text-zinc-200"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Description</Label>
          <Input
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Optional description"
            className="border-zinc-700 bg-zinc-800 text-zinc-200"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Icon picker */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Fallback Icon</Label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map(({ value, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, icon: value }))}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border transition",
                  form.icon === value
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300",
                )}
                title={value}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Custom Image</Label>
          {form.imagePublicId ? (
            <div className="flex items-center gap-2">
              <img
                src={getOptimizedMediaUrl(form.imagePublicId, "thumbnail")}
                alt="Badge"
                className="h-10 w-10 rounded-full object-cover"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setForm((prev) => ({ ...prev, imagePublicId: "" }))
                }
                className="h-7 text-red-400"
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !isMediaOptimizerConfigured}
                className="border-zinc-700 text-zinc-300"
              >
                {isUploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                Upload
              </Button>
              {!isMediaOptimizerConfigured && (
                <p className="mt-1 text-[10px] text-zinc-600">
                  Media optimizer not configured
                </p>
              )}
            </div>
          )}
        </div>

        {/* Achievement link */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">
            Auto-award on Achievement
          </Label>
          <select
            value={form.achievementId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, achievementId: e.target.value }))
            }
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">None (manual only)</option>
            {achievements.map((a: any) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button
          size="sm"
          onClick={async () => {
            if (!form.name.trim()) return;
            setIsSaving(true);
            try {
              await onSave(form);
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving || !form.name.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          {submitLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="text-zinc-400"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Award Section ──────────────────────────────────────────────────────────

function AwardSection({
  badges,
  participants,
  challengeId,
  onAward,
}: {
  badges: any[];
  participants: any[];
  challengeId: string;
  onAward: (badgeId: string, userId: string) => Promise<void>;
}) {
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isAwarding, setIsAwarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-400">Badge</Label>
        <select
          value={selectedBadgeId}
          onChange={(e) => setSelectedBadgeId(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">Select badge...</option>
          {badges.map((b: any) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-400">User</Label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">Select user...</option>
          {participants.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.username}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Button
          size="sm"
          onClick={async () => {
            if (!selectedBadgeId || !selectedUserId) return;
            setIsAwarding(true);
            setError(null);
            try {
              await onAward(selectedBadgeId, selectedUserId);
              setSelectedBadgeId("");
              setSelectedUserId("");
            } catch (err: any) {
              setError(err.message ?? "Failed to award");
            } finally {
              setIsAwarding(false);
            }
          }}
          disabled={isAwarding || !selectedBadgeId || !selectedUserId}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isAwarding ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Award
        </Button>
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
