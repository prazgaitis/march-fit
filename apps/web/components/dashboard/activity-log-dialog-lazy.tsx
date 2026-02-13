"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const ActivityLogDialog = dynamic(
  () =>
    import("./activity-log-dialog").then((mod) => ({
      default: mod.ActivityLogDialog,
    })),
  { ssr: false }
);

interface ActivityLogDialogLazyProps {
  challengeId: string;
  challengeStartDate?: string;
  trigger?: ReactNode;
}

export function ActivityLogDialogLazy(props: ActivityLogDialogLazyProps) {
  return <ActivityLogDialog {...props} />;
}
