"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { resend } from "../lib/resend";
import {
  DEFAULT_FROM_EMAIL,
  wrapEmailTemplate,
  emailButton,
} from "../lib/emailTemplate";
import * as XLSX from "xlsx";
import { formatDateOnlyFromUtcMs } from "../lib/dateOnly";
import {
  aggregateDailyStreakPoints,
  computeStreak,
  DAY_MS,
} from "../lib/streak";

const PAGE_SIZE = 500;

/**
 * Generate an XLSX export of all activities for a challenge.
 *
 * Sheets:
 *   1. "All Activities" — every activity row (same as old CSV)
 *   2. "User Summary"  — one row per user with totals
 *   3+  Per-user sheets — daily points breakdown with streaks
 */
export const generateXLSX = action({
  args: {
    exportId: v.id("exports"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.mutations.exports.markProcessing, {
      exportId: args.exportId,
    });

    try {
      // Fetch lookup data
      const [activityTypes, users, categories, exportRecord, challenge] =
        await Promise.all([
          ctx.runQuery(
            internal.queries.exports.getActivityTypesForChallenge,
            { challengeId: args.challengeId },
          ),
          ctx.runQuery(internal.queries.exports.getUsersForChallenge, {
            challengeId: args.challengeId,
          }),
          ctx.runQuery(internal.queries.exports.getAllCategories, {}),
          ctx.runQuery(internal.queries.exports.getById, {
            exportId: args.exportId,
          }),
          ctx.runQuery(internal.queries.exports.getChallengeById, {
            challengeId: args.challengeId,
          }),
        ]);

      // Build lookup maps
      const userMap = new Map<
        string,
        { name: string; username: string; email: string }
      >();
      for (const u of users as any[]) {
        userMap.set(u._id, {
          name: u.name ?? u.username,
          username: u.username,
          email: u.email,
        });
      }
      const activityTypeMap = new Map<
        string,
        {
          name: string;
          categoryId?: string;
          contributesToStreak?: boolean;
        }
      >();
      for (const at of activityTypes as any[]) {
        activityTypeMap.set(at._id, {
          name: at.name,
          categoryId: at.categoryId,
          contributesToStreak: at.contributesToStreak,
        });
      }
      const categoryMap = new Map<string, string>();
      for (const c of categories as any[]) {
        categoryMap.set(c._id, c.name);
      }

      // Paginate through all activities
      const allActivities: any[] = [];
      const metricKeysSet = new Set<string>();
      let cursor: string | undefined = undefined;

      while (true) {
        const result: any = await ctx.runQuery(
          internal.queries.exports.getActivitiesPage,
          {
            challengeId: args.challengeId,
            cursor,
            pageSize: PAGE_SIZE,
          },
        );

        for (const activity of result.page) {
          allActivities.push(activity);
          if (activity.metrics && typeof activity.metrics === "object") {
            for (const key of Object.keys(activity.metrics)) {
              metricKeysSet.add(key);
            }
          }
        }

        if (result.isDone) break;
        cursor = result.continueCursor;
      }

      const metricKeys = [...metricKeysSet].sort();
      const totalRows = allActivities.length;

      // ── Sheet 1: All Activities ──────────────────────────────
      const activityHeaders = [
        "Activity ID",
        "User Name",
        "User Username",
        "User Email",
        "Activity Type",
        "Category",
        "Logged Date",
        "Points Earned",
        "Source",
        "Notes",
        "Flagged",
        "Flagged Reason",
        "Resolution Status",
        "Created At",
        ...metricKeys.map((k) => `Metric: ${k}`),
      ];

      const activityRows = allActivities.map((activity) => {
        const user = userMap.get(activity.userId);
        const actType = activityTypeMap.get(activity.activityTypeId);
        const categoryName = actType?.categoryId
          ? categoryMap.get(actType.categoryId) ?? ""
          : "";
        const metrics = activity.metrics ?? {};

        return [
          activity._id,
          user?.name ?? "",
          user?.username ?? "",
          user?.email ?? "",
          actType?.name ?? "",
          categoryName,
          formatDate(activity.loggedDate),
          activity.pointsEarned,
          activity.source,
          stripRichText(activity.notes ?? ""),
          activity.flagged ? "Yes" : "No",
          activity.flaggedReason ?? "",
          activity.resolutionStatus ?? "",
          formatDate(activity.createdAt),
          ...metricKeys.map((key) =>
            metrics[key] !== undefined && metrics[key] !== null
              ? metrics[key]
              : "",
          ),
        ];
      });

      // ── Compute per-user daily data ──────────────────────────
      // Group activities by user
      const activitiesByUser = new Map<string, any[]>();
      for (const a of allActivities) {
        const list = activitiesByUser.get(a.userId) ?? [];
        list.push(a);
        activitiesByUser.set(a.userId, list);
      }

      // Build date range from challenge
      const challengeStart = (challenge as any)?.startDate;
      const challengeEnd = (challenge as any)?.endDate;
      const durationDays = (challenge as any)?.durationDays ?? 30;
      const streakMinPoints = (challenge as any)?.streakMinPoints ?? 10;

      const dateRange = buildDateRange(challengeStart, challengeEnd, durationDays);

      // Streak contribution lookup
      const contributesToStreak = (atId: string) =>
        activityTypeMap.get(atId)?.contributesToStreak ?? false;

      // ── Sheet 2: User Summary ────────────────────────────────
      const summaryHeaders = [
        "Name",
        "Username",
        "Email",
        "Activity Points",
        "Streak Bonus",
        "Total Points",
        "Total Activities",
        "Active Days",
        "Longest Streak",
        "Current Streak",
      ];

      const summaryRows: any[][] = [];

      // ── Sheet 3: Daily Breakdown (all users) ─────────────────
      const dailyHeaders = [
        "Name",
        "Username",
        "Date",
        "Day #",
        "Activities",
        "Activity Points",
        "Streak Bonus",
        "Day Total",
        "Running Total",
        "Streak",
        "Activity Breakdown",
      ];

      const dailyRows: any[][] = [];

      // Sort users by name for consistent ordering
      const sortedUserIds = Array.from(userMap.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id]) => id);

      for (const userId of sortedUserIds) {
        const user = userMap.get(userId)!;
        const userActivities = activitiesByUser.get(userId) ?? [];

        if (userActivities.length === 0) continue;

        // Compute streak
        const dailyStreakPoints = aggregateDailyStreakPoints(
          userActivities,
          contributesToStreak,
        );
        const streakResult = computeStreak(dailyStreakPoints, streakMinPoints);

        // Compute longest streak from dailyStreakCount
        let longestStreak = 0;
        for (const count of streakResult.dailyStreakCount.values()) {
          if (count > longestStreak) longestStreak = count;
        }

        // Group activities by date
        const byDate = new Map<string, any[]>();
        let activityPoints = 0;
        for (const a of userActivities) {
          const dateStr = formatDate(a.loggedDate);
          const list = byDate.get(dateStr) ?? [];
          list.push(a);
          byDate.set(dateStr, list);
          activityPoints += a.pointsEarned;
        }

        const totalStreakBonus = streakResult.totalStreakBonus;

        // Summary row
        summaryRows.push([
          user.name,
          user.username,
          user.email,
          activityPoints,
          totalStreakBonus,
          activityPoints + totalStreakBonus,
          userActivities.length,
          byDate.size,
          longestStreak,
          streakResult.currentStreak,
        ]);

        // Daily breakdown rows for this user
        let runningTotal = 0;

        for (let i = 0; i < dateRange.length; i++) {
          const { dateStr, dateMs } = dateRange[i];
          const dayActivities = byDate.get(dateStr) ?? [];
          const dayActivityPoints = dayActivities.reduce(
            (sum: number, a: any) => sum + a.pointsEarned,
            0,
          );

          // Streak bonus for this day = the streak count (day 1 = +1, day 5 = +5, etc.)
          const streakCount = streakResult.dailyStreakCount.get(dateMs) ?? 0;
          const dayTotal = dayActivityPoints + streakCount;
          runningTotal += dayTotal;

          // Build activity breakdown string
          const breakdown = dayActivities
            .map((a: any) => {
              const atName = activityTypeMap.get(a.activityTypeId)?.name ?? "?";
              return `${atName}: ${a.pointsEarned} pts`;
            })
            .join("; ");

          dailyRows.push([
            user.name,
            user.username,
            dateStr,
            i + 1,
            dayActivities.length,
            dayActivityPoints,
            streakCount > 0 ? streakCount : "",
            dayTotal,
            runningTotal,
            streakCount > 0 ? streakCount : "",
            breakdown,
          ]);
        }
      }

      // Sort summary by total points (index 5: activity + streak) descending
      summaryRows.sort((a, b) => (b[5] as number) - (a[5] as number));

      // ── Build per-user sheet data ────────────────────────────
      type UserSheetData = { sheetName: string; rows: any[][] };
      const userSheets: UserSheetData[] = [];

      const userSheetHeaders = [
        "Date", "Day #", "Activities", "Activity Points",
        "Streak Bonus", "Day Total", "Running Total", "Streak",
        "Activity Breakdown",
      ];

      for (const userId of sortedUserIds) {
        const user = userMap.get(userId)!;
        const userActivities = activitiesByUser.get(userId) ?? [];
        if (userActivities.length === 0) continue;

        const dailyStreakPoints = aggregateDailyStreakPoints(
          userActivities, contributesToStreak,
        );
        const streakResult = computeStreak(dailyStreakPoints, streakMinPoints);

        const byDate = new Map<string, any[]>();
        for (const a of userActivities) {
          const dateStr = formatDate(a.loggedDate);
          const list = byDate.get(dateStr) ?? [];
          list.push(a);
          byDate.set(dateStr, list);
        }

        const rows: any[][] = [];
        let runningTotal = 0;
        for (let i = 0; i < dateRange.length; i++) {
          const { dateStr, dateMs } = dateRange[i];
          const dayActs = byDate.get(dateStr) ?? [];
          const dayActPts = dayActs.reduce((s: number, a: any) => s + a.pointsEarned, 0);
          const streak = streakResult.dailyStreakCount.get(dateMs) ?? 0;
          const dayTotal = dayActPts + streak;
          runningTotal += dayTotal;
          const breakdown = dayActs
            .map((a: any) => `${activityTypeMap.get(a.activityTypeId)?.name ?? "?"}: ${a.pointsEarned} pts`)
            .join("; ");
          rows.push([dateStr, i + 1, dayActs.length, dayActPts, streak > 0 ? streak : "", dayTotal, runningTotal, streak > 0 ? streak : "", breakdown]);
        }

        userSheets.push({
          sheetName: sanitizeSheetName(user.name || user.username),
          rows: [userSheetHeaders, ...rows],
        });
      }

      // ── Build workbook ───────────────────────────────────────
      const wb = XLSX.utils.book_new();

      // Sheet 1: All Activities
      const ws1 = XLSX.utils.aoa_to_sheet([activityHeaders, ...activityRows]);
      setColumnWidths(ws1, activityHeaders);
      XLSX.utils.book_append_sheet(wb, ws1, "All Activities");

      // Sheet 2: User Summary
      const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
      setColumnWidths(ws2, summaryHeaders);
      XLSX.utils.book_append_sheet(wb, ws2, "User Summary");

      // Sheet 3: Daily Breakdown (all users, filterable by name)
      const ws3 = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
      setColumnWidths(ws3, dailyHeaders);
      XLSX.utils.book_append_sheet(wb, ws3, "Daily Breakdown");

      // Per-user sheets
      const usedNames = new Set(["All Activities", "User Summary", "Daily Breakdown"]);
      for (const sheet of userSheets) {
        let name = sheet.sheetName;
        let suffix = 2;
        while (usedNames.has(name)) {
          name = `${sheet.sheetName.slice(0, 27)} (${suffix})`;
          suffix++;
        }
        usedNames.add(name);
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
        setColumnWidths(ws, sheet.rows[0]);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }

      // Write to buffer
      const xlsxBuffer = XLSX.write(wb, {
        type: "buffer",
        bookType: "xlsx",
      });

      // Store in Convex file storage
      const blob = new Blob([xlsxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const storageId = await ctx.storage.store(blob);

      // Mark completed
      await ctx.runMutation(internal.mutations.exports.markCompleted, {
        exportId: args.exportId,
        storageId: storageId as Id<"_storage">,
        totalRows,
      });

      // Send email
      const downloadUrl = await ctx.storage.getUrl(storageId);
      if (downloadUrl && exportRecord) {
        const requester = userMap.get(
          (exportRecord as any).requestedById,
        );
        const email = requester?.email;
        if (email) {
          await resend.sendEmail(ctx, {
            from: DEFAULT_FROM_EMAIL,
            to: email,
            subject: "Your Data Export is Ready",
            html: wrapEmailTemplate({
              headerTitle: "Export Complete",
              headerSubtitle: `${totalRows.toLocaleString()} activities exported`,
              content: `
                <p style="margin: 0 0 20px;">Your activity data export is ready for download. The XLSX file contains all activities, a user summary, and per-user daily breakdowns with streaks.</p>

                <div style="text-align: center; margin: 28px 0;">
                  ${emailButton({ href: downloadUrl, label: "Download XLSX" })}
                </div>

                <p style="color: #52525b; font-size: 12px; margin: 20px 0 0;">This download link will expire. If you need the file again, you can request a new export from the admin panel.</p>
              `,
              footerText:
                "You received this because you requested a data export on March Fitness.",
            }),
          });
        }
      }

      return { success: true, totalRows };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.mutations.exports.markFailed, {
        exportId: args.exportId,
        error: message,
      });
      throw error;
    }
  },
});

// ── Helpers ──────────────────────────────────────────────────

function formatDate(ms: number): string {
  if (!ms) return "";
  return formatDateOnlyFromUtcMs(ms);
}

function stripRichText(text: string): string {
  if (!text) return "";
  // If it looks like a rich text JSON blob, extract plain text
  if (text.startsWith("{")) {
    try {
      const doc = JSON.parse(text);
      return extractText(doc);
    } catch {
      return text;
    }
  }
  return text;
}

function extractText(node: any): string {
  if (typeof node === "string") return node;
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join("");
  }
  return "";
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[[\]*?/\\:]/g, "").slice(0, 31).trim() || "User";
}

function buildDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  durationDays: number,
): Array<{ dateStr: string; dateMs: number }> {
  if (!startDate) return [];

  const dates: Array<{ dateStr: string; dateMs: number }> = [];
  const startMs = new Date(startDate + "T00:00:00Z").getTime();

  for (let i = 0; i < durationDays; i++) {
    const dateMs = startMs + i * DAY_MS;
    const dateStr = formatDateOnlyFromUtcMs(dateMs);
    dates.push({ dateStr, dateMs });
  }

  return dates;
}

function setColumnWidths(
  ws: XLSX.WorkSheet,
  headers: any[],
): void {
  ws["!cols"] = headers.map((h: any) => {
    const label = String(h);
    return { wch: Math.max(label.length + 2, 12) };
  });
}
