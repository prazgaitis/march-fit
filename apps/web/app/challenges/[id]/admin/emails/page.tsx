"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  CheckCircle,
  Clock,
  Edit2,
  Eye,
  Layers,
  Mail,
  Plus,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type DefaultTemplate = {
  name: string;
  subject: string;
  trigger: string;
  sendOnDay?: number;
  alreadyAdded: boolean;
};

type UnsentParticipant = {
  id: Id<"users">;
  username: string;
  name?: string;
  email: string;
  avatarUrl?: string;
  joinedAt: number;
};

type EmailSend = {
  status: "pending" | "sent" | "failed";
};

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

type ViewMode = "sequences" | "template";

export default function EmailsAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const [viewMode, setViewMode] = useState<ViewMode>("sequences");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    subject: "",
    body: "",
    trigger: "manual" as EmailTrigger,
  });
  const [newEmail, setNewEmail] = useState({
    name: "",
    subject: "",
    body: "",
    trigger: "manual" as EmailTrigger,
  });

  const emailSequences = useQuery(api.queries.emailSequences.list, {
    challengeId: challengeId as Id<"challenges">,
  });

  const defaultTemplates = useQuery(api.queries.emailSequences.getDefaultTemplates, {
    challengeId: challengeId as Id<"challenges">,
  });

  const templatePreview = useQuery(api.queries.emailSequences.getEmailTemplatePreview);

  const selectedEmail = useQuery(
    api.queries.emailSequences.getById,
    selectedEmailId ? { emailSequenceId: selectedEmailId as Id<"emailSequences"> } : "skip"
  );

  const unsentParticipants = useQuery(
    api.queries.emailSequences.getUnsentParticipants,
    selectedEmailId ? { emailSequenceId: selectedEmailId as Id<"emailSequences"> } : "skip"
  );

  const createEmailSequence = useMutation(api.mutations.emailSequences.create);
  const addDefaultTemplate = useMutation(api.mutations.emailSequences.addDefaultTemplate);
  const updateEmailSequence = useMutation(api.mutations.emailSequences.update);
  const deleteEmailSequence = useMutation(api.mutations.emailSequences.remove);
  const sendToAll = useMutation(api.mutations.emailSequences.sendToAll);
  const sendToUser = useMutation(api.mutations.emailSequences.sendToUser);

  const handleAddTemplate = async (templateName: string) => {
    try {
      const result = await addDefaultTemplate({
        challengeId: challengeId as Id<"challenges">,
        templateName,
      });
      setSelectedEmailId(result.emailSequenceId);
    } catch (error) {
      console.error("Failed to add template:", error);
      alert(error instanceof Error ? error.message : "Failed to add template");
    }
  };

  const handleCreate = async () => {
    if (!newEmail.name || !newEmail.subject || !newEmail.body) return;
    try {
      const result = await createEmailSequence({
        challengeId: challengeId as Id<"challenges">,
        name: newEmail.name,
        subject: newEmail.subject,
        body: newEmail.body,
        trigger: newEmail.trigger,
      });
      setIsCreateOpen(false);
      setNewEmail({ name: "", subject: "", body: "", trigger: "manual" });
      setSelectedEmailId(result.emailSequenceId);
    } catch (error) {
      console.error("Failed to create email sequence:", error);
      alert(error instanceof Error ? error.message : "Failed to create email sequence");
    }
  };

  const handleStartEdit = () => {
    if (!selectedEmail) return;
    setEditForm({
      name: selectedEmail.name,
      subject: selectedEmail.subject,
      body: selectedEmail.body,
      trigger: selectedEmail.trigger as EmailTrigger,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedEmailId) return;
    try {
      await updateEmailSequence({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
        name: editForm.name,
        subject: editForm.subject,
        body: editForm.body,
        trigger: editForm.trigger,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update email sequence:", error);
      alert(error instanceof Error ? error.message : "Failed to update email sequence");
    }
  };

  const handleToggleEnabled = async () => {
    if (!selectedEmail || !selectedEmailId) return;
    try {
      await updateEmailSequence({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
        enabled: !selectedEmail.enabled,
      });
    } catch (error) {
      console.error("Failed to toggle email sequence:", error);
      alert(error instanceof Error ? error.message : "Failed to toggle email sequence");
    }
  };

  const handleDelete = async () => {
    if (!selectedEmailId) return;
    try {
      await deleteEmailSequence({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
      });
      setSelectedEmailId(null);
    } catch (error) {
      console.error("Failed to delete email sequence:", error);
      alert(error instanceof Error ? error.message : "Failed to delete email sequence");
    }
  };

  const handleSendToAll = async () => {
    if (!selectedEmailId) return;
    try {
      const result = await sendToAll({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
      });
      alert(`Sent to ${result.sentCount} users (${result.skippedCount} skipped)`);
    } catch (error) {
      console.error("Failed to send emails:", error);
      alert(error instanceof Error ? error.message : "Failed to send emails");
    }
  };

  const handleSendToUser = async (userId: Id<"users">) => {
    if (!selectedEmailId) return;
    try {
      await sendToUser({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
        userId,
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      alert(error instanceof Error ? error.message : "Failed to send email");
    }
  };

  if (!emailSequences) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col gap-3">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("sequences")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "sequences"
              ? "bg-amber-500/15 text-amber-400"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          Email Sequences
        </button>
        <button
          onClick={() => setViewMode("template")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "template"
              ? "bg-amber-500/15 text-amber-400"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Email Template
        </button>
      </div>

      {/* Template Preview Mode */}
      {viewMode === "template" ? (
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Info Panel */}
          <div className="flex w-1/3 flex-col gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-500/15">
                  <Mail className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">Base Email Template</h3>
                  <p className="text-[10px] text-zinc-500">Used across all transactional emails</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                This is the shared email template that wraps all transactional emails sent from March Fitness, including invite emails, welcome emails, and weekly recaps.
              </p>
            </div>

            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Template Components
              </h4>
              <div className="space-y-2">
                <div className="rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                  <div className="text-xs font-medium text-zinc-300">Brand Header</div>
                  <div className="text-[10px] text-zinc-500">Wordmark + indigo-fuchsia gradient divider</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                  <div className="text-xs font-medium text-zinc-300">Dark Card</div>
                  <div className="text-[10px] text-zinc-500">Title, subtitle, content, callouts, and CTA buttons</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                  <div className="text-xs font-medium text-zinc-300">Footer</div>
                  <div className="text-[10px] text-zinc-500">Context line + march.fit wordmark link</div>
                </div>
              </div>
            </div>

            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Used In
              </h4>
              <div className="space-y-1.5">
                {[
                  { name: "Invite Emails", desc: "Sent when users invite friends" },
                  { name: "Welcome Email", desc: "Auto-sent on challenge signup" },
                  { name: "Weekly Recaps", desc: "Sent after each week" },
                  { name: "Challenge Complete", desc: "Sent when challenge ends" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-2 rounded bg-zinc-800/50 px-3 py-1.5">
                    <CheckCircle className="h-3 w-3 flex-shrink-0 text-emerald-400" />
                    <div>
                      <div className="text-xs text-zinc-300">{item.name}</div>
                      <div className="text-[10px] text-zinc-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Template Preview */}
          <div className="flex flex-1 flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-zinc-100">Template Preview</h2>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Active
                </span>
              </div>
              <div className="text-[10px] text-zinc-500">
                All emails use this layout
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-[#09090b]">
              {templatePreview ? (
                <iframe
                  srcDoc={templatePreview.html}
                  className="h-full w-full border-0"
                  title="Email Template Preview"
                  sandbox=""
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  Loading template...
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
      /* Email Sequences Mode */
      <div className="flex flex-1 gap-4 overflow-hidden">
      {/* Left Column - Email List */}
      <div className="flex w-1/2 flex-col">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {emailSequences.length} email sequence{emailSequences.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-7 bg-amber-500 px-3 text-xs text-black hover:bg-amber-400"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  New Email
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-900">
                <DialogHeader>
                  <DialogTitle className="text-zinc-100">Create Email Sequence</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Name</Label>
                      <Input
                        value={newEmail.name}
                        onChange={(e) => setNewEmail((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Welcome Email"
                        className="border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Trigger</Label>
                      <Select
                        value={newEmail.trigger}
                        onValueChange={(value: EmailTrigger) =>
                          setNewEmail((prev) => ({ ...prev, trigger: value }))
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
                      value={newEmail.subject}
                      onChange={(e) => setNewEmail((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="e.g., Welcome to the March Fitness Challenge!"
                      className="border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Body (HTML)</Label>
                    <textarea
                      value={newEmail.body}
                      onChange={(e) => setNewEmail((prev) => ({ ...prev, body: e.target.value }))}
                      placeholder="<p>Welcome to the challenge!</p>"
                      rows={8}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreateOpen(false)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreate}
                      disabled={!newEmail.name || !newEmail.subject || !newEmail.body}
                      className="bg-amber-500 text-black hover:bg-amber-400"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {emailSequences.length > 0 ? (
            emailSequences.map((sequence: { id: string; name: string; trigger: string; enabled: boolean; subject: string; sentCount: number; pendingCount: number; failedCount: number }) => {
              const triggerData = triggerInfo[sequence.trigger as EmailTrigger];
              const Icon = triggerData.icon;
              const isSelected = selectedEmailId === sequence.id;

              return (
                <button
                  key={sequence.id}
                  onClick={() => {
                    setSelectedEmailId(sequence.id);
                    setIsEditing(false);
                  }}
                  className={cn(
                    "w-full rounded border p-3 text-left transition-colors",
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-zinc-800">
                        <Icon className="h-4 w-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">
                            {sequence.name}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              sequence.enabled
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-700 text-zinc-400"
                            )}
                          >
                            {sequence.enabled ? "Enabled" : "Disabled"}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              sequence.trigger === "on_signup"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-zinc-700 text-zinc-400"
                            )}
                          >
                            {triggerData.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {sequence.subject}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <div className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          {sequence.sentCount} sent
                        </div>
                        {sequence.pendingCount > 0 && (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Clock className="h-3 w-3" />
                            {sequence.pendingCount}
                          </div>
                        )}
                        {sequence.failedCount > 0 && (
                          <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="h-3 w-3" />
                            {sequence.failedCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded border border-zinc-800 bg-zinc-900 p-8 text-center">
              <Mail className="mx-auto h-8 w-8 text-zinc-600" />
              <div className="mt-2 text-sm text-zinc-400">No email sequences yet</div>
              <div className="mt-1 text-xs text-zinc-600">
                Create an email sequence to communicate with participants
              </div>
            </div>
          )}
        </div>

        {/* Available Templates */}
        {defaultTemplates && defaultTemplates.some((t: DefaultTemplate) => !t.alreadyAdded) && (
          <div className="mt-3 rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Available Templates
            </div>
            <div className="space-y-1.5">
              {defaultTemplates
                .filter((t: DefaultTemplate) => !t.alreadyAdded)
                .map((template: DefaultTemplate) => (
                  <div
                    key={template.name}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-300">
                          {template.name}
                        </span>
                        {template.sendOnDay && (
                          <span className="text-[10px] text-zinc-500">
                            Day {template.sendOnDay}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {template.trigger === "on_signup"
                          ? "Auto-sends on signup"
                          : "Manual send"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddTemplate(template.name)}
                      className="h-6 border-zinc-700 px-2 text-[10px] text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                    >
                      <Plus className="mr-1 h-2.5 w-2.5" />
                      Add
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Preview */}
      <div className="flex w-1/2 flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900">
        {selectedEmail ? (
          <>
            {/* Preview Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-7 border-zinc-700 bg-zinc-800 text-sm font-medium text-zinc-200"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-medium text-zinc-100">
                      {selectedEmail.name}
                    </h2>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        selectedEmail.enabled
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-700 text-zinc-400"
                      )}
                    >
                      {selectedEmail.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        selectedEmail.trigger === "on_signup"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-zinc-700 text-zinc-400"
                      )}
                    >
                      {triggerInfo[selectedEmail.trigger as EmailTrigger].label}
                    </span>
                  </div>
                )}
                {isEditing ? (
                  <Input
                    value={editForm.subject}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Subject"
                    className="mt-1 h-6 border-zinc-700 bg-zinc-800 text-xs text-zinc-400"
                  />
                ) : (
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {selectedEmail.subject}
                  </div>
                )}
              </div>
              <div className="ml-2 flex items-center gap-1">
                {isEditing ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      className="h-7 bg-amber-500 px-2 text-black hover:bg-amber-400"
                    >
                      <Save className="mr-1 h-3 w-3" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleToggleEnabled}
                      className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {selectedEmail.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEdit}
                      className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-zinc-100">Delete?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            Delete &quot;{selectedEmail.name}&quot; and all send history?
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
                  </>
                )}
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {isEditing ? (
                <div className="flex-1 p-3">
                  <Label className="text-xs text-zinc-400">Body (HTML)</Label>
                  <textarea
                    value={editForm.body}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, body: e.target.value }))}
                    className="mt-1 h-[calc(100%-20px)] w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-hidden bg-white">
                  <iframe
                    srcDoc={selectedEmail.body}
                    className="h-full w-full border-0"
                    title="Email Preview"
                    sandbox=""
                  />
                </div>
              )}

              {/* Send Actions */}
              {!isEditing && (
                <div className="border-t border-zinc-800 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-500">
                      {unsentParticipants?.length ?? 0} unsent
                      {selectedEmail.trigger === "on_signup" && (
                        <span className="ml-1 text-zinc-600">(auto on signup)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unsentParticipants && unsentParticipants.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-zinc-700 px-2 text-xs text-zinc-300"
                            >
                              <User className="mr-1 h-3 w-3" />
                              Send to One
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="max-h-64 w-64 overflow-y-auto border-zinc-700 bg-zinc-900"
                          >
                            {unsentParticipants.map((user: UnsentParticipant) => (
                              <DropdownMenuItem
                                key={user.id}
                                onClick={() => handleSendToUser(user.id as Id<"users">)}
                                className="flex items-center gap-2 text-zinc-200 focus:bg-zinc-800"
                              >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800">
                                  {user.avatarUrl ? (
                                    <img
                                      src={user.avatarUrl}
                                      alt=""
                                      className="h-5 w-5 rounded-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-2.5 w-2.5 text-zinc-500" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs">{user.name || user.username}</div>
                                  <div className="truncate text-[10px] text-zinc-500">{user.email}</div>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="h-7 bg-amber-500 px-3 text-xs text-black hover:bg-amber-400"
                            disabled={!unsentParticipants?.length}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            Send to All ({unsentParticipants?.length ?? 0})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-zinc-100">Send to All?</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">
                              Send &quot;{selectedEmail.name}&quot; to {unsentParticipants?.length}{" "}
                              participants?
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
                              Send
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Send History Summary */}
                  {selectedEmail.sends.length > 0 && (
                    <div className="mt-2 flex items-center gap-3 text-[10px]">
                      <span className="text-zinc-500">History:</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="h-2.5 w-2.5" />
                        {selectedEmail.sends.filter((s: EmailSend) => s.status === "sent").length} sent
                      </span>
                      {selectedEmail.sends.filter((s: EmailSend) => s.status === "pending").length > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Clock className="h-2.5 w-2.5" />
                          {selectedEmail.sends.filter((s: EmailSend) => s.status === "pending").length} pending
                        </span>
                      )}
                      {selectedEmail.sends.filter((s: EmailSend) => s.status === "failed").length > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-2.5 w-2.5" />
                          {selectedEmail.sends.filter((s: EmailSend) => s.status === "failed").length} failed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto h-10 w-10 text-zinc-700" />
              <div className="mt-2 text-sm text-zinc-500">Select an email to preview</div>
              <div className="mt-1 text-xs text-zinc-600">
                Or create a new one with the + button
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
