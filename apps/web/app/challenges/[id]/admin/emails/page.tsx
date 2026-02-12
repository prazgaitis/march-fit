"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Columns2,
  Eye,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  User,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

import { marked } from "marked";
import { toast } from "sonner";
import { wrapEmailTemplate } from "@repo/backend/lib/emailTemplate";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type EmailSequenceListItem = {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  subject: string;
  sentCount: number;
  pendingCount: number;
  failedCount: number;
};

type DraftState = {
  name: string;
  subject: string;
  body: string;
  trigger: EmailTrigger;
};

type ImportChallenge = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  participantCount: number;
};

type ImportParticipant = {
  id: Id<"users">;
  username: string;
  name?: string;
  email: string;
  avatarUrl?: string;
  alreadySent: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
    description: "Sent when a user joins the challenge",
  },
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function draftKey(challengeId: string, emailId: string | null): string {
  return `email-draft-${challengeId}-${emailId ?? "new"}`;
}

function loadDraft(
  challengeId: string,
  emailId: string | null,
): DraftState | null {
  try {
    const raw = localStorage.getItem(draftKey(challengeId, emailId));
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

function saveDraft(
  challengeId: string,
  emailId: string | null,
  draft: DraftState,
): void {
  try {
    localStorage.setItem(draftKey(challengeId, emailId), JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable – silently ignore
  }
}

function clearDraft(challengeId: string, emailId: string | null): void {
  try {
    localStorage.removeItem(draftKey(challengeId, emailId));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Composer mode: "compose" = edit fields, "preview" = rendered HTML
// ---------------------------------------------------------------------------
type ComposerTab = "compose" | "preview" | "split";

// ---------------------------------------------------------------------------
// Markdown → HTML conversion
// ---------------------------------------------------------------------------

marked.setOptions({ breaks: true, gfm: true });

function markdownToHtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return wrapEmailTemplate({ content: html });
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function EmailsAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  // ---- State ----
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [composerTab, setComposerTab] = useState<ComposerTab>("split");
  const [showTemplates, setShowTemplates] = useState(false);

  // Import from challenge modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importChallengeId, setImportChallengeId] = useState<string | null>(
    null,
  );
  const [importSelectedUserIds, setImportSelectedUserIds] = useState<
    Set<string>
  >(new Set());
  const [importSearch, setImportSearch] = useState("");
  const [importSending, setImportSending] = useState(false);

  // Draft form state (used for both creating and editing)
  const [draft, setDraft] = useState<DraftState>({
    name: "",
    subject: "",
    body: "",
    trigger: "manual",
  });
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Convex queries ----
  const emailSequences = useQuery(api.queries.emailSequences.list, {
    challengeId: challengeId as Id<"challenges">,
  });

  const defaultTemplates = useQuery(
    api.queries.emailSequences.getDefaultTemplates,
    { challengeId: challengeId as Id<"challenges"> },
  );

  const selectedEmail = useQuery(
    api.queries.emailSequences.getById,
    selectedEmailId
      ? { emailSequenceId: selectedEmailId as Id<"emailSequences"> }
      : "skip",
  );

  const unsentParticipants = useQuery(
    api.queries.emailSequences.getUnsentParticipants,
    selectedEmailId
      ? { emailSequenceId: selectedEmailId as Id<"emailSequences"> }
      : "skip",
  );

  // Import from challenge queries
  const importChallenges = useQuery(
    api.queries.emailSequences.listChallengesForImport,
    showImportModal
      ? { excludeChallengeId: challengeId as Id<"challenges"> }
      : "skip",
  );

  const importParticipants = useQuery(
    api.queries.emailSequences.getOtherChallengeParticipants,
    showImportModal && importChallengeId && selectedEmailId
      ? {
          emailSequenceId: selectedEmailId as Id<"emailSequences">,
          sourceChallengeId: importChallengeId as Id<"challenges">,
        }
      : "skip",
  );

  // ---- Convex mutations ----
  const createEmailSequence = useMutation(api.mutations.emailSequences.create);
  const addDefaultTemplate = useMutation(
    api.mutations.emailSequences.addDefaultTemplate,
  );
  const updateEmailSequence = useMutation(api.mutations.emailSequences.update);
  const deleteEmailSequence = useMutation(api.mutations.emailSequences.remove);
  const sendToAll = useMutation(api.mutations.emailSequences.sendToAll);
  const sendToUsers = useMutation(api.mutations.emailSequences.sendToUsers);
  const sendTest = useMutation(api.mutations.emailSequences.sendTest);

  // ---- Draft persistence (debounced localStorage save) ----
  const saveDraftDebounced = useCallback(
    (d: DraftState) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveDraft(challengeId, selectedEmailId, d);
        setDraftSavedAt(Date.now());
      }, 500);
    },
    [challengeId, selectedEmailId],
  );

  // When draft changes, mark dirty and schedule save
  const updateDraft = useCallback(
    (partial: Partial<DraftState>) => {
      setDraft((prev) => {
        const next = { ...prev, ...partial };
        setHasDraftChanges(true);
        saveDraftDebounced(next);
        return next;
      });
    },
    [saveDraftDebounced],
  );

  // Load draft from localStorage when selecting an email
  useEffect(() => {
    if (selectedEmail) {
      // Prefer bodySource (markdown) for editing, fall back to body (HTML)
      const editableBody = selectedEmail.bodySource ?? selectedEmail.body;
      const saved = loadDraft(challengeId, selectedEmailId);
      if (saved) {
        // Check if draft differs from saved version
        const differs =
          saved.name !== selectedEmail.name ||
          saved.subject !== selectedEmail.subject ||
          saved.body !== editableBody ||
          saved.trigger !== selectedEmail.trigger;
        if (differs) {
          setDraft(saved);
          setHasDraftChanges(true);
        } else {
          setDraft({
            name: selectedEmail.name,
            subject: selectedEmail.subject,
            body: editableBody,
            trigger: selectedEmail.trigger as EmailTrigger,
          });
          setHasDraftChanges(false);
          clearDraft(challengeId, selectedEmailId);
        }
      } else {
        setDraft({
          name: selectedEmail.name,
          subject: selectedEmail.subject,
          body: editableBody,
          trigger: selectedEmail.trigger as EmailTrigger,
        });
        setHasDraftChanges(false);
      }
      setComposerTab("split");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmailId, selectedEmail?._id]);

  // ---- Handlers ----

  const handleSelectEmail = (id: string) => {
    setSelectedEmailId(id);
  };

  const handleNewEmail = async () => {
    try {
      const result = await createEmailSequence({
        challengeId: challengeId as Id<"challenges">,
        name: "Untitled Email",
        subject: "",
        body: "",
        trigger: "manual",
        enabled: false,
      });
      setSelectedEmailId(result.emailSequenceId);
    } catch (error) {
      console.error("Failed to create draft:", error);
      alert(error instanceof Error ? error.message : "Failed to create draft");
    }
  };

  const handleSave = async () => {
    if (!selectedEmailId) return;
    try {
      await updateEmailSequence({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
        name: draft.name,
        subject: draft.subject,
        body: markdownToHtml(draft.body),
        bodySource: draft.body,
        trigger: draft.trigger,
      });
      clearDraft(challengeId, selectedEmailId);
      setHasDraftChanges(false);
    } catch (error) {
      console.error("Failed to save email:", error);
      alert(error instanceof Error ? error.message : "Failed to save email");
    }
  };

  const handleDiscardDraft = () => {
    if (selectedEmail) {
      clearDraft(challengeId, selectedEmailId);
      setDraft({
        name: selectedEmail.name,
        subject: selectedEmail.subject,
        body: selectedEmail.bodySource ?? selectedEmail.body,
        trigger: selectedEmail.trigger as EmailTrigger,
      });
      setHasDraftChanges(false);
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
      console.error("Failed to toggle:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmailId) return;
    try {
      await deleteEmailSequence({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
      });
      clearDraft(challengeId, selectedEmailId);
      setSelectedEmailId(null);
    } catch (error) {
      console.error("Failed to delete:", error);
      alert(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const handleSendToAll = async () => {
    if (!selectedEmailId) return;
    try {
      const result = await sendToAll({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
      });
      alert(`Sent to ${result.sentCount} participants (${result.skippedCount} skipped)`);
    } catch (error) {
      console.error("Failed to send:", error);
      alert(error instanceof Error ? error.message : "Failed to send");
    }
  };

  const handleSendTest = async (userId: Id<"users">) => {
    if (!selectedEmailId) return;
    const toastId = toast.loading("Sending test email...");
    try {
      // Auto-save before sending so the DB has the latest content
      if (hasDraftChanges) {
        await updateEmailSequence({
          emailSequenceId: selectedEmailId as Id<"emailSequences">,
          name: draft.name,
          subject: draft.subject,
          body: markdownToHtml(draft.body),
          bodySource: draft.body,
          trigger: draft.trigger,
        });
        clearDraft(challengeId, selectedEmailId);
        setHasDraftChanges(false);
      }
      await sendTest({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
        userId,
      });
      toast.success("Test email sent!", { id: toastId });
    } catch (error) {
      console.error("Failed to send test:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send test email",
        { id: toastId },
      );
    }
  };

  const handleAddTemplate = async (templateName: string) => {
    try {
      const result = await addDefaultTemplate({
        challengeId: challengeId as Id<"challenges">,
        templateName,
      });
      setSelectedEmailId(result.emailSequenceId);
      setShowTemplates(false);
    } catch (error) {
      console.error("Failed to add template:", error);
      alert(error instanceof Error ? error.message : "Failed to add template");
    }
  };

  // ---- Import from challenge handlers ----

  const handleOpenImportModal = () => {
    setImportChallengeId(null);
    setImportSelectedUserIds(new Set());
    setImportSearch("");
    setShowImportModal(true);
  };

  const handleSelectImportChallenge = (id: string) => {
    setImportChallengeId(id);
    setImportSelectedUserIds(new Set());
    setImportSearch("");
  };

  const handleBackToChallengeList = () => {
    setImportChallengeId(null);
    setImportSelectedUserIds(new Set());
    setImportSearch("");
  };

  const handleToggleImportUser = (userId: string) => {
    setImportSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (!importParticipants) return;
    const selectable = importParticipants.filter(
      (p: ImportParticipant) => !p.alreadySent,
    );
    const filteredSelectable = selectable.filter((p: ImportParticipant) => {
      if (!importSearch) return true;
      const q = importSearch.toLowerCase();
      return (
        p.username.toLowerCase().includes(q) ||
        (p.name?.toLowerCase().includes(q) ?? false) ||
        p.email.toLowerCase().includes(q)
      );
    });
    const allSelected = filteredSelectable.every((p: ImportParticipant) =>
      importSelectedUserIds.has(p.id),
    );
    if (allSelected) {
      // Deselect all visible
      setImportSelectedUserIds((prev) => {
        const next = new Set(prev);
        for (const p of filteredSelectable) {
          next.delete(p.id);
        }
        return next;
      });
    } else {
      // Select all visible
      setImportSelectedUserIds((prev) => {
        const next = new Set(prev);
        for (const p of filteredSelectable) {
          next.add(p.id);
        }
        return next;
      });
    }
  };

  const handleSendToImported = async () => {
    if (!selectedEmailId || importSelectedUserIds.size === 0) return;
    setImportSending(true);
    const toastId = toast.loading(
      `Sending to ${importSelectedUserIds.size} recipients...`,
    );
    try {
      // Auto-save before sending so the DB has the latest content
      if (hasDraftChanges) {
        await updateEmailSequence({
          emailSequenceId: selectedEmailId as Id<"emailSequences">,
          name: draft.name,
          subject: draft.subject,
          body: markdownToHtml(draft.body),
          bodySource: draft.body,
          trigger: draft.trigger,
        });
        clearDraft(challengeId, selectedEmailId);
        setHasDraftChanges(false);
      }

      const result = await sendToUsers({
        emailSequenceId: selectedEmailId as Id<"emailSequences">,
        userIds: Array.from(importSelectedUserIds) as Id<"users">[],
      });

      toast.success(
        `Sent to ${result.sentCount} recipients` +
          (result.skippedCount > 0
            ? `, ${result.skippedCount} skipped`
            : "") +
          (result.failedCount > 0
            ? `, ${result.failedCount} failed`
            : ""),
        { id: toastId },
      );

      setShowImportModal(false);
    } catch (error) {
      console.error("Failed to send:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send emails",
        { id: toastId },
      );
    } finally {
      setImportSending(false);
    }
  };

  // Filtered import participants (for search)
  const filteredImportParticipants = importParticipants?.filter(
    (p: ImportParticipant) => {
      if (!importSearch) return true;
      const q = importSearch.toLowerCase();
      return (
        p.username.toLowerCase().includes(q) ||
        (p.name?.toLowerCase().includes(q) ?? false) ||
        p.email.toLowerCase().includes(q)
      );
    },
  );

  // ---- Derived state ----
  const isComposerActive = selectedEmailId !== null;

  // ---- Loading ----
  if (!emailSequences) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-3">
      {/* ================================================================= */}
      {/* LEFT SIDEBAR – Email list                                         */}
      {/* ================================================================= */}
      <div className="flex w-72 flex-shrink-0 flex-col">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Emails ({emailSequences.length})
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={handleNewEmail}
              className="h-6 bg-amber-500 px-2 text-[10px] text-black hover:bg-amber-400"
            >
              <Plus className="mr-1 h-3 w-3" />
              New
            </Button>
            {defaultTemplates &&
              defaultTemplates.some((t: DefaultTemplate) => !t.alreadyAdded) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplates(true)}
                  className="h-6 border-zinc-700 px-2 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <FileText className="mr-1 h-3 w-3" />
                  Templates
                </Button>
              )}
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 space-y-1 overflow-y-auto">
          {emailSequences.length > 0 ? (
            emailSequences.map((seq: EmailSequenceListItem) => {
              const isSelected = selectedEmailId === seq.id;
              const TriggerIcon = triggerInfo[seq.trigger as EmailTrigger]?.icon ?? Mail;

              return (
                <button
                  key={seq.id}
                  onClick={() => handleSelectEmail(seq.id)}
                  className={cn(
                    "w-full rounded border p-2.5 text-left transition-colors",
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <TriggerIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-zinc-200">
                          {seq.name}
                        </span>
                        <span
                          className={cn(
                            "flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-medium",
                            seq.enabled
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-zinc-700 text-zinc-500",
                          )}
                        >
                          {seq.enabled ? "On" : "Off"}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                        {seq.subject}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="flex items-center gap-0.5 text-emerald-400">
                          <CheckCircle className="h-2.5 w-2.5" />
                          {seq.sentCount}
                        </span>
                        {seq.pendingCount > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Clock className="h-2.5 w-2.5" />
                            {seq.pendingCount}
                          </span>
                        )}
                        {seq.failedCount > 0 && (
                          <span className="flex items-center gap-0.5 text-red-400">
                            <XCircle className="h-2.5 w-2.5" />
                            {seq.failedCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded border border-dashed border-zinc-800 p-6 text-center">
              <Mail className="mx-auto h-6 w-6 text-zinc-700" />
              <div className="mt-1.5 text-xs text-zinc-500">No emails yet</div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAIN AREA – Composer / Preview                                    */}
      {/* ================================================================= */}
      <div className="flex flex-1 flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900">
        {isComposerActive ? (
          <>
            {/* ------- Composer Header ------- */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
              <div className="flex items-center gap-3">
                {/* Compose / Preview tabs */}
                <div className="flex items-center rounded-md bg-zinc-800 p-0.5">
                  <button
                    onClick={() => setComposerTab("compose")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                      composerTab === "compose"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    Compose
                  </button>
                  <button
                    onClick={() => setComposerTab("preview")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                      composerTab === "preview"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <button
                    onClick={() => setComposerTab("split")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                      composerTab === "split"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    <Columns2 className="h-3 w-3" />
                    Split
                  </button>
                </div>

                {/* Draft indicator */}
                {hasDraftChanges && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-amber-400">Unsaved changes</span>
                    {draftSavedAt && (
                      <span className="text-zinc-600">(draft saved locally)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {hasDraftChanges && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDiscardDraft}
                    className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Discard
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasDraftChanges}
                  className="h-7 bg-amber-500 px-3 text-xs text-black hover:bg-amber-400 disabled:opacity-40"
                >
                  <Save className="mr-1 h-3 w-3" />
                  Save
                </Button>

                {/* More actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-zinc-700 bg-zinc-900"
                  >
                    <DropdownMenuItem
                      onClick={handleToggleEnabled}
                      className="text-zinc-200 focus:bg-zinc-800"
                    >
                      {selectedEmail?.enabled ? "Disable" : "Enable"} email
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-red-400 focus:bg-zinc-800 focus:text-red-400"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete email
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-zinc-100">
                            Delete this email?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            This will delete &quot;{selectedEmail?.name}&quot; and
                            all send history. This cannot be undone.
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* ------- Composer Body ------- */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Fields row (name/trigger/subject) — shown in compose and split modes */}
              {composerTab !== "preview" && (
                <div className="border-b border-zinc-800 p-4 pb-3">
                  <div className="mb-3 grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Name
                      </Label>
                      <Input
                        value={draft.name}
                        onChange={(e) =>
                          updateDraft({ name: e.target.value })
                        }
                        placeholder="e.g., Week 1 Recap"
                        className="h-8 border-zinc-700 bg-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Trigger
                      </Label>
                      <Select
                        value={draft.trigger}
                        onValueChange={(value: EmailTrigger) =>
                          updateDraft({ trigger: value })
                        }
                      >
                        <SelectTrigger className="h-8 border-zinc-700 bg-zinc-800 text-sm text-zinc-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-800">
                          {Object.entries(triggerInfo).map(
                            ([trigger, info]) => (
                              <SelectItem
                                key={trigger}
                                value={trigger}
                                className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                              >
                                <span className="flex items-center gap-2">
                                  <info.icon className="h-3.5 w-3.5" />
                                  {info.label}
                                </span>
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Subject Line
                    </Label>
                    <Input
                      value={draft.subject}
                      onChange={(e) =>
                        updateDraft({ subject: e.target.value })
                      }
                      placeholder="e.g., You're in. Let's go."
                      className="h-8 border-zinc-700 bg-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              )}

              {/* Subject preview bar — shown in preview-only mode */}
              {composerTab === "preview" && (
                <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">Subject:</span>
                    <span className="font-medium text-zinc-200">
                      {draft.subject || "(no subject)"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                    <span className="text-zinc-600">From:</span>
                    <span className="text-zinc-400">
                      March Fitness &lt;noreply@march.fit&gt;
                    </span>
                  </div>
                </div>
              )}

              {/* Main content area */}
              {composerTab === "compose" ? (
                /* ===== COMPOSE ONLY ===== */
                <div className="flex flex-1 flex-col overflow-y-auto p-4">
                  <div className="flex flex-1 flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Body (Markdown)
                      </Label>
                      <span className="text-[10px] text-zinc-600">
                        **bold** &nbsp; *italic* &nbsp; [link](url) &nbsp; # heading &nbsp; - list
                      </span>
                    </div>
                    <textarea
                      value={draft.body}
                      onChange={(e) =>
                        updateDraft({ body: e.target.value })
                      }
                      placeholder={`# Welcome!\n\nYou're signed up for the challenge. Here's what to expect:\n\n- **Week 1**: Build your routine\n- **Week 2**: Push your limits\n\nLet's go!`}
                      className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      style={{ minHeight: "200px" }}
                    />
                  </div>
                </div>
              ) : composerTab === "preview" ? (
                /* ===== PREVIEW ONLY ===== */
                <div className="flex-1 overflow-hidden bg-[#09090b]">
                  {draft.body ? (
                    <iframe
                      srcDoc={markdownToHtml(draft.body)}
                      className="h-full w-full border-0"
                      title="Email Preview"
                      sandbox=""
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      <div className="text-center">
                        <Eye className="mx-auto h-8 w-8 text-zinc-700" />
                        <div className="mt-2 text-xs">
                          Write some content to see the preview
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ===== SPLIT VIEW ===== */
                <div className="flex flex-1 overflow-hidden">
                  {/* Left: Markdown editor */}
                  <div className="flex flex-1 flex-col overflow-y-auto border-r border-zinc-800 p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Body (Markdown)
                      </Label>
                      <span className="text-[10px] text-zinc-600">
                        **bold** &nbsp; *italic* &nbsp; [link](url)
                      </span>
                    </div>
                    <textarea
                      value={draft.body}
                      onChange={(e) =>
                        updateDraft({ body: e.target.value })
                      }
                      placeholder={`# Welcome!\n\nYou're signed up for the challenge.`}
                      className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  {/* Right: Live preview */}
                  <div className="flex flex-1 flex-col overflow-hidden bg-[#09090b]">
                    {draft.body ? (
                      <iframe
                        srcDoc={markdownToHtml(draft.body)}
                        className="h-full w-full border-0"
                        title="Email Preview"
                        sandbox=""
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-600">
                        <div className="text-center">
                          <Eye className="mx-auto h-6 w-6 text-zinc-700" />
                          <div className="mt-1.5 text-[10px]">
                            Preview appears here
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------- Send Actions Footer (only for existing emails) ------- */}
              {selectedEmail && (
                <div className="border-t border-zinc-800 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    {/* Left: status badges */}
                    <div className="flex items-center gap-3">
                      {selectedEmail.sends.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle className="h-2.5 w-2.5" />
                            {selectedEmail.sends.filter(
                              (s: EmailSend) => s.status === "sent",
                            ).length}{" "}
                            sent
                          </span>
                          {selectedEmail.sends.filter(
                            (s: EmailSend) => s.status === "pending",
                          ).length > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Clock className="h-2.5 w-2.5" />
                              {selectedEmail.sends.filter(
                                (s: EmailSend) => s.status === "pending",
                              ).length}{" "}
                              pending
                            </span>
                          )}
                          {selectedEmail.sends.filter(
                            (s: EmailSend) => s.status === "failed",
                          ).length > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              <XCircle className="h-2.5 w-2.5" />
                              {selectedEmail.sends.filter(
                                (s: EmailSend) => s.status === "failed",
                              ).length}{" "}
                              failed
                            </span>
                          )}
                        </div>
                      )}
                      <span className="text-[10px] text-zinc-500">
                        {unsentParticipants?.length ?? 0} unsent
                        {selectedEmail.trigger === "on_signup" && (
                          <span className="ml-1 text-zinc-600">
                            (auto on signup)
                          </span>
                        )}
                      </span>
                      {selectedEmail && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-medium",
                            selectedEmail.enabled
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-zinc-700 text-zinc-500",
                          )}
                        >
                          {selectedEmail.enabled ? "Enabled" : "Disabled"}
                        </span>
                      )}
                    </div>

                    {/* Right: send buttons */}
                    <div className="flex items-center gap-2">
                      {/* Invite from Challenge */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenImportModal}
                        className="h-7 border-zinc-700 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <Users className="mr-1.5 h-3 w-3" />
                        Invite from Challenge
                      </Button>

                      {/* Send Test */}
                      {unsentParticipants && unsentParticipants.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-zinc-700 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                            >
                              <User className="mr-1.5 h-3 w-3" />
                              Send Test
                              <ChevronDown className="ml-1 h-3 w-3 text-zinc-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="max-h-64 w-72 overflow-y-auto border-zinc-700 bg-zinc-900"
                          >
                            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                              Send to one participant
                            </div>
                            {unsentParticipants.map(
                              (user: UnsentParticipant) => (
                                <DropdownMenuItem
                                  key={user.id}
                                  onClick={() =>
                                    handleSendTest(
                                      user.id as Id<"users">,
                                    )
                                  }
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
                                    <div className="truncate text-xs">
                                      {user.name || user.username}
                                    </div>
                                    <div className="truncate text-[10px] text-zinc-500">
                                      {user.email}
                                    </div>
                                  </div>
                                </DropdownMenuItem>
                              ),
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {/* Send to All */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="h-7 bg-amber-500 px-3 text-xs text-black hover:bg-amber-400"
                            disabled={!unsentParticipants?.length}
                          >
                            <Send className="mr-1.5 h-3 w-3" />
                            Send to All ({unsentParticipants?.length ?? 0})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-zinc-100">
                              Send to all participants?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">
                              This will send &quot;{selectedEmail?.name}&quot;
                              to {unsentParticipants?.length ?? 0} participants
                              who haven&apos;t received it yet.
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
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Send
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ===== EMPTY STATE ===== */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto h-10 w-10 text-zinc-700" />
              <div className="mt-2 text-sm text-zinc-400">
                Select an email or create a new one
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Compose, preview, and send emails to challenge participants
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={handleNewEmail}
                  className="bg-amber-500 text-black hover:bg-amber-400"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Email
                </Button>
                {defaultTemplates &&
                  defaultTemplates.some(
                    (t: DefaultTemplate) => !t.alreadyAdded,
                  ) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowTemplates(true)}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      From Template
                    </Button>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* TEMPLATES DIALOG                                                  */}
      {/* ================================================================= */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Email Templates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {defaultTemplates?.map((template: DefaultTemplate) => (
              <div
                key={template.name}
                className={cn(
                  "flex items-center justify-between rounded border px-3 py-2.5",
                  template.alreadyAdded
                    ? "border-zinc-800 bg-zinc-800/30"
                    : "border-zinc-800 bg-zinc-800/50",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">
                      {template.name}
                    </span>
                    {template.sendOnDay && (
                      <span className="text-[10px] text-zinc-500">
                        Day {template.sendOnDay}
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 text-[9px] font-medium",
                        template.trigger === "on_signup"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-zinc-700 text-zinc-400",
                      )}
                    >
                      {template.trigger === "on_signup"
                        ? "On Signup"
                        : "Manual"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {template.subject}
                  </div>
                </div>
                {template.alreadyAdded ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    Added
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddTemplate(template.name)}
                    className="h-6 border-zinc-700 px-2 text-[10px] text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                  >
                    <Plus className="mr-1 h-2.5 w-2.5" />
                    Add
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* IMPORT FROM CHALLENGE DIALOG                                      */}
      {/* ================================================================= */}
      <Dialog
        open={showImportModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowImportModal(false);
            setImportChallengeId(null);
            setImportSelectedUserIds(new Set());
            setImportSearch("");
          }
        }}
      >
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              {importChallengeId ? (
                <>
                  <button
                    onClick={handleBackToChallengeList}
                    className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span>Select Participants</span>
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 text-amber-400" />
                  <span>Invite from Challenge</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {!importChallengeId ? (
            /* ---- Step 1: Pick a challenge ---- */
            <div className="flex flex-col gap-1 overflow-y-auto py-1">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Select a challenge to import participants from
              </div>
              {!importChallenges ? (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading challenges...
                </div>
              ) : importChallenges.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No other challenges found
                </div>
              ) : (
                importChallenges.map((challenge: ImportChallenge) => (
                  <button
                    key={challenge.id}
                    onClick={() =>
                      handleSelectImportChallenge(challenge.id)
                    }
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-zinc-200">
                        {challenge.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">
                        {challenge.startDate} &mdash; {challenge.endDate}
                      </div>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-center gap-1 text-[10px] text-zinc-400">
                      <Users className="h-3 w-3" />
                      {challenge.participantCount}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* ---- Step 2: Pick participants ---- */
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {/* Search + select all bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={importSearch}
                    onChange={(e) => setImportSearch(e.target.value)}
                    placeholder="Search by name, username, or email..."
                    className="h-8 border-zinc-700 bg-zinc-800 pl-8 text-xs text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Select all + count bar */}
              {filteredImportParticipants && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-2 text-[10px] text-zinc-400 transition-colors hover:text-zinc-200"
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                        (() => {
                          const selectable =
                            filteredImportParticipants.filter(
                              (p: ImportParticipant) => !p.alreadySent,
                            );
                          const allSelected =
                            selectable.length > 0 &&
                            selectable.every((p: ImportParticipant) =>
                              importSelectedUserIds.has(p.id),
                            );
                          return allSelected
                            ? "border-amber-500 bg-amber-500"
                            : "border-zinc-600 bg-zinc-800";
                        })(),
                      )}
                    >
                      {(() => {
                        const selectable =
                          filteredImportParticipants.filter(
                            (p: ImportParticipant) => !p.alreadySent,
                          );
                        const allSelected =
                          selectable.length > 0 &&
                          selectable.every((p: ImportParticipant) =>
                            importSelectedUserIds.has(p.id),
                          );
                        return allSelected ? (
                          <Check className="h-2.5 w-2.5 text-black" />
                        ) : null;
                      })()}
                    </div>
                    Select all
                  </button>
                  <span className="text-[10px] text-zinc-500">
                    {importSelectedUserIds.size > 0 && (
                      <span className="mr-1 font-medium text-amber-400">
                        {importSelectedUserIds.size} selected
                      </span>
                    )}
                    {filteredImportParticipants.length} participant
                    {filteredImportParticipants.length !== 1 ? "s" : ""}
                    {filteredImportParticipants.filter(
                      (p: ImportParticipant) => p.alreadySent,
                    ).length > 0 && (
                      <span className="ml-1 text-zinc-600">
                        (
                        {
                          filteredImportParticipants.filter(
                            (p: ImportParticipant) => p.alreadySent,
                          ).length
                        }{" "}
                        already sent)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Participant list */}
              <div className="flex-1 space-y-0.5 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-1">
                {!filteredImportParticipants ? (
                  <div className="flex items-center justify-center py-8 text-zinc-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading participants...
                  </div>
                ) : filteredImportParticipants.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    {importSearch
                      ? "No participants match your search"
                      : "No participants in this challenge"}
                  </div>
                ) : (
                  filteredImportParticipants.map(
                    (participant: ImportParticipant) => {
                      const isSelected = importSelectedUserIds.has(
                        participant.id,
                      );
                      const isSent = participant.alreadySent;

                      return (
                        <button
                          key={participant.id}
                          onClick={() => {
                            if (!isSent)
                              handleToggleImportUser(participant.id);
                          }}
                          disabled={isSent}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors",
                            isSent
                              ? "cursor-not-allowed opacity-50"
                              : isSelected
                                ? "bg-amber-500/10"
                                : "hover:bg-zinc-800/50",
                          )}
                        >
                          {/* Checkbox */}
                          <div
                            className={cn(
                              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors",
                              isSent
                                ? "border-zinc-700 bg-zinc-800"
                                : isSelected
                                  ? "border-amber-500 bg-amber-500"
                                  : "border-zinc-600 bg-zinc-800",
                            )}
                          >
                            {isSent ? (
                              <CheckCircle className="h-2.5 w-2.5 text-zinc-500" />
                            ) : isSelected ? (
                              <Check className="h-2.5 w-2.5 text-black" />
                            ) : null}
                          </div>

                          {/* Avatar */}
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
                            {participant.avatarUrl ? (
                              <img
                                src={participant.avatarUrl}
                                alt=""
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <User className="h-3 w-3 text-zinc-500" />
                            )}
                          </div>

                          {/* User info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium text-zinc-200">
                                {participant.name || participant.username}
                              </span>
                              {participant.name && (
                                <span className="truncate text-[10px] text-zinc-500">
                                  @{participant.username}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-zinc-500">
                              {participant.email}
                            </div>
                          </div>

                          {/* Already sent badge */}
                          {isSent && (
                            <span className="flex-shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                              Already sent
                            </span>
                          )}
                        </button>
                      );
                    },
                  )
                )}
              </div>

              {/* Send button */}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                <div className="text-[10px] text-zinc-500">
                  {importSelectedUserIds.size > 0
                    ? `${importSelectedUserIds.size} recipient${importSelectedUserIds.size !== 1 ? "s" : ""} selected`
                    : "Select participants to send to"}
                </div>
                <Button
                  size="sm"
                  onClick={handleSendToImported}
                  disabled={
                    importSelectedUserIds.size === 0 || importSending
                  }
                  className="h-8 bg-amber-500 px-4 text-xs text-black hover:bg-amber-400 disabled:opacity-40"
                >
                  {importSending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3 w-3" />
                      Send to {importSelectedUserIds.size || "..."}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
