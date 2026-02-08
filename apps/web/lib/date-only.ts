export function parseDateOnlyToUtcMs(dateString: string): number {
  if (!dateString) return NaN;
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day);
}

export function formatDateOnlyFromUtcMs(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return "";
  const date = new Date(timestampMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLongFromUtcMs(timestampMs: number, locale = "en-US"): string {
  if (!Number.isFinite(timestampMs)) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestampMs));
}
