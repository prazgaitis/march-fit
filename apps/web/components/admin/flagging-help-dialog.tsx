"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Flag,
  HelpCircle,
  MessageSquare,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FlaggingHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          How flagging works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Activity Flagging System</DialogTitle>
          <DialogDescription>
            How participants report activities and how admins resolve them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* How flags are created */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Flag className="h-4 w-4 text-destructive" />
              How activities get flagged
            </h3>
            <p className="text-muted-foreground">
              Any challenge participant can report another participant&apos;s activity
              by clicking the <strong>&hellip;</strong> menu on an activity card in the
              feed or on the activity detail page and selecting{" "}
              <strong>Report activity</strong>. They must provide a reason (e.g.,
              incorrect points, suspicious entry). Users cannot flag their own
              activities, and each user can only flag a given activity once.
            </p>
          </section>

          {/* State machine */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <CircleDot className="h-4 w-4 text-amber-500" />
              Flag status lifecycle
            </h3>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-500">
                  <CircleDot className="h-3 w-3" />
                  Pending
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Resolved
                </span>
              </div>
            </div>
            <ul className="ml-1 space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Pending</strong> &mdash; A new
                flag starts here. The activity is marked as flagged and appears in
                this list for review.
              </li>
              <li>
                <strong className="text-foreground">Resolved</strong> &mdash; An
                admin has reviewed and handled the flag. The activity is unflagged
                and returns to normal in the feed. Once resolved, a flag cannot be
                reopened.
              </li>
            </ul>
          </section>

          {/* What happens on resolution */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              What happens when resolved
            </h3>
            <ul className="ml-1 space-y-1.5 text-muted-foreground">
              <li>
                The activity&apos;s <strong className="text-foreground">flagged</strong> status
                is cleared, removing it from this queue.
              </li>
              <li>
                The resolution timestamp and the resolving admin are recorded for
                audit purposes.
              </li>
              <li>
                If you added a participant-visible comment, the participant receives
                a notification with your message.
              </li>
              <li>
                If the same activity is reported again by another user, it will
                create a new flag entry.
              </li>
            </ul>
          </section>

          {/* Admin actions */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Pencil className="h-4 w-4 text-indigo-400" />
              Admin actions available
            </h3>
            <p className="text-muted-foreground">
              Click <strong>View Details</strong> on any flagged activity to access
              the full admin toolkit:
            </p>
            <ul className="ml-1 space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Change status</strong> &mdash;
                Mark as pending or resolved.
              </li>
              <li>
                <strong className="text-foreground">Add admin comment</strong>{" "}
                <MessageSquare className="inline h-3 w-3" /> &mdash; Leave an
                internal note (visible to admins only) or a participant-visible
                comment that sends a notification to the user.
              </li>
              <li>
                <strong className="text-foreground">Edit activity</strong> &mdash;
                Adjust points earned or notes. Point changes automatically update
                the participant&apos;s total score and notify them.
              </li>
            </ul>
          </section>

          {/* Audit trail */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Audit trail</h3>
            <p className="text-muted-foreground">
              Every admin action (status change, comment, edit) is recorded in the
              activity&apos;s history timeline, including who performed the action and
              when. This provides full accountability for all moderation decisions.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
