export function formatPoints(value: number, decimals: 0 | 1 | 2 = 0): string {
  return value.toFixed(decimals);
}
