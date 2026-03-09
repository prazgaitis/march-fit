export function formatPoints(value: number, decimals: 0 | 1 | 2 = 2): string {
  return value.toFixed(decimals);
}

/** Compact display for large point totals, e.g. 70627 → "70.6k" */
export function formatPointsCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}
