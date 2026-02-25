"use client";

import {
  eachDayOfInterval,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { Flame } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StreakCalendarCardProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  streakMinPoints: number;
  dailyPoints: Record<string, number>; // YYYY-MM-DD -> total streak-contributing points
  dailyStreakCount: Record<string, number>; // YYYY-MM-DD -> running streak count
  totalStreakBonusPoints?: number;
}

export function StreakCalendarCard({
  startDate,
  endDate,
  streakMinPoints,
  dailyPoints,
  dailyStreakCount,
  totalStreakBonusPoints,
}: StreakCalendarCardProps) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // Pad to start on a Monday for the calendar grid
  const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calendarStart, end });

  // Group into weeks (rows)
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  for (const day of allDays) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      const last = currentWeek[currentWeek.length - 1];
      currentWeek.push(new Date(last.getTime() + 86400000));
    }
    weeks.push(currentWeek);
  }

  const totalStreakPoints = Object.values(dailyPoints).reduce((s, v) => s + v, 0);
  const streakDays = Object.keys(dailyStreakCount).length;

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="h-5 w-5 text-orange-500" />
          Streak Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayLabels.map((label, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const isInRange = day >= start && day <= end;
                    const pts = dailyPoints[key] ?? 0;
                    const streak = dailyStreakCount[key] ?? 0;
                    const meetsStreak = streak > 0;
                    const hasPoints = pts > 0;
                    const dayNum = day.getDate();
                    const isToday = key === format(new Date(), "yyyy-MM-dd");

                    if (!isInRange) {
                      return <div key={key} className="h-11 rounded-sm" />;
                    }

                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "relative h-11 rounded-sm flex flex-col items-center justify-center transition-colors cursor-default overflow-hidden",
                              !hasPoints && "bg-muted/20 text-muted-foreground/40",
                              hasPoints && !meetsStreak && "bg-muted/40 text-muted-foreground",
                              meetsStreak && "bg-orange-500/[0.08] text-foreground",
                              isToday && "ring-1 ring-foreground/20"
                            )}
                          >
                            <span className="absolute top-0.5 right-1 text-[8px] leading-none opacity-50">
                              {dayNum}
                            </span>
                            {meetsStreak ? (
                              <>
                                <span className="text-sm font-semibold leading-none">
                                  {streak}
                                </span>
                                <span className="text-[8px] leading-none mt-0.5 opacity-60">
                                  {pts.toFixed(0)} pts
                                </span>
                              </>
                            ) : hasPoints ? (
                              <span className="text-[9px] leading-none font-medium">
                                {pts.toFixed(0)} pts
                              </span>
                            ) : null}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">
                            {format(day, "MMM d, yyyy")}
                          </p>
                          {meetsStreak ? (
                            <p>Day {streak} of streak · {pts.toFixed(0)} pts · +{streak} bonus</p>
                          ) : hasPoints ? (
                            <p>{pts.toFixed(0)} pts (below {streakMinPoints} threshold)</p>
                          ) : (
                            <p className="text-muted-foreground">No streak activity</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </TooltipProvider>

        {/* Summary + Legend */}
        <div className="mt-3 flex items-baseline gap-2 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{totalStreakPoints.toFixed(0)}</span> streak-eligible pts
            {" · "}
            <span className="font-semibold text-foreground">{streakDays}</span> streak {streakDays === 1 ? "day" : "days"}
            {(totalStreakBonusPoints ?? 0) > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">+{totalStreakBonusPoints}</span> streak bonus
              </>
            )}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-muted/20 border border-border/50" />
            <span>No activity</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-muted/40" />
            <span>&lt; {streakMinPoints} pts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-orange-500/[0.08]" />
            <span>&ge; {streakMinPoints} pts (streak)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
