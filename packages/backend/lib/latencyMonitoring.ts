type LatencyReportArgs = {
  operation: string;
  startedAt: number;
  challengeId?: string;
  userId?: string;
};

type ParsedDsn = {
  envelopeUrl: string;
  dsn: string;
};

const DEFAULT_THRESHOLD_MS = 750;
const DEFAULT_SAMPLE_RATE = 0.1;

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const parsed = new URL(dsn);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const projectId = pathParts[pathParts.length - 1];
    const prefixPath = pathParts.slice(0, -1);
    const prefix = prefixPath.length > 0 ? `/${prefixPath.join("/")}` : "";
    const envelopeUrl = `${parsed.protocol}//${parsed.host}${prefix}/api/${projectId}/envelope/`;

    return { envelopeUrl, dsn };
  } catch {
    return null;
  }
}

function getThresholdMs(): number {
  const raw = process.env.BACKEND_LATENCY_THRESHOLD_MS;
  if (!raw) return DEFAULT_THRESHOLD_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD_MS;
}

function getSampleRate(): number {
  const raw = process.env.BACKEND_LATENCY_SENTRY_SAMPLE_RATE;
  if (!raw) return DEFAULT_SAMPLE_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : DEFAULT_SAMPLE_RATE;
}

function isEnabled(): boolean {
  return process.env.BACKEND_LATENCY_SENTRY_ENABLED !== "false";
}

function buildEventId(): string {
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  const ts = Date.now().toString(16).padStart(8, "0");
  return `${ts}${rand}${ts}${rand}`.slice(0, 32);
}

async function sendLatencyEvent(
  parsedDsn: ParsedDsn,
  args: LatencyReportArgs,
  durationMs: number
): Promise<void> {
  const event = {
    event_id: buildEventId(),
    level: "error",
    message: `Backend latency threshold exceeded: ${args.operation}`,
    timestamp: new Date().toISOString(),
    tags: {
      subsystem: "backend-latency",
      operation: args.operation,
    },
    extra: {
      durationMs,
      thresholdMs: getThresholdMs(),
      challengeId: args.challengeId,
      userId: args.userId,
    },
  };

  const header = {
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn: parsedDsn.dsn,
  };

  const envelope = `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;

  await fetch(parsedDsn.envelopeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
    },
    body: envelope,
  });
}

export function reportLatencyIfExceeded(args: LatencyReportArgs): void {
  if (!isEnabled()) return;

  const durationMs = Date.now() - args.startedAt;
  const thresholdMs = getThresholdMs();
  if (durationMs < thresholdMs) return;

  const sampleRate = getSampleRate();
  if (sampleRate <= 0 || Math.random() > sampleRate) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn("[latency-monitoring] SENTRY_DSN not configured");
    return;
  }

  const parsedDsn = parseDsn(dsn);
  if (!parsedDsn) {
    console.warn("[latency-monitoring] Invalid SENTRY_DSN");
    return;
  }

  void sendLatencyEvent(parsedDsn, args, durationMs).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[latency-monitoring] failed to send Sentry event: ${message}`);
  });
}
