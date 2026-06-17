import type { StudioClientState } from "../core/state.ts";

type JsonRecord = StudioClientState.JsonRecord;
type VariantRecord = StudioClientState.VariantRecord;

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function toVariant(value: VariantRecord | JsonRecord): VariantRecord {
  return { ...value };
}

export function toVariants(values: unknown): VariantRecord[] {
  return Array.isArray(values) ? values.filter(isRecord).map(toVariant) : [];
}
