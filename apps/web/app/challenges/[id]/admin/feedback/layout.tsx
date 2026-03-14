import type { ReactNode } from "react";
import { FeedbackSidebar } from "./feedback-sidebar";
import { FeedbackKeyboardShortcutBar } from "./feedback-keyboard-shortcut-bar";
import { FeedbackListProvider } from "./feedback-list-context";

interface FeedbackLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function FeedbackLayout({
  children,
  params,
}: FeedbackLayoutProps) {
  const { id: challengeId } = await params;

  return (
    <FeedbackListProvider>
      <div className="flex -m-3 h-[calc(100dvh-6.5rem)] overflow-hidden">
        {/* Left panel — feedback list */}
        <div className="w-80 flex-shrink-0 border-r border-zinc-800 overflow-y-auto">
          <FeedbackSidebar challengeId={challengeId} />
        </div>
        {/* Right panel — hint bar + detail */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <FeedbackKeyboardShortcutBar />
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      </div>
    </FeedbackListProvider>
  );
}
