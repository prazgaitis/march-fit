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

const PAGE_SIZE = 500;

/**
 * Generate a CSV export of all activities for a challenge.
 * Paginates through activities in batches to avoid hitting Convex limits.
 * Stores the result in Convex file storage and emails the admin a download link.
 */
export const generateCSV = action({
  args: {
    exportId: v.id("exports"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    // Mark export as processing
    await ctx.runMutation(internal.mutations.exports.markProcessing, {
      exportId: args.exportId,
    });

    try {
      // Fetch lookup data in parallel
      const [activityTypes, users, categories, exportRecord] = await Promise.all(
        [
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
        ],
      );

      // Build lookup maps
      const userMap = new Map(
        users.map((u: any) => [
          u._id,
          { name: u.name, username: u.username, email: u.email },
        ]),
      );
      const activityTypeMap = new Map(
        activityTypes.map((at: any) => [
          at._id,
          { name: at.name, categoryId: at.categoryId },
        ]),
      );
      const categoryMap = new Map(
        categories.map((c: any) => [c._id, c.name]),
      );

      // Pass 1: Paginate through all activities and collect them + discover metric keys
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

      // Sort metric keys alphabetically for consistent column order
      const metricKeys = [...metricKeysSet].sort();

      // Build CSV header with individual metric columns
      const CSV_HEADERS = [
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
        "Location City",
        "Location State",
        "Location Country",
        "Local Time",
        "Timezone",
        "Created At",
        ...metricKeys.map((k) => `Metric: ${k}`),
      ];

      // Pass 2: Build CSV rows
      const csvRows: string[] = [CSV_HEADERS.map(escapeCSV).join(",")];
      const totalRows = allActivities.length;

      for (const activity of allActivities) {
        const user = userMap.get(activity.userId);
        const activityType = activityTypeMap.get(activity.activityTypeId);
        const categoryName = activityType?.categoryId
          ? categoryMap.get(activityType.categoryId) ?? ""
          : "";

        const metrics = activity.metrics ?? {};
        const metricValues = metricKeys.map((key) =>
          metrics[key] !== undefined && metrics[key] !== null
            ? String(metrics[key])
            : "",
        );

        const row = [
          activity._id,
          user?.name ?? "",
          user?.username ?? "",
          user?.email ?? "",
          activityType?.name ?? "",
          categoryName,
          formatDate(activity.loggedDate),
          String(activity.pointsEarned),
          activity.source,
          activity.notes ?? "",
          activity.flagged ? "Yes" : "No",
          activity.flaggedReason ?? "",
          activity.resolutionStatus ?? "",
          activity.locationCity ?? "",
          activity.locationState ?? "",
          activity.locationCountry ?? "",
          activity.localTime ?? "",
          activity.timezone ?? "",
          formatDate(activity.createdAt),
          ...metricValues,
        ];

        csvRows.push(row.map(escapeCSV).join(","));
      }

      // Store CSV in Convex file storage
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const storageId = await ctx.storage.store(blob);

      // Mark export as completed
      await ctx.runMutation(internal.mutations.exports.markCompleted, {
        exportId: args.exportId,
        storageId: storageId as Id<"_storage">,
        totalRows,
      });

      // Get download URL and send email
      const downloadUrl = await ctx.storage.getUrl(storageId);
      if (downloadUrl && exportRecord) {
        const requester = userMap.get(exportRecord.requestedById);
        const email = requester?.email;
        if (email) {
          await resend.sendEmail(ctx, {
            from: DEFAULT_FROM_EMAIL,
            to: email,
            subject: "Your CSV Export is Ready",
            html: wrapEmailTemplate({
              headerTitle: "Export Complete",
              headerSubtitle: `${totalRows.toLocaleString()} activities exported`,
              content: `
                <p style="margin: 0 0 20px;">Your activity data export is ready for download. The file contains all activities for this challenge in CSV format.</p>

                <div style="text-align: center; margin: 28px 0;">
                  ${emailButton({ href: downloadUrl, label: "Download CSV" })}
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

/** Escape a value for CSV (RFC 4180). */
function escapeCSV(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Format a UTC ms timestamp to ISO date string. */
function formatDate(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toISOString();
}
