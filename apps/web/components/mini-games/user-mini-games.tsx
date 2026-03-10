"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  formatMonthDayFromUtcMs,
  formatDateShortFromUtcMs,
} from "@/lib/date-only";
import {
  Check,
  Gamepad2,
  Minus,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { formatPointsCompact } from "@/lib/points";
import { cn } from "@/lib/utils";

import { MiniGameCardShell } from "./mini-game-card-shell";

interface UserMiniGamesProps {
  challengeId: string;
  userId: string;
}

type MiniGameType = "partner_week" | "hunt_week" | "pr_week";
type ParticipantUser = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
};
type MiniGameHistoryItem = {
  miniGame: {
    id: string;
    type: MiniGameType;
    name: string;
    status: "active" | "completed";
    startsAt: number;
    endsAt: number;
    config?: Record<string, unknown> | null;
  };
  participation: {
    initialState: Record<string, unknown> | null;
    bonusPoints: number | null;
    outcome: Record<string, unknown> | null;
    partnerUser: ParticipantUser | null;
    preyUser: ParticipantUser | null;
    hunterUser: ParticipantUser | null;
  };
};
type ActiveMiniGameStatus = {
  miniGame: {
    id: string;
    type: MiniGameType;
    name: string;
    startsAt: number;
    endsAt: number;
    config?: Record<string, unknown> | null;
  };
  participation: {
    initialState: Record<string, unknown> | null;
    partnerUser: ParticipantUser | null;
    preyUser: ParticipantUser | null;
    hunterUser: ParticipantUser | null;
  };
  liveData: {
    userCurrentPoints: number | null;
    partnerCurrentPoints: number | null;
    partnerPeriodPoints: number;
    preyCurrentPoints: number | null;
    hunterCurrentPoints: number | null;
    currentWeekMax: number;
  };
};

const gameTypeInfo: Record<
  MiniGameType,
  { label: string; icon: typeof Users; color: string }
> = {
  partner_week: {
    label: "Partner Week",
    icon: Users,
    color: "text-indigo-400",
  },
  hunt_week: {
    label: "Hunt Week",
    icon: Target,
    color: "text-red-400",
  },
  pr_week: {
    label: "PR Week",
    icon: Zap,
    color: "text-amber-400",
  },
};

export function UserMiniGames({ challengeId, userId }: UserMiniGamesProps) {
  const miniGameHistory = useQuery(api.queries.miniGames.getUserHistory, {
    challengeId: challengeId as Id<"challenges">,
    userId: userId as Id<"users">,
  });
  const activeMiniGames = useQuery(api.queries.miniGames.getUserStatus, {
    challengeId: challengeId as Id<"challenges">,
    userId: userId as Id<"users">,
  });

  if (!miniGameHistory || miniGameHistory.length === 0) {
    return null;
  }

  const activeById = new Map(
    ((activeMiniGames ?? []) as ActiveMiniGameStatus[]).map((status) => [
      status.miniGame.id,
      status,
    ]),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-zinc-400" />
        <h3 className="text-lg font-semibold">Mini-Games</h3>
      </div>
      <div className="space-y-3">
        {(miniGameHistory as MiniGameHistoryItem[]).map((item) => {
          const { miniGame } = item;
          const activeStatus = activeById.get(miniGame.id);

          return (
            <ProfileMiniGameCard
              key={miniGame.id}
              challengeId={challengeId}
              item={item}
              activeStatus={activeStatus}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProfileMiniGameCard({
  challengeId,
  item,
  activeStatus,
}: {
  challengeId: string;
  item: MiniGameHistoryItem;
  activeStatus?: ActiveMiniGameStatus;
}) {
  const { miniGame, participation } = item;
  const typeInfo = gameTypeInfo[miniGame.type];
  const Icon = typeInfo.icon;
  const isActive = miniGame.status === "active";
  const config = miniGame.config ?? {};
  const metric = getMiniGameMetric(item, activeStatus);
  const dateLabel = `${formatMonthDayFromUtcMs(miniGame.startsAt)} - ${formatDateShortFromUtcMs(miniGame.endsAt)}`;

  return (
    <MiniGameCardShell
      icon={Icon}
      title={miniGame.name}
      meta={dateLabel}
      iconClassName={typeInfo.color}
      headerRight={<MiniGameMetric metric={metric} />}
      className={cn(isActive && "border-zinc-700")}
      footer={getMiniGameFooter(miniGame.type, config)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill isActive={isActive} />
        <span className="text-xs text-zinc-500">{typeInfo.label}</span>
      </div>

      {miniGame.type === "partner_week" ? (
        <PartnerWeekResult
          challengeId={challengeId}
          partner={participation.partnerUser}
          initialState={participation.initialState}
          outcome={participation.outcome}
          activeStatus={activeStatus}
        />
      ) : null}

      {miniGame.type === "hunt_week" ? (
        <HuntWeekResult
          challengeId={challengeId}
          prey={participation.preyUser}
          hunter={participation.hunterUser}
          outcome={participation.outcome}
          activeStatus={activeStatus}
        />
      ) : null}

      {miniGame.type === "pr_week" ? (
        <PrWeekResult
          initialState={participation.initialState}
          outcome={participation.outcome}
          activeStatus={activeStatus}
          prBonus={getNumberConfig(config, "prBonus", 100)}
        />
      ) : null}
    </MiniGameCardShell>
  );
}

function PartnerWeekResult({
  challengeId,
  partner,
  initialState,
  outcome,
  activeStatus,
}: {
  challengeId: string;
  partner: ParticipantUser | null;
  initialState: Record<string, unknown> | null;
  outcome: Record<string, unknown> | null;
  activeStatus?: ActiveMiniGameStatus;
}) {
  if (!partner) {
    return <p className="text-sm text-zinc-500">No partner assigned.</p>;
  }

  const partnerRank = getNumberValue(
    activeStatus?.participation.initialState ?? initialState,
    "rank",
  );
  const activePartnerPoints = activeStatus?.liveData.partnerPeriodPoints;
  const completedPartnerPoints = getNumberValue(outcome, "partnerWeekPoints");
  const detail = typeof activePartnerPoints === "number"
    ? `#${partnerRank ?? "?"} · ${formatPointsCompact(activePartnerPoints)} pts so far`
    : typeof completedPartnerPoints === "number"
      ? `Partner logged ${formatPointsCompact(completedPartnerPoints)} pts that week`
      : "Partner pairing locked in.";

  return (
    <UserAvatar
      user={partner}
      challengeId={challengeId}
      size="md"
      showName
      showUsername
    >
      <p className="text-xs text-zinc-500">{detail}</p>
    </UserAvatar>
  );
}

function HuntWeekResult({
  challengeId,
  prey,
  hunter,
  outcome,
  activeStatus,
}: {
  challengeId: string;
  prey: ParticipantUser | null;
  hunter: ParticipantUser | null;
  outcome: Record<string, unknown> | null;
  activeStatus?: ActiveMiniGameStatus;
}) {
  const hasCaughtPrey =
    activeStatus &&
    activeStatus.liveData.userCurrentPoints !== null &&
    activeStatus.liveData.preyCurrentPoints !== null
      ? activeStatus.liveData.userCurrentPoints > activeStatus.liveData.preyCurrentPoints
      : getBooleanValue(outcome, "caughtPrey");
  const hasBeenCaught =
    activeStatus &&
    activeStatus.liveData.userCurrentPoints !== null &&
    activeStatus.liveData.hunterCurrentPoints !== null
      ? activeStatus.liveData.hunterCurrentPoints > activeStatus.liveData.userCurrentPoints
      : getBooleanValue(outcome, "wasCaught");

  const preyGap =
    activeStatus &&
    activeStatus.liveData.userCurrentPoints !== null &&
    activeStatus.liveData.preyCurrentPoints !== null
      ? activeStatus.liveData.preyCurrentPoints - activeStatus.liveData.userCurrentPoints
      : null;
  const hunterGap =
    activeStatus &&
    activeStatus.liveData.userCurrentPoints !== null &&
    activeStatus.liveData.hunterCurrentPoints !== null
      ? activeStatus.liveData.userCurrentPoints - activeStatus.liveData.hunterCurrentPoints
      : null;

  return (
    <div className="space-y-3">
      <HuntPlayerRow
        label="Prey"
        emptyLabel="No prey assigned"
        challengeId={challengeId}
        user={prey}
        status={
          activeStatus
            ? preyGap === null
              ? "Tracking live"
              : hasCaughtPrey
                ? "Caught"
                : preyGap > 0
                  ? `${preyGap.toFixed(0)} pts ahead`
                  : `${Math.abs(preyGap).toFixed(0)} pts behind`
            : hasCaughtPrey
              ? "Caught"
              : "Escaped"
        }
        tone={
          activeStatus
            ? hasCaughtPrey
              ? "text-emerald-400"
              : preyGap !== null && preyGap > 0
                ? "text-red-400"
                : "text-zinc-500"
            : hasCaughtPrey
              ? "text-emerald-400"
              : "text-zinc-500"
        }
        icon={hasCaughtPrey ? Check : activeStatus ? Minus : X}
      />

      <HuntPlayerRow
        label="Hunter"
        emptyLabel="No hunter assigned"
        challengeId={challengeId}
        user={hunter}
        status={
          activeStatus
            ? hunterGap === null
              ? "Tracking live"
              : hasBeenCaught
                ? "Caught you"
                : hunterGap > 0
                  ? `${hunterGap.toFixed(0)} pts behind`
                  : `${Math.abs(hunterGap).toFixed(0)} pts ahead`
            : hasBeenCaught
              ? "Caught you"
              : "Evaded"
        }
        tone={
          activeStatus
            ? hasBeenCaught
              ? "text-red-400"
              : hunterGap !== null && hunterGap > 0
                ? "text-emerald-400"
                : "text-zinc-500"
            : hasBeenCaught
              ? "text-red-400"
              : "text-emerald-400"
        }
        icon={hasBeenCaught ? X : activeStatus ? Minus : Check}
      />
    </div>
  );
}

function HuntPlayerRow({
  label,
  emptyLabel,
  challengeId,
  user,
  status,
  tone,
  icon: Icon,
}: {
  label: string;
  emptyLabel: string;
  challengeId: string;
  user: ParticipantUser | null;
  status: string;
  tone: string;
  icon: typeof Check;
}) {
  if (!user) {
    return (
      <div className="border-t border-zinc-800 pt-3 first:border-t-0 first:pt-0">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          {label}
        </p>
        <p className="mt-1 text-sm text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-800 pt-3 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          {label}
        </p>
        <span className={cn("flex items-center gap-1 text-xs", tone)}>
          <Icon className="h-3 w-3" />
          {status}
        </span>
      </div>
      <UserAvatar
        user={user}
        challengeId={challengeId}
        size="sm"
        showName
        showUsername
      />
    </div>
  );
}

function PrWeekResult({
  initialState,
  outcome,
  activeStatus,
  prBonus,
}: {
  initialState: Record<string, unknown> | null;
  outcome: Record<string, unknown> | null;
  activeStatus?: ActiveMiniGameStatus;
  prBonus: number;
}) {
  const startingPr =
    getNumberValue(activeStatus?.participation.initialState ?? initialState, "dailyPr") ?? 0;
  const weekMax =
    activeStatus?.liveData.currentWeekMax ??
    getNumberValue(outcome, "weekMaxPoints") ??
    0;
  const hitPr =
    activeStatus?.liveData.currentWeekMax !== undefined
      ? activeStatus.liveData.currentWeekMax > startingPr
      : getBooleanValue(outcome, "hitPr");
  const progress =
    hitPr ? 100 : startingPr > 0 ? Math.min((weekMax / startingPr) * 100, 100) : 0;
  const pointsToGo = Math.max(0, startingPr - weekMax + 1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <PrStat label="PR to beat" value={startingPr} valueClassName="text-amber-400" />
        <PrStat
          label={activeStatus ? "Best this week" : "Best day"}
          value={weekMax}
          valueClassName={cn(hitPr ? "text-emerald-400" : "text-zinc-200")}
        />
      </div>

      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              hitPr ? "bg-emerald-500" : progress >= 75 ? "bg-amber-500" : "bg-zinc-600",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className={cn(hitPr ? "text-emerald-400" : "text-zinc-500")}>
            {hitPr ? (
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                New PR locked in
              </span>
            ) : (
              `${pointsToGo} pts to go`
            )}
          </span>
          <span className="text-zinc-500">{progress.toFixed(0)}%</span>
        </div>
      </div>

      {!activeStatus ? (
        <p className="text-xs text-zinc-500">
          {hitPr
            ? `You cleared the line for +${prBonus} bonus points.`
            : "This week stopped short of a new best day."}
        </p>
      ) : null}
    </div>
  );
}

function MiniGameMetric({
  metric,
}: {
  metric:
    | { kind: "points"; value: number; label: string }
    | { kind: "status"; label: string };
}) {
  if (metric.kind === "status") {
    return (
      <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">
        {metric.label}
      </span>
    );
  }

  return (
    <div className="text-right">
      <div
        className={cn(
          "font-mono text-xl font-bold",
          metric.value > 0
            ? "text-emerald-400"
            : metric.value < 0
              ? "text-red-400"
              : "text-zinc-500",
        )}
      >
        {formatSignedPoints(metric.value)}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-600">
        {metric.label}
      </div>
    </div>
  );
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest",
        isActive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-zinc-800 text-zinc-400",
      )}
    >
      {isActive ? "Active" : "Completed"}
    </span>
  );
}

function PrStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-bold", valueClassName)}>
        {formatPointsCompact(value)}
      </p>
      <p className="text-xs text-zinc-600">pts</p>
    </div>
  );
}

function getMiniGameMetric(
  item: MiniGameHistoryItem,
  activeStatus?: ActiveMiniGameStatus,
):
  | { kind: "points"; value: number; label: string }
  | { kind: "status"; label: string } {
  const { miniGame, participation } = item;
  const config = miniGame.config ?? {};

  if (miniGame.status === "active" && activeStatus) {
    if (miniGame.type === "partner_week") {
      return {
        kind: "points",
        value: Math.round(
          activeStatus.liveData.partnerPeriodPoints *
            (getNumberConfig(config, "bonusPercentage", 10) / 100),
        ),
        label: "preview",
      };
    }

    if (miniGame.type === "hunt_week") {
      const catchBonus = getNumberConfig(config, "catchBonus", 75);
      const caughtPenalty = getNumberConfig(config, "caughtPenalty", 25);
      const hasCaughtPrey =
        activeStatus.liveData.userCurrentPoints !== null &&
        activeStatus.liveData.preyCurrentPoints !== null &&
        activeStatus.liveData.userCurrentPoints > activeStatus.liveData.preyCurrentPoints;
      const hasBeenCaught =
        activeStatus.liveData.userCurrentPoints !== null &&
        activeStatus.liveData.hunterCurrentPoints !== null &&
        activeStatus.liveData.hunterCurrentPoints > activeStatus.liveData.userCurrentPoints;

      return {
        kind: "points",
        value: (hasCaughtPrey ? catchBonus : 0) - (hasBeenCaught ? caughtPenalty : 0),
        label: "preview",
      };
    }

    if (miniGame.type === "pr_week") {
      const initialPr =
        getNumberValue(activeStatus.participation.initialState, "dailyPr") ?? 0;
      return {
        kind: "points",
        value:
          activeStatus.liveData.currentWeekMax > initialPr
            ? getNumberConfig(config, "prBonus", 100)
            : 0,
        label: "preview",
      };
    }
  }

  if (typeof participation.bonusPoints === "number") {
    return { kind: "points", value: participation.bonusPoints, label: "result" };
  }

  return { kind: "status", label: miniGame.status === "active" ? "Live" : "Done" };
}

function getMiniGameFooter(type: MiniGameType, config: Record<string, unknown>) {
  if (type === "partner_week") {
    return `Earn ${getNumberConfig(config, "bonusPercentage", 10)}% of your partner's points during the week.`;
  }

  if (type === "hunt_week") {
    return `Catch prey +${getNumberConfig(config, "catchBonus", 75)}. Get caught -${getNumberConfig(config, "caughtPenalty", 25)}.`;
  }

  return `Beat your best day to earn +${getNumberConfig(config, "prBonus", 100)}.`;
}

function getNumberConfig(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  return typeof config[key] === "number" ? (config[key] as number) : fallback;
}

function getNumberValue(obj: Record<string, unknown> | null | undefined, key: string) {
  return typeof obj?.[key] === "number" ? (obj[key] as number) : null;
}

function getBooleanValue(obj: Record<string, unknown> | null | undefined, key: string) {
  return obj?.[key] === true;
}

function formatSignedPoints(value: number) {
  if (value > 0) {
    return `+${formatPointsCompact(value)}`;
  }

  if (value < 0) {
    return `-${formatPointsCompact(Math.abs(value))}`;
  }

  return "0";
}
