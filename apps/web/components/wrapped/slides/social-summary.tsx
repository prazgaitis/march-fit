import { MessageCircle, Send, FileText } from "lucide-react";

interface Props {
  commentsGiven: number;
  commentsReceived: number;
  pokesSent: number;
  pokesReceived: number;
  forumPosts: number;
  forumReplies: number;
}

export function SocialSummarySlide({
  commentsGiven,
  commentsReceived,
  pokesSent,
  pokesReceived,
  forumPosts,
  forumReplies,
}: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <MessageCircle className="h-8 w-8 text-teal-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Social Life
      </p>
      <div className="w-full space-y-3">
        <Row
          icon={<MessageCircle className="h-4 w-4 text-teal-400" />}
          label="Comments"
          left={commentsGiven}
          leftLabel="written"
          right={commentsReceived}
          rightLabel="received"
        />
        <Row
          icon={<Send className="h-4 w-4 text-cyan-400" />}
          label="Pokes"
          left={pokesSent}
          leftLabel="sent"
          right={pokesReceived}
          rightLabel="received"
        />
        {(forumPosts > 0 || forumReplies > 0) && (
          <Row
            icon={<FileText className="h-4 w-4 text-indigo-400" />}
            label="Forum"
            left={forumPosts}
            leftLabel="posts"
            right={forumReplies}
            rightLabel="replies"
          />
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  left,
  leftLabel,
  right,
  rightLabel,
}: {
  icon: React.ReactNode;
  label: string;
  left: number;
  leftLabel: string;
  right: number;
  rightLabel: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900/80 px-4 py-3 ring-1 ring-zinc-800">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-zinc-400">{label}</span>
      </div>
      <div className="flex gap-4">
        <div className="flex-1 text-left">
          <span className="text-xl font-bold tabular-nums text-white">
            {left}
          </span>
          <span className="ml-1 text-xs text-zinc-500">{leftLabel}</span>
        </div>
        <div className="flex-1 text-left">
          <span className="text-xl font-bold tabular-nums text-white">
            {right}
          </span>
          <span className="ml-1 text-xs text-zinc-500">{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}
