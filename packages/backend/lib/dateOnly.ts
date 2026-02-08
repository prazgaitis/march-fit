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

export function coerceDateOnlyToString(value: string | number): string {
  if (typeof value === "string") return value;
  return formatDateOnlyFromUtcMs(value);
}

export function dateOnlyToUtcMs(value: string | number): number {
  if (typeof value === "number") return value;
  return parseDateOnlyToUtcMs(value);
}
