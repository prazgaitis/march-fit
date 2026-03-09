/**
 * Canvas-based share card renderer for Instagram stories.
 * Generates 1080x1920 (9:16) images with activity data and optional media.
 */

export type ShareCardVariant = "activity" | "leaderboard" | "streak";

export interface ShareCardData {
  activityTypeName: string;
  pointsEarned: number;
  loggedDate: string;
  metrics?: Record<string, unknown>;
  userName: string;
  challengeName: string;

  // Optional media
  mediaUrl?: string | null;

  // Bonuses
  triggeredBonuses?: { metric: string; bonusPoints: number }[];

  // Leaderboard variant
  rank?: number | null;
  totalParticipants?: number;
  totalPoints?: number;

  // Streak variant
  currentStreak?: number;
}

const W = 1080;
const H = 1920;

const C = {
  bg: "#050505",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.10)",
  white: "#fafafa",
  muted: "#71717a",
  mutedLight: "#a1a1aa",
  indigo: "#818cf8",
  fuchsia: "#d946ef",
  yellow: "#fbbf24",
  orange: "#f97316",
  red: "#ef4444",
  green: "#22c55e",
};

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

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

function gradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c1: string,
  c2: string,
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

function drawBackground(
  ctx: CanvasRenderingContext2D,
  mediaImg: HTMLImageElement | null,
) {
  // Solid dark bg
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  if (mediaImg) {
    // Draw media covering top ~55% with crop-to-fill
    const mediaH = H * 0.55;
    const imgAspect = mediaImg.width / mediaImg.height;
    const slotAspect = W / mediaH;

    let sx = 0,
      sy = 0,
      sw = mediaImg.width,
      sh = mediaImg.height;
    if (imgAspect > slotAspect) {
      // Image wider: crop sides
      sw = mediaImg.height * slotAspect;
      sx = (mediaImg.width - sw) / 2;
    } else {
      // Image taller: crop top/bottom
      sh = mediaImg.width / slotAspect;
      sy = (mediaImg.height - sh) / 2;
    }
    ctx.drawImage(mediaImg, sx, sy, sw, sh, 0, 0, W, mediaH);

    // Gradient fade from image to dark
    const fadeTop = ctx.createLinearGradient(0, 0, 0, 160);
    fadeTop.addColorStop(0, "rgba(5,5,5,0.7)");
    fadeTop.addColorStop(1, "rgba(5,5,5,0)");
    ctx.fillStyle = fadeTop;
    ctx.fillRect(0, 0, W, 160);

    const fadeBot = ctx.createLinearGradient(0, mediaH - 300, 0, mediaH);
    fadeBot.addColorStop(0, "rgba(5,5,5,0)");
    fadeBot.addColorStop(1, "rgba(5,5,5,1)");
    ctx.fillStyle = fadeBot;
    ctx.fillRect(0, mediaH - 300, W, 300);
  } else {
    // No media: abstract gradient background
    const glow = ctx.createRadialGradient(W / 2, 400, 0, W / 2, 400, 600);
    glow.addColorStop(0, "rgba(129,140,248,0.12)");
    glow.addColorStop(0.5, "rgba(217,70,239,0.06)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Diagonal accent line
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = C.indigo;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.35);
    ctx.lineTo(W, H * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, H * 0.37);
    ctx.lineTo(W, H * 0.17);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Content sections
// ---------------------------------------------------------------------------

function drawHeader(
  ctx: CanvasRenderingContext2D,
  challengeName: string,
) {
  ctx.save();
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.mutedLight;
  ctx.textAlign = "center";
  ctx.letterSpacing = "6px";
  ctx.fillText(challengeName.toUpperCase(), W / 2, 80);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = "700 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.muted;
  ctx.textAlign = "center";
  ctx.letterSpacing = "4px";
  ctx.fillText("MARCH.FIT", W / 2, H - 60);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

function drawActivityInfo(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  startY: number,
): number {
  let y = startY;

  // Activity type — big bold
  ctx.font = "900 68px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.white;
  ctx.textAlign = "center";
  y = drawWrappedText(ctx, data.activityTypeName, W / 2, y, W - 140, 82);
  y += 24;

  // User name + date on one line
  ctx.font = "500 34px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.mutedLight;
  ctx.fillText(`${data.userName}  ·  ${data.loggedDate}`, W / 2, y);
  y += 100;

  // Points — hero number with gradient
  const pointsStr =
    (data.pointsEarned >= 0 ? "+" : "") + data.pointsEarned.toFixed(1);
  ctx.font = "900 120px system-ui, -apple-system, sans-serif";
  const pg = gradient(ctx, W / 2 - 200, y - 80, W / 2 + 200, y, C.indigo, C.fuchsia);
  ctx.fillStyle = pg;
  ctx.fillText(pointsStr, W / 2, y);
  y += 30;

  // "POINTS" label
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.muted;
  ctx.letterSpacing = "8px";
  ctx.fillText("POINTS", W / 2, y + 30);
  ctx.letterSpacing = "0px";
  y += 80;

  return y;
}

function drawMetrics(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  startY: number,
): number {
  let y = startY;
  // Filter out internal/bonus-related keys from metrics display
  const HIDDEN_METRIC_KEYS = new Set([
    "selectedBonuses", "triggeredBonuses", "bonuses", "source",
  ]);
  const entries = data.metrics
    ? Object.entries(data.metrics).filter(
        ([k, v]) => v !== undefined && v !== null && v !== "" && !HIDDEN_METRIC_KEYS.has(k),
      )
    : [];

  // Combine metrics and bonuses into one card
  const bonuses = data.triggeredBonuses?.filter((b) => b.bonusPoints > 0) ?? [];

  if (entries.length === 0 && bonuses.length === 0) return y;

  const rowCount = entries.length + (bonuses.length > 0 ? 1 : 0);
  const cardW = W - 140;
  const cardH = 40 + rowCount * 64;
  const cardX = 70;

  roundRect(ctx, cardX, y, cardW, cardH, 20);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let rowY = y + 50;

  for (const [key, value] of entries) {
    const label = key.replace(/_/g, " ").toUpperCase();
    const valStr =
      typeof value === "number" ? value.toLocaleString() : String(value);

    ctx.textAlign = "left";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = C.muted;
    ctx.letterSpacing = "2px";
    ctx.fillText(label, cardX + 36, rowY);
    ctx.letterSpacing = "0px";

    ctx.textAlign = "right";
    ctx.font = "700 32px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = C.white;
    ctx.fillText(valStr, cardX + cardW - 36, rowY);

    rowY += 64;
  }

  // Bonuses row
  if (bonuses.length > 0) {
    const bonusLabels = bonuses.map((b) => {
      const label = b.metric.replace(/_/g, " ");
      // Capitalize first letter
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
    const bonusStr = bonusLabels.join(", ");

    ctx.textAlign = "left";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = C.muted;
    ctx.letterSpacing = "2px";
    ctx.fillText("BONUSES", cardX + 36, rowY);
    ctx.letterSpacing = "0px";

    ctx.textAlign = "right";
    ctx.font = "700 32px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = C.green;
    ctx.fillText(bonusStr, cardX + cardW - 36, rowY);
  }

  ctx.textAlign = "center";
  y += cardH + 32;
  return y;
}

function drawRankCard(
  ctx: CanvasRenderingContext2D,
  rank: number,
  totalParticipants: number,
  totalPoints: number,
  startY: number,
): number {
  let y = startY;
  const cardW = W - 140;
  const cardH = 240;
  const cardX = 70;

  // Card with gradient border
  roundRect(ctx, cardX, y, cardW, cardH, 24);
  const bg = gradient(ctx, cardX, y, cardX + cardW, y + cardH,
    "rgba(129,140,248,0.12)", "rgba(217,70,239,0.08)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(129,140,248,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rank number
  const rankY = y + 90;
  ctx.font = "900 80px system-ui, -apple-system, sans-serif";
  const rg = gradient(ctx, W / 2 - 80, rankY - 60, W / 2 + 80, rankY,
    C.yellow, C.orange);
  ctx.fillStyle = rg;
  ctx.textAlign = "center";
  ctx.fillText(`#${rank}`, W / 2, rankY);

  // "of N participants"
  ctx.font = "400 30px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.mutedLight;
  ctx.fillText(`of ${totalParticipants} participants`, W / 2, rankY + 48);

  // Total points
  ctx.font = "700 34px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.white;
  ctx.fillText(`${totalPoints.toLocaleString()} total pts`, W / 2, rankY + 100);

  return y + cardH + 32;
}

function drawStreakCard(
  ctx: CanvasRenderingContext2D,
  streak: number,
  startY: number,
): number {
  let y = startY;
  const cardW = W - 140;
  const cardH = 200;
  const cardX = 70;

  roundRect(ctx, cardX, y, cardW, cardH, 24);
  const bg = gradient(ctx, cardX, y, cardX + cardW, y + cardH,
    "rgba(249,115,22,0.12)", "rgba(239,68,68,0.08)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(249,115,22,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const centerY = y + cardH / 2 + 10;

  // Fire emoji
  ctx.font = "80px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("\u{1F525}", W / 2 - 100, centerY);

  // Streak number
  ctx.font = "900 80px system-ui, -apple-system, sans-serif";
  const sg = gradient(ctx, W / 2, centerY - 60, W / 2 + 120, centerY,
    C.orange, C.red);
  ctx.fillStyle = sg;
  ctx.fillText(`${streak}`, W / 2 + 40, centerY);

  // Label
  ctx.font = "700 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = C.muted;
  ctx.letterSpacing = "6px";
  ctx.fillText("DAY STREAK", W / 2, centerY + 50);
  ctx.letterSpacing = "0px";

  return y + cardH + 32;
}

// ---------------------------------------------------------------------------
// Main render (async for image loading)
// ---------------------------------------------------------------------------

export async function renderShareCard(
  data: ShareCardData,
  variant: ShareCardVariant,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Load media image if available
  let mediaImg: HTMLImageElement | null = null;
  if (data.mediaUrl) {
    try {
      mediaImg = await loadImage(data.mediaUrl);
    } catch {
      // Silently fall back to no-media layout
    }
  }

  // Background (with or without media)
  drawBackground(ctx, mediaImg);
  drawHeader(ctx, data.challengeName);
  drawFooter(ctx);

  // Content starts after media area (or from top if no media)
  const contentStart = mediaImg ? H * 0.55 + 20 : 340;

  let y = drawActivityInfo(ctx, data, contentStart);
  y = drawMetrics(ctx, data, y);

  if (variant === "leaderboard" && data.rank != null) {
    drawRankCard(ctx, data.rank, data.totalParticipants ?? 0, data.totalPoints ?? 0, y);
  }

  if (variant === "streak" && data.currentStreak != null) {
    drawStreakCard(ctx, data.currentStreak, y);
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

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

export async function downloadShareCard(
  data: ShareCardData,
  variant: ShareCardVariant,
) {
  const canvas = await renderShareCard(data, variant);
  const blob = await canvasToBlob(canvas);
  const filename = `marchfit-${variant}-${Date.now()}.png`;

  // On mobile: try Web Share API with file (triggers "Save Image" on iOS)
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && navigator.share) {
    const file = new File([blob], filename, { type: "image/png" });
    const shareData: ShareData = { files: [file] };
    if (!navigator.canShare || navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return;
    }
  }

  // Desktop: standard download via anchor
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
