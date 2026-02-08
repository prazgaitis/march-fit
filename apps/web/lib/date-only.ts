export function parseDateOnlyToUtcMs(dateString: string): number {
  if (!dateString) return NaN;
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day);
}

export function parseDateOnlyToLocalDate(dateString: string): Date | undefined {
  if (!dateString) return undefined;
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function formatDateOnlyFromUtcMs(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return "";
  const date = new Date(timestampMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateOnlyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateToIsoNoon(date: Date): string {
  const withNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  return withNoon.toISOString();
}

export function dateOnlyToUtcMs(value: string | number): number {
  if (typeof value === "number") return value;
  return parseDateOnlyToUtcMs(value);
}

export function formatDateLongFromDateOnly(dateString: string, locale = "en-US"): string {
  return formatDateLongFromUtcMs(parseDateOnlyToUtcMs(dateString), locale);
}

export function formatDateShortFromDateOnly(dateString: string, locale = "en-US"): string {
  if (!dateString) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parseDateOnlyToUtcMs(dateString)));
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
