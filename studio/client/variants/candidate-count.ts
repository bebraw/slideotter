export namespace StudioClientCandidateCount {
  export function readNormalized(input: { value: string }, fallback = 5, min = 1, max = 8): number {
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed)) {
      input.value = String(fallback);
      return fallback;
    }

    const normalized = Math.min(max, Math.max(min, parsed));
    input.value = String(normalized);
    return normalized;
  }
}
