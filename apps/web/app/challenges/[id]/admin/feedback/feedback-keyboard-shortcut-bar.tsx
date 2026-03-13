"use client";

import { useParams } from "next/navigation";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1 font-mono text-[10px] leading-none text-zinc-300">
      {children}
    </kbd>
  );
}

function Shortcut({
  keys,
  label,
}: {
  keys: React.ReactNode;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      {keys}
      <span className="text-zinc-500">{label}</span>
    </span>
  );
}

export function FeedbackKeyboardShortcutBar() {
  const params = useParams();
  const hasSelection = !!params.feedbackId;

  if (!hasSelection) return null;

  return (
    <div className="flex flex-shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-[10px]">
      <Shortcut
        keys={
          <>
            <Kbd>&larr;</Kbd>
            <Kbd>&rarr;</Kbd>
          </>
        }
        label="navigate"
      />
      <Shortcut keys={<Kbd>F</Kbd>} label="fix / reopen" />
    </div>
  );
}
