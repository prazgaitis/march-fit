export function formatPoints(value: number, decimals: 0 | 1 | 2 = 2): string {
  return value.toFixed(decimals);
}
