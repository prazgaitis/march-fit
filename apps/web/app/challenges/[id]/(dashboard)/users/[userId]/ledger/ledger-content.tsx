"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useQuery } from "convex/react";
import * as XLSX from "xlsx";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowLeft, Download, Flame, Loader2, Trophy } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PointsDisplay } from "@/components/ui/points-display";
import { cn } from "@/lib/utils";

interface LedgerContentProps {
  challengeId: string;
  profileUserId: string;
}

type LedgerDay = {
  date: string;
  streakBonus: number;
  activityBasePoints: number;
  activityBonusPoints: number;
  activityPoints: number;
  dayTotal: number;
  activities: Array<{
    id: string;
    activityTypeName: string;
    isNegative: boolean;
    pointsEarned: number;
    basePoints?: number;
    bonusPoints?: number;
    triggeredBonuses?: Array<{ description: string; bonusPoints: number }>;
    notes?: string | null;
    metrics?: Record<string, unknown>;
  }>;
};

type CellKey = `${number}:${number}`;

/** Round to 4 decimal places, strip trailing zeros. */
function fmt(n: number): string {
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

export function LedgerContent({
  challengeId,
  profileUserId,
}: LedgerContentProps) {
  const ledger = useQuery(api.queries.users.getLedger, {
    userId: profileUserId as Id<"users">,
    challengeId: challengeId as Id<"challenges">,
  });

  if (ledger === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ledger === null) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Ledger not found</CardTitle>
          <CardDescription>
            This user may not be participating in this challenge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/challenges/${challengeId}/dashboard`}>
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const {
    user,
    challenge,
    totalPoints,
    totalActivityPoints,
    totalStreakBonus,
    days,
  } = ledger;
  const totalActivityBasePoints = ledger.totalActivityBasePoints ?? totalActivityPoints;
  const totalActivityBonusPoints = ledger.totalActivityBonusPoints ?? 0;

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full bg-black text-white">
      <div className="sticky top-0 z-20 border-b border-zinc-800 bg-black/95 px-3 py-3 backdrop-blur sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/challenges/${challengeId}/users/${profileUserId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold sm:text-xl">Points Ledger</h1>
              <p className="text-xs text-zinc-400 sm:text-sm">
                {user.name ?? user.username} · {challenge.name}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => downloadLedgerCsv({
              days: days as LedgerDay[],
              totalActivityBasePoints,
              totalActivityBonusPoints,
              totalActivityPoints,
              totalStreakBonus,
              totalPoints,
              challengeName: challenge.name,
              userName: user.name ?? user.username ?? "user",
            })}
            disabled={days.length === 0}
            className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          <SummaryMetric label="Base" points={totalActivityBasePoints} />
          <SummaryMetric
            label="Activity Bonus"
            points={totalActivityBonusPoints}
            className={totalActivityBonusPoints >= 0 ? "text-amber-400" : "text-red-400"}
          />
          <SummaryMetric label="Activity Total" points={totalActivityPoints} />
          <SummaryMetric
            label="Streak Bonus"
            points={totalStreakBonus}
            icon={<Flame className="mr-1 inline h-3.5 w-3.5 text-orange-500" />}
            className="text-orange-400"
          />
          <SummaryMetric
            label="Grand Total"
            points={totalPoints}
            icon={<Trophy className="mr-1 inline h-3.5 w-3.5 text-yellow-400" />}
          />
        </div>
      </div>

      {days.length === 0 ? (
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No activities logged yet.
            </CardContent>
          </Card>
        </div>
      ) : (
        <LedgerTable
          days={days as LedgerDay[]}
          totalActivityBasePoints={totalActivityBasePoints}
          totalActivityBonusPoints={totalActivityBonusPoints}
          totalActivityPoints={totalActivityPoints}
          totalStreakBonus={totalStreakBonus}
          totalPoints={totalPoints}
        />
      )}
    </div>
  );
}

function SummaryMetric({
  label,
  points,
  icon,
  className,
}: {
  label: string;
  points: number;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/90 px-2 py-2">
      <p className="text-[11px] text-zinc-400 sm:text-xs">
        {icon}
        {label}
      </p>
      <PointsDisplay
        points={points}
        size="sm"
        showSign={false}
        showLabel={false}
        className={cn("font-bold text-zinc-100", className)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger Table
// ---------------------------------------------------------------------------

interface LedgerTableProps {
  days: LedgerDay[];
  totalActivityBasePoints: number;
  totalActivityBonusPoints: number;
  totalActivityPoints: number;
  totalStreakBonus: number;
  totalPoints: number;
}

type TableRow =
  | { type: "activity"; dayDate: string; showDate: boolean; activity: LedgerDay["activities"][number] }
  | { type: "streak"; dayDate: string; showDate: boolean; bonus: number }
  | { type: "day_total"; dayDate: string; showDate: boolean; day: LedgerDay }
  | { type: "grand_total"; base: number; bonus: number; activityTotal: number; streak: number; total: number };

function LedgerTable({
  days,
  totalActivityBasePoints,
  totalActivityBonusPoints,
  totalActivityPoints,
  totalStreakBonus,
  totalPoints,
}: LedgerTableProps) {
  const [selectedCells, setSelectedCells] = useState<Set<CellKey>>(new Set());
  const tableRef = useRef<HTMLTableElement>(null);
  const isDragging = useRef(false);
  const dragAnchor = useRef<{ row: number; col: number } | null>(null);

  const rows = useMemo(() => {
    const result: TableRow[] = [];
    for (const day of days) {
      let showDate = true;
      for (const activity of day.activities) {
        result.push({ type: "activity", dayDate: day.date, showDate, activity });
        showDate = false;
      }
      if (day.streakBonus > 0) {
        result.push({ type: "streak", dayDate: day.date, showDate, bonus: day.streakBonus });
        showDate = false;
      }
      result.push({ type: "day_total", dayDate: day.date, showDate, day });
    }
    result.push({
      type: "grand_total",
      base: totalActivityBasePoints,
      bonus: totalActivityBonusPoints,
      activityTotal: totalActivityPoints,
      streak: totalStreakBonus,
      total: totalPoints,
    });
    return result;
  }, [days, totalActivityBasePoints, totalActivityBonusPoints, totalActivityPoints, totalStreakBonus, totalPoints]);

  // Build a map of cell values for selection sum
  const cellValues = useMemo(() => {
    const map = new Map<CellKey, number>();
    rows.forEach((row, rowIdx) => {
      if (row.type === "activity") {
        const a = row.activity;
        map.set(`${rowIdx}:2`, a.basePoints ?? a.pointsEarned);
        map.set(`${rowIdx}:3`, a.bonusPoints ?? 0);
        map.set(`${rowIdx}:4`, a.pointsEarned);
      } else if (row.type === "streak") {
        map.set(`${rowIdx}:5`, row.bonus);
      } else if (row.type === "day_total") {
        const d = row.day;
        map.set(`${rowIdx}:2`, d.activityBasePoints);
        map.set(`${rowIdx}:3`, d.activityBonusPoints);
        map.set(`${rowIdx}:4`, d.activityPoints);
        map.set(`${rowIdx}:5`, d.streakBonus);
        map.set(`${rowIdx}:6`, d.dayTotal);
      } else if (row.type === "grand_total") {
        map.set(`${rowIdx}:2`, row.base);
        map.set(`${rowIdx}:3`, row.bonus);
        map.set(`${rowIdx}:4`, row.activityTotal);
        map.set(`${rowIdx}:5`, row.streak);
        map.set(`${rowIdx}:6`, row.total);
      }
    });
    return map;
  }, [rows]);

  const selectionSum = useMemo(() => {
    let sum = 0;
    for (const key of selectedCells) {
      sum += cellValues.get(key) ?? 0;
    }
    return sum;
  }, [selectedCells, cellValues]);

  /** Resolve data-row / data-col from the element under the pointer. */
  const cellFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const td = (e.target as HTMLElement).closest<HTMLElement>("td[data-row]");
    if (!td) return null;
    const row = Number(td.dataset.row);
    const col = Number(td.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { row, col };
  }, []);

  /** Build set of cells in the rectangle between anchor and current. */
  const buildRect = useCallback(
    (a: { row: number; col: number }, b: { row: number; col: number }) => {
      const next = new Set<CellKey>();
      const minRow = Math.min(a.row, b.row);
      const maxRow = Math.max(a.row, b.row);
      const minCol = Math.min(a.col, b.col);
      const maxCol = Math.max(a.col, b.col);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const k: CellKey = `${r}:${c}`;
          if (cellValues.has(k)) next.add(k);
        }
      }
      return next;
    },
    [cellValues],
  );

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const cell = cellFromEvent(e);
      if (!cell) return;
      const key: CellKey = `${cell.row}:${cell.col}`;
      if (!cellValues.has(key)) return;

      e.preventDefault(); // prevent text selection while dragging

      if (e.metaKey || e.ctrlKey) {
        // Toggle single cell, no drag
        setSelectedCells((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }

      isDragging.current = true;
      dragAnchor.current = cell;
      setSelectedCells(new Set([key]));
    },
    [cellFromEvent, cellValues],
  );

  const handleTableMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || !dragAnchor.current) return;
      const cell = cellFromEvent(e);
      if (!cell) return;
      setSelectedCells(buildRect(dragAnchor.current, cell));
    },
    [cellFromEvent, buildRect],
  );

  // End drag on mouseup (on document to catch outside-table releases)
  useEffect(() => {
    const onMouseUp = () => {
      isDragging.current = false;
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  // Escape to clear selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCells(new Set());
        dragAnchor.current = null;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Click outside table to clear
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedCells(new Set());
        dragAnchor.current = null;
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative pb-12">
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          className="w-full min-w-[640px] select-none border-x border-zinc-800 text-[13px]"
          style={{ borderCollapse: "collapse" }}
          onMouseDown={handleCellMouseDown}
          onMouseMove={handleTableMouseMove}
        >
          <tbody>
            <tr className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
              {["Date", "Activity", "Base", "Bonus", "Total", "Streak", "Day Total"].map(
                (header) => (
                  <td
                    key={header}
                    className={cn(
                      "border border-zinc-700/60 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500",
                      header !== "Date" && header !== "Activity"
                        ? "text-right"
                        : "text-left",
                    )}
                  >
                    {header}
                  </td>
                ),
              )}
            </tr>
            {rows.map((row, rowIdx) => (
              <LedgerRow
                key={rowIdx}
                row={row}
                rowIdx={rowIdx}
                selectedCells={selectedCells}
              />
            ))}
          </tbody>
        </table>
      </div>

      {selectedCells.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900/95 px-4 py-2 text-sm shadow-xl backdrop-blur">
          <span className="text-zinc-400">
            {selectedCells.size} cell{selectedCells.size !== 1 ? "s" : ""} selected
          </span>
          <span className="mx-2 text-zinc-600">—</span>
          <span className="font-mono font-semibold text-zinc-100">
            Sum: {fmt(selectionSum)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

const CELL = "border border-zinc-800/60 px-2.5 py-1";
const NUM_CELL = `${CELL} font-mono text-right tabular-nums`;

function LedgerRow({
  row,
  rowIdx,
  selectedCells,
}: {
  row: TableRow;
  rowIdx: number;
  selectedCells: Set<CellKey>;
}) {
  const selStyle = (colIdx: number) => {
    const key: CellKey = `${rowIdx}:${colIdx}`;
    return selectedCells.has(key)
      ? "ring-1 ring-inset ring-indigo-500/60 bg-indigo-500/10"
      : "";
  };

  const numCell = (colIdx: number, value: number | undefined, colorClass?: string) => {
    if (value === undefined || value === 0) {
      return <td className={cn(NUM_CELL, "text-zinc-700")}>—</td>;
    }
    return (
      <td
        data-row={rowIdx}
        data-col={colIdx}
        className={cn(NUM_CELL, "cursor-cell", selStyle(colIdx), colorClass)}
      >
        {fmt(value)}
      </td>
    );
  };

  if (row.type === "activity") {
    const a = row.activity;
    const base = a.basePoints ?? a.pointsEarned;
    const bonus = a.bonusPoints ?? 0;
    return (
      <tr className="hover:bg-zinc-800/20">
        <td className={cn(CELL, "text-left text-zinc-400 whitespace-nowrap")}>
          {row.showDate ? row.dayDate : ""}
        </td>
        <td className={cn(CELL, "text-left", a.isNegative && "text-red-400")}>
          {a.activityTypeName}
        </td>
        {numCell(2, base, a.isNegative ? "text-red-400" : undefined)}
        {numCell(3, bonus, "text-amber-400")}
        {numCell(4, a.pointsEarned, a.isNegative ? "text-red-400" : undefined)}
        <td className={cn(CELL)} />
        <td className={cn(CELL)} />
      </tr>
    );
  }

  if (row.type === "streak") {
    return (
      <tr className="text-orange-400 hover:bg-zinc-800/20">
        <td className={cn(CELL, "text-left text-zinc-400 whitespace-nowrap")}>
          {row.showDate ? row.dayDate : ""}
        </td>
        <td className={cn(CELL, "text-left")}>Streak bonus</td>
        <td className={cn(CELL)} />
        <td className={cn(CELL)} />
        <td className={cn(CELL)} />
        {numCell(5, row.bonus, "text-orange-400")}
        <td className={cn(CELL)} />
      </tr>
    );
  }

  if (row.type === "day_total") {
    const d = row.day;
    return (
      <tr className="bg-zinc-800/40 font-semibold">
        <td className={cn(CELL, "text-left text-zinc-400 whitespace-nowrap")}>
          {row.showDate ? row.dayDate : ""}
        </td>
        <td className={cn(CELL, "text-left text-zinc-500 text-[10px] uppercase tracking-wider")}>
          Day total
        </td>
        {numCell(2, d.activityBasePoints)}
        {numCell(3, d.activityBonusPoints, "text-amber-400")}
        {numCell(4, d.activityPoints)}
        {numCell(5, d.streakBonus, "text-orange-400")}
        {numCell(6, d.dayTotal)}
      </tr>
    );
  }

  // grand_total
  return (
    <tr className="sticky bottom-0 bg-zinc-800 font-bold">
      <td className={cn(CELL)} />
      <td className={cn(CELL, "text-left text-[10px] uppercase tracking-wider text-zinc-400")}>
        Grand total
      </td>
      <td data-row={rowIdx} data-col={2} className={cn(NUM_CELL, "cursor-cell", selStyle(2))}>
        {fmt(row.base)}
      </td>
      <td data-row={rowIdx} data-col={3} className={cn(NUM_CELL, "cursor-cell text-amber-400", selStyle(3))}>
        {fmt(row.bonus)}
      </td>
      <td data-row={rowIdx} data-col={4} className={cn(NUM_CELL, "cursor-cell", selStyle(4))}>
        {fmt(row.activityTotal)}
      </td>
      <td data-row={rowIdx} data-col={5} className={cn(NUM_CELL, "cursor-cell text-orange-400", selStyle(5))}>
        {fmt(row.streak)}
      </td>
      <td data-row={rowIdx} data-col={6} className={cn(NUM_CELL, "cursor-cell", selStyle(6))}>
        {fmt(row.total)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  "date",
  "entry_type",
  "activity_type",
  "base_points",
  "bonus_points",
  "total_points",
  "streak_bonus",
  "day_total",
  "bonus_details",
  "notes",
];

function downloadLedgerCsv({
  days,
  totalActivityBasePoints,
  totalActivityBonusPoints,
  totalActivityPoints,
  totalStreakBonus,
  totalPoints,
  challengeName,
  userName,
}: {
  days: LedgerDay[];
  totalActivityBasePoints: number;
  totalActivityBonusPoints: number;
  totalActivityPoints: number;
  totalStreakBonus: number;
  totalPoints: number;
  challengeName: string;
  userName: string;
}) {
  const header = [...CSV_COLUMNS];
  const body: (string | number)[][] = [];

  for (const day of days) {
    for (const a of day.activities) {
      body.push([
        day.date,
        "activity",
        a.activityTypeName,
        a.basePoints ?? a.pointsEarned,
        a.bonusPoints ?? 0,
        a.pointsEarned,
        "",
        "",
        a.triggeredBonuses?.map((b) => b.description).join(" | ") ?? "",
        a.notes ?? "",
      ]);
    }
    if (day.streakBonus > 0) {
      body.push([
        day.date,
        "streak_bonus",
        "Daily streak bonus",
        "",
        "",
        "",
        day.streakBonus,
        "",
        `Day ${day.streakBonus} streak`,
        "",
      ]);
    }
    body.push([
      day.date,
      "day_total",
      "",
      day.activityBasePoints,
      day.activityBonusPoints,
      day.activityPoints,
      day.streakBonus,
      day.dayTotal,
      "",
      "",
    ]);
  }

  body.push([
    "",
    "grand_total",
    "",
    totalActivityBasePoints,
    totalActivityBonusPoints,
    totalActivityPoints,
    totalStreakBonus,
    totalPoints,
    "",
    "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ledger");

  const datePart = format(new Date(), "yyyy-MM-dd");
  const filename = `ledger-${sanitizeFileSegment(challengeName)}-${sanitizeFileSegment(userName)}-${datePart}.csv`;
  XLSX.writeFile(workbook, filename, { bookType: "csv" });
}

function sanitizeFileSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "value"
  );
}
