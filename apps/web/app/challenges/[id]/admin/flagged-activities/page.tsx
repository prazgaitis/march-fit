import { AlertTriangle } from "lucide-react";

export default function FlaggedActivitiesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <AlertTriangle className="h-10 w-10 text-zinc-700 mb-3" />
      <p className="text-sm font-medium text-zinc-400">
        Select a flagged activity to review
      </p>
      <p className="mt-1 text-xs text-zinc-600">
        Choose an item from the list to see its details and take action.
      </p>
    </div>
  );
}
