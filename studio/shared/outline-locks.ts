type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeOutlineLocks(value: unknown): Record<string, true> {
  if (!isRecord(value)) {
    return {};
  }

  const locks: Record<string, true> = {};
  Object.entries(value).forEach(([key, lockValue]) => {
    if (/^\d+$/.test(key) && lockValue === true) {
      locks[key] = true;
    }
  });
  return locks;
}
