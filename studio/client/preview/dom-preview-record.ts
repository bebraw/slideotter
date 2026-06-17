import type { StudioClientState } from "../core/state.ts";

type JsonRecord = StudioClientState.JsonRecord;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
