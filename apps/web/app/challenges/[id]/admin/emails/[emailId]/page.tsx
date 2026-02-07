"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit2,
  Mail,
  Save,
  Send,
  Trash2,
  User,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type EmailTrigger = "manual" | "on_signup";

const triggerInfo: Record<
  EmailTrigger,
  { label: string; icon: typeof Mail; description: string }
> = {
  manual: {
    label: "Manual",
    icon: Send,
    description: "Admin manually triggers this email",
  },
  on_signup: {
    label: "On Signup",
    icon: UserPlus,
    description: "Automatically sent when a user joins the challenge",
  },
};

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;
  const emailId = params.emailId as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    subject: "",
    body: "",
    trigger: "manual" as EmailTrigger,
  });

  const emailSequence = useQuery(api.queries.emailSequences.getById, {
    emailSequenceId: emailId as Id<"emailSequences">,
  });

  const unsentParticipants = useQuery(
    api.queries.emailSequences.getUnsentParticipants,
    {
      emailSequenceId: emailId as Id<"emailSequences">,
    }
  );

  const updateEmailSequence = useMutation(api.mutations.emailSequences.update);
  const deleteEmailSequence = useMutation(api.mutations.emailSequences.remove);
  const sendToAll = useMutation(api.mutations.emailSequences.sendToAll);
  const sendToUser = useMutation(api.mutations.emailSequences.sendToUser);

  const handleStartEdit = () => {
    if (!emailSequence) return;
    setEditForm({
      name: emailSequence.name,
      subject: emailSequence.subject,
      body: emailSequence.body,
      trigger: emailSequence.trigger as EmailTrigger,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateEmailSequence({
        emailSequenceId: emailId as Id<"emailSequences">,
        name: editForm.name,
        subject: editForm.subject,
        body: editForm.body,
        trigger: editForm.trigger,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update email sequence:", error);
      alert(
        error instanceof Error ? error.message : "Failed to update email sequence"
      );
    }
  };

  const handleToggleEnabled = async () => {
    if (!emailSequence) return;
    try {
      await updateEmailSequence({
        emailSequenceId: emailId as Id<"emailSequences">,
        enabled: !emailSequence.enabled,
      });
    } catch (error) {
      console.error("Failed to toggle email sequence:", error);
      alert(
        error instanceof Error ? error.message : "Failed to toggle email sequence"
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEmailSequence({
        emailSequenceId: emailId as Id<"emailSequences">,
      });
      router.push(`/challenges/${challengeId}/admin/emails`);
    } catch (error) {
      console.error("Failed to delete email sequence:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete email sequence"
      );
    }
  };

  const handleSendToAll = async () => {
    try {
      const result = await sendToAll({
        emailSequenceId: emailId as Id<"emailSequences">,
      });
      alert(`Sent to ${result.sentCount} users (${result.skippedCount} skipped)`);
    } catch (error) {
      console.error("Failed to send emails:", error);
      alert(error instanceof Error ? error.message : "Failed to send emails");
    }
  };

  const handleSendToUser = async (userId: Id<"users">) => {
    try {
      await sendToUser({
        emailSequenceId: emailId as Id<"emailSequences">,
        userId,
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      alert(error instanceof Error ? error.message : "Failed to send email");
    }
  };

  if (!emailSequence) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  const triggerData = triggerInfo[emailSequence.trigger as EmailTrigger];
  const TriggerIcon = triggerData.icon;

  return (
    <div className="w-full space-y-4">
      {/* Back Button */}
      <button
        onClick={() => router.push(`/challenges/${challengeId}/admin/emails`)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Emails
      </button>

      {/* Header */}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800">
              <TriggerIcon className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-zinc-100">
                  {emailSequence.name}
                </h1>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    emailSequence.enabled
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-zinc-700 text-zinc-400"
                  )}
                >
                  {emailSequence.enabled ? "Enabled" : "Disabled"}
                </span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    emailSequence.trigger === "on_signup"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-zinc-700 text-zinc-400"
                  )}
                >
                  {triggerData.label}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {emailSequence.subject}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleEnabled}
              className="h-8 text-zinc-400 hover:text-zinc-200"
            >
              {emailSequence.enabled ? "Disable" : "Enable"}
            </Button>

            {!isEditing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStartEdit}
                className="h-8 text-zinc-400 hover:text-zinc-200"
              >
                <Edit2 className="mr-1 h-3 w-3" />
                Edit
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-zinc-100">
                    Delete Email Sequence?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    This will permanently delete &quot;{emailSequence.name}&quot;
                    and all send history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Trigger</Label>
                <Select
                  value={editForm.trigger}
                  onValueChange={(value: EmailTrigger) =>
                    setEditForm((prev) => ({ ...prev, trigger: value }))
                  }
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-800">
                    {Object.entries(triggerInfo).map(([trigger, info]) => (
                      <SelectItem
                        key={trigger}
                        value={trigger}
                        className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                      >
                        <div className="flex items-center gap-2">
                          <info.icon className="h-4 w-4" />
                          {info.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Subject</Label>
              <Input
                value={editForm.subject}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Body (HTML)</Label>
              <textarea
                value={editForm.body}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, body: e.target.value }))
                }
                rows={8}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                <Save className="mr-1 h-3 w-3" />
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Preview */}
        {!isEditing && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Email Preview
            </div>
            <div className="overflow-hidden rounded border border-zinc-700 bg-white">
              <iframe
                srcDoc={emailSequence.body}
                className="h-[400px] w-full border-0"
                title="Email Preview"
                sandbox=""
              />
            </div>
          </div>
        )}
      </div>

      {/* Manual Send Section */}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">
              {emailSequence.trigger === "manual" ? "Manual Send" : "Send Manually"}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {unsentParticipants?.length ?? 0} participants haven&apos;t
              received this email
              {emailSequence.trigger === "on_signup" && (
                <span className="ml-1 text-zinc-600">
                  (auto-sends on signup)
                </span>
              )}
            </p>
          </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 bg-amber-500 text-black hover:bg-amber-400"
                  disabled={!unsentParticipants?.length}
                >
                  <Send className="mr-1 h-3 w-3" />
                  Send to All ({unsentParticipants?.length ?? 0})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-zinc-100">
                    Send Email to All?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    This will send &quot;{emailSequence.name}&quot; to{" "}
                    {unsentParticipants?.length} participants who haven&apos;t
                    received it yet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleSendToAll}
                    className="bg-amber-500 text-black hover:bg-amber-400"
                  >
                    Send to All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Unsent Participants */}
          {unsentParticipants && unsentParticipants.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Unsent Participants
              </div>
              <div className="max-h-64 divide-y divide-zinc-800/50 overflow-y-auto rounded border border-zinc-800">
                {unsentParticipants.map((user: { id: string; name: string | null; username: string; email: string; avatarUrl: string | null }) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
                        {user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatarUrl}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-3 w-3 text-zinc-500" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-zinc-200">
                          {user.name || user.username}
                        </div>
                        <div className="text-xs text-zinc-500">{user.email}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSendToUser(user.id as Id<"users">)}
                      className="h-7 px-2 text-xs text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      <Send className="mr-1 h-3 w-3" />
                      Send
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Send History */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Send History
          </span>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle className="h-3 w-3" />
              {emailSequence.sends.filter((s: { status: string }) => s.status === "sent").length} sent
            </div>
            <div className="flex items-center gap-1 text-amber-400">
              <Clock className="h-3 w-3" />
              {emailSequence.sends.filter((s: { status: string }) => s.status === "pending").length}{" "}
              pending
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <XCircle className="h-3 w-3" />
              {emailSequence.sends.filter((s: { status: string }) => s.status === "failed").length}{" "}
              failed
            </div>
          </div>
        </div>

        {emailSequence.sends.length > 0 ? (
          <div className="max-h-96 divide-y divide-zinc-800/50 overflow-y-auto">
            {emailSequence.sends.map((send: { id: string; status: string; sentAt?: number; createdAt: number; user?: { name: string | null; username: string | null; email: string | null; avatarUrl: string | null } }) => (
              <div
                key={send.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
                    {send.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={send.user.avatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-3 w-3 text-zinc-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-zinc-200">
                      {send.user?.name || send.user?.username || "Unknown"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {send.user?.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      send.status === "sent" &&
                        "bg-emerald-500/20 text-emerald-400",
                      send.status === "pending" &&
                        "bg-amber-500/20 text-amber-400",
                      send.status === "failed" && "bg-red-500/20 text-red-400"
                    )}
                  >
                    {send.status === "sent" && <CheckCircle className="h-3 w-3" />}
                    {send.status === "pending" && <Clock className="h-3 w-3" />}
                    {send.status === "failed" && <XCircle className="h-3 w-3" />}
                    {send.status}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {send.sentAt
                      ? format(new Date(send.sentAt), "MMM d, h:mm a")
                      : format(new Date(send.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Mail className="mx-auto h-8 w-8 text-zinc-600" />
            <div className="mt-2 text-sm text-zinc-400">No emails sent yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
