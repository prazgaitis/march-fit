"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import {
  renderShareCard,
  downloadShareCard,
  type ShareCardData,
  type ShareCardVariant,
} from "@/lib/share-card-renderer";

interface ActivityShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ShareCardData;
}

const VARIANTS: { id: ShareCardVariant; label: string; description: string }[] =
  [
    {
      id: "activity",
      label: "ACTIVITY",
      description: "Points & metrics",
    },
    {
      id: "leaderboard",
      label: "RANK",
      description: "Leaderboard position",
    },
    {
      id: "streak",
      label: "STREAK",
      description: "Current streak",
    },
  ];

function ShareCardPreview({
  data,
  variant,
}: {
  data: ShareCardData;
  variant: ShareCardVariant;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    renderShareCard(data, variant).then((source) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const previewWidth = canvas.clientWidth * window.devicePixelRatio;
      const previewHeight = canvas.clientHeight * window.devicePixelRatio;
      canvas.width = previewWidth;
      canvas.height = previewHeight;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(source, 0, 0, previewWidth, previewHeight);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [data, variant]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-lg"
        style={{ aspectRatio: "9 / 16" }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-900/80">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function ActivityShareDialog({
  open,
  onOpenChange,
  data,
}: ActivityShareDialogProps) {
  const [selectedVariant, setSelectedVariant] =
    useState<ShareCardVariant>("activity");
  const [isSaving, setIsSaving] = useState(false);

  // Filter variants based on available data
  const availableVariants = VARIANTS.filter((v) => {
    if (v.id === "leaderboard" && data.rank == null) return false;
    if (v.id === "streak" && (data.currentStreak == null || data.currentStreak === 0))
      return false;
    return true;
  });

  // Reset to activity variant when opening if selected isn't available
  useEffect(() => {
    if (open && !availableVariants.find((v) => v.id === selectedVariant)) {
      setSelectedVariant("activity");
    }
  }, [open, availableVariants, selectedVariant]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await downloadShareCard(data, selectedVariant);
      toast.success("Image saved!");
    } catch {
      toast.error("Failed to save image");
    } finally {
      setIsSaving(false);
    }
  }, [data, selectedVariant]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Share Activity</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose a style and save the image
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          {/* Style picker */}
          <div className="flex gap-2">
            {availableVariants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v.id)}
                className={cn(
                  "flex-1 rounded-lg border-2 p-3 text-center transition-all",
                  selectedVariant === v.id
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {v.label}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {v.description}
                </div>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="mx-auto w-full max-w-[240px]">
            <ShareCardPreview data={data} variant={selectedVariant} />
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Save Image
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
