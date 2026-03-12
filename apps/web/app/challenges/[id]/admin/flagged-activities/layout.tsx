import type { ReactNode } from "react";
import { FlaggedActivitiesSidebar } from "./flagged-activities-sidebar";
import { KeyboardShortcutBar } from "./keyboard-shortcut-bar";
import { FlaggedListProvider } from "./flagged-list-context";

interface FlaggedActivitiesLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function FlaggedActivitiesLayout({
  children,
  params,
}: FlaggedActivitiesLayoutProps) {
  const { id: challengeId } = await params;

  return (
    <FlaggedListProvider>
      <div className="flex -m-3 h-[calc(100dvh-6.5rem)] overflow-hidden">
        {/* Left panel — activity list */}
        <div className="w-80 flex-shrink-0 border-r border-zinc-800 overflow-y-auto">
          <FlaggedActivitiesSidebar challengeId={challengeId} />
        </div>
        {/* Right panel — hint bar + detail */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <KeyboardShortcutBar />
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </FlaggedListProvider>
  );
}
