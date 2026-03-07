/**
 * Canvas-based share card renderer for Instagram stories.
 * Generates 1080x1920 (9:16) images with activity data.
 */

export type ShareCardVariant = "activity" | "leaderboard" | "streak";

export interface ShareCardData {
  // Activity info
  activityTypeName: string;
  pointsEarned: number;
  loggedDate: string; // formatted date string
  metrics?: Record<string, unknown>;
  userName: string;
  challengeName: string;

  // Leaderboard data (for leaderboard variant)
  rank?: number | null;
  totalParticipants?: number;
  totalPoints?: number;

  // Streak data (for streak variant)
  currentStreak?: number;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// Brand colors
const COLORS = {
  bg: "#0a0a0a",
  card: "#18181b",
  cardBorder: "#27272a",
  white: "#fafafa",
  muted: "#a1a1aa",
  indigo: "#6366f1",
  fuchsia: "#d946ef",
  yellow: "#facc15",
  green: "#22c55e",
  red: "#ef4444",
};

function createGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color1: string,
  color2: string,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Dark background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(CARD_WIDTH, i);
    ctx.stroke();
  }

  // Gradient glow at top
  const glow = ctx.createRadialGradient(
    CARD_WIDTH / 2,
    200,
    0,
    CARD_WIDTH / 2,
    200,
    500,
  );
  glow.addColorStop(0, "rgba(99, 102, 241, 0.15)");
  glow.addColorStop(0.5, "rgba(217, 70, 239, 0.05)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

function drawBranding(ctx: CanvasRenderingContext2D, challengeName: string) {
  // Top: Challenge name
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "center";
  ctx.letterSpacing = "4px";
  ctx.fillText(challengeName.toUpperCase(), CARD_WIDTH / 2, 120);
  ctx.letterSpacing = "0px";

  // Bottom branding
  ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "center";
  ctx.letterSpacing = "2px";
  ctx.fillText("MARCH FIT", CARD_WIDTH / 2, CARD_HEIGHT - 80);
  ctx.letterSpacing = "0px";
}

function drawActivityCore(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  yOffset: number,
): number {
  let y = yOffset;

  // Activity type name — big bold
  ctx.font = "900 72px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = "center";

  // Word wrap for long names
  const words = data.activityTypeName.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > CARD_WIDTH - 160) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  for (const line of lines) {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += 85;
  }
  y += 20;

  // User name
  ctx.font = "500 40px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(data.userName, CARD_WIDTH / 2, y);
  y += 60;

  // Date
  ctx.font = "400 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(data.loggedDate, CARD_WIDTH / 2, y);
  y += 80;

  // Points — hero number
  const pointsStr =
    (data.pointsEarned >= 0 ? "+" : "") + data.pointsEarned.toFixed(1);
  ctx.font = "900 140px system-ui, -apple-system, sans-serif";
  const pointsGradient = createGradient(
    ctx,
    CARD_WIDTH / 2 - 200,
    y - 100,
    CARD_WIDTH / 2 + 200,
    y,
    COLORS.indigo,
    COLORS.fuchsia,
  );
  ctx.fillStyle = pointsGradient;
  ctx.fillText(pointsStr, CARD_WIDTH / 2, y);
  y += 30;

  // "POINTS" label
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.letterSpacing = "8px";
  ctx.fillText("POINTS", CARD_WIDTH / 2, y + 40);
  ctx.letterSpacing = "0px";
  y += 100;

  // Metrics
  if (data.metrics && Object.keys(data.metrics).length > 0) {
    const entries = Object.entries(data.metrics).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    );
    if (entries.length > 0) {
      // Draw metrics card
      const metricsCardW = CARD_WIDTH - 160;
      const metricsCardH = 60 + entries.length * 70;
      const metricsCardX = 80;

      roundRect(ctx, metricsCardX, y, metricsCardW, metricsCardH, 20);
      ctx.fillStyle = COLORS.card;
      ctx.fill();
      ctx.strokeStyle = COLORS.cardBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      let metricY = y + 55;
      for (const [key, value] of entries) {
        const label = key.replace(/_/g, " ").toUpperCase();
        const valStr =
          typeof value === "number" ? value.toLocaleString() : String(value);

        ctx.textAlign = "left";
        ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = COLORS.muted;
        ctx.letterSpacing = "2px";
        ctx.fillText(label, metricsCardX + 40, metricY);
        ctx.letterSpacing = "0px";

        ctx.textAlign = "right";
        ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = COLORS.white;
        ctx.fillText(valStr, metricsCardX + metricsCardW - 40, metricY);

        metricY += 70;
      }
      ctx.textAlign = "center";
      y += metricsCardH + 40;
    }
  }

  return y;
}

function drawRankBadge(
  ctx: CanvasRenderingContext2D,
  rank: number,
  totalParticipants: number,
  totalPoints: number,
  y: number,
): number {
  // Rank card
  const cardW = CARD_WIDTH - 160;
  const cardH = 280;
  const cardX = 80;

  roundRect(ctx, cardX, y, cardW, cardH, 24);
  const cardGradient = createGradient(
    ctx,
    cardX,
    y,
    cardX + cardW,
    y + cardH,
    "rgba(99, 102, 241, 0.15)",
    "rgba(217, 70, 239, 0.1)",
  );
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rank number
  const rankY = y + 100;
  ctx.font = "900 96px system-ui, -apple-system, sans-serif";
  const rankGradient = createGradient(
    ctx,
    CARD_WIDTH / 2 - 100,
    rankY - 80,
    CARD_WIDTH / 2 + 100,
    rankY,
    COLORS.yellow,
    "#f59e0b",
  );
  ctx.fillStyle = rankGradient;
  ctx.textAlign = "center";
  ctx.fillText(`#${rank}`, CARD_WIDTH / 2, rankY);

  // "of N participants"
  ctx.font = "400 32px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    `of ${totalParticipants} participants`,
    CARD_WIDTH / 2,
    rankY + 50,
  );

  // Total points
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.white;
  ctx.fillText(
    `${totalPoints.toLocaleString()} total pts`,
    CARD_WIDTH / 2,
    rankY + 110,
  );

  return y + cardH + 40;
}

function drawStreakBadge(
  ctx: CanvasRenderingContext2D,
  streak: number,
  y: number,
): number {
  const cardW = CARD_WIDTH - 160;
  const cardH = 260;
  const cardX = 80;

  roundRect(ctx, cardX, y, cardW, cardH, 24);
  const cardGradient = createGradient(
    ctx,
    cardX,
    y,
    cardX + cardW,
    y + cardH,
    "rgba(249, 115, 22, 0.15)",
    "rgba(239, 68, 68, 0.1)",
  );
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(249, 115, 22, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Fire emoji + streak number
  const streakY = y + 110;
  ctx.font = "96px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🔥", CARD_WIDTH / 2 - 120, streakY);

  ctx.font = "900 96px system-ui, -apple-system, sans-serif";
  const streakGradient = createGradient(
    ctx,
    CARD_WIDTH / 2 - 40,
    streakY - 80,
    CARD_WIDTH / 2 + 120,
    streakY,
    "#f97316",
    COLORS.red,
  );
  ctx.fillStyle = streakGradient;
  ctx.fillText(`${streak}`, CARD_WIDTH / 2 + 40, streakY);

  // Label
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.letterSpacing = "6px";
  ctx.fillText("DAY STREAK", CARD_WIDTH / 2, streakY + 70);
  ctx.letterSpacing = "0px";

  return y + cardH + 40;
}

/** Render a share card variant to a canvas and return it. */
export function renderShareCard(
  data: ShareCardData,
  variant: ShareCardVariant,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Background
  drawBackground(ctx);
  drawBranding(ctx, data.challengeName);

  // Start y position depends on variant (leaderboard/streak need more room)
  let startY: number;
  switch (variant) {
    case "activity":
      startY = 400;
      break;
    case "leaderboard":
      startY = 320;
      break;
    case "streak":
      startY = 320;
      break;
  }

  let y = drawActivityCore(ctx, data, startY);

  // Variant-specific sections
  if (variant === "leaderboard" && data.rank != null) {
    drawRankBadge(
      ctx,
      data.rank,
      data.totalParticipants ?? 0,
      data.totalPoints ?? 0,
      y,
    );
  }

  if (variant === "streak" && data.currentStreak != null) {
    drawStreakBadge(ctx, data.currentStreak, y);
  }

  return canvas;
}

/** Convert canvas to a downloadable blob. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create image blob"));
      },
      "image/png",
      1.0,
    );
  });
}

/** Download the share card as a PNG file. */
export async function downloadShareCard(
  data: ShareCardData,
  variant: ShareCardVariant,
) {
  const canvas = renderShareCard(data, variant);
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marchfit-${variant}-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Share using Web Share API (mobile) or fallback to download. */
export async function shareCard(
  data: ShareCardData,
  variant: ShareCardVariant,
) {
  const canvas = renderShareCard(data, variant);
  const blob = await canvasToBlob(canvas);

  if (navigator.share && navigator.canShare) {
    const file = new File([blob], `marchfit-${variant}.png`, {
      type: "image/png",
    });
    const shareData = { files: [file] };
    if (navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return;
    }
  }

  // Fallback: download
  await downloadShareCard(data, variant);
}
