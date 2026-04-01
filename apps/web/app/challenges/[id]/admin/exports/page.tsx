"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useAction, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
} from "lucide-react";

export default function AdminExportsPage() {
  const params = useParams();
  const challengeId = params.id as string;
  const [isExporting, setIsExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const exports = useQuery(api.queries.exports.listByChallenge, {
    challengeId: challengeId as Id<"challenges">,
  });

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  const requestExport = useMutation(api.mutations.exports.requestExport);
  const generateXLSX = useAction(api.actions.exportActivitiesXLSX.generateXLSX);
  const deleteExport = useMutation(api.mutations.exports.deleteExport);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { exportId } = await requestExport({
        challengeId: challengeId as Id<"challenges">,
      });
      generateXLSX({
        exportId: exportId as Id<"exports">,
        challengeId: challengeId as Id<"challenges">,
      }).catch((err) => {
        console.error("XLSX export failed:", err);
      });
    } catch (error) {
      console.error("Failed to request export:", error);
      alert(
        error instanceof Error ? error.message : "Failed to request export",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (exportId: string) => {
    if (!confirm("Delete this export? The file will be permanently removed.")) return;
    setDeletingId(exportId);
    try {
      await deleteExport({ exportId: exportId as Id<"exports"> });
    } catch (error) {
      console.error("Failed to delete export:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatFilename = (exp: { createdAt: number }) => {
    const date = new Date(exp.createdAt);
    const slug = (challenge?.name ?? "export")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const ts = date.toISOString().slice(0, 10);
    return `${slug}-${ts}.xlsx`;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case "processing":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-zinc-500" />;
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "failed":
        return "bg-red-500/15 text-red-300 border-red-500/30";
      case "processing":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
            Data Exports
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Export all activity data as XLSX with per-user daily breakdowns
            and streaks. You&apos;ll receive an email when ready.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5" />
          )}
          Export XLSX
        </button>
      </div>

      {/* Exports List */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 px-3 py-2">
          <div className="col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Status
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Requested By
            </span>
          </div>
          <div className="col-span-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Rows
            </span>
          </div>
          <div className="col-span-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Requested At
            </span>
          </div>
          <div className="col-span-4 text-right">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Actions
            </span>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-zinc-800/50">
          {!exports ? (
            <div className="px-3 py-8 text-center text-xs text-zinc-600">
              Loading...
            </div>
          ) : exports.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-zinc-600">
              No exports yet. Click the button above to generate your first
              export.
            </div>
          ) : (
            exports.map((exp: (typeof exports)[number]) => (
              <div
                key={exp._id}
                className="grid grid-cols-12 items-center gap-2 px-3 py-2 hover:bg-zinc-800/30"
              >
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusStyle(exp.status)}`}
                  >
                    {statusIcon(exp.status)}
                    {exp.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-zinc-300">
                    {exp.requesterName}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className="font-mono text-xs text-zinc-300">
                    {exp.totalRows != null
                      ? exp.totalRows.toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div className="col-span-3">
                  <span className="font-mono text-xs text-zinc-500">
                    {new Date(exp.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-4 flex items-center justify-end gap-2">
                  {exp.status === "completed" && exp.downloadUrl ? (
                    <a
                      href={exp.downloadUrl}
                      download={formatFilename(exp)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  ) : exp.status === "failed" ? (
                    <span
                      className="text-xs text-red-400"
                      title={exp.error ?? ""}
                    >
                      Failed
                    </span>
                  ) : exp.status === "processing" ? (
                    <span className="text-xs text-zinc-500">Processing...</span>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                  <button
                    onClick={() => handleDelete(exp._id)}
                    disabled={deletingId === exp._id || exp.status === "processing"}
                    className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-red-400 disabled:opacity-30"
                    title="Delete export"
                  >
                    {deletingId === exp._id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
