export function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toFiniteNumberOr(value: unknown, fallback: number): number {
  return toFiniteNumber(value) ?? fallback;
}
