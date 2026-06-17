import type { StudioClientState } from "../core/state.ts";
import {
  isRecord as isRecordValue,
  toVariant as normalizeVariant,
  toVariants as normalizeVariants
} from "./variant-normalization.ts";
import {
  clearTransientVariants as clearTransientVariantsForSlide,
  getSelectedVariant as getSelectedVariantForState,
  getSlideVariants as getSlideVariantsForState,
  replacePersistedVariantsForSlide as replacePersistedVariantsForState
} from "./variant-selection.ts";

export namespace StudioClientVariantState {
  type JsonRecord = StudioClientState.JsonRecord;
  type VariantRecord = StudioClientState.VariantRecord;

  export function isRecord(value: unknown): value is JsonRecord {
    return isRecordValue(value);
  }

  export function toVariant(value: VariantRecord | JsonRecord): VariantRecord {
    return normalizeVariant(value);
  }

  export function toVariants(values: unknown): VariantRecord[] {
    return normalizeVariants(values);
  }

  export function getSlideVariants(state: StudioClientState.State): VariantRecord[] {
    return getSlideVariantsForState(state);
  }

  export function getSelectedVariant(state: StudioClientState.State): VariantRecord | null {
    return getSelectedVariantForState(state);
  }

  export function clearTransientVariants(state: StudioClientState.State, slideId: string): void {
    clearTransientVariantsForSlide(state, slideId);
  }

  export function replacePersistedVariantsForSlide(
    state: StudioClientState.State,
    slideId: string,
    variants: unknown
  ): void {
    replacePersistedVariantsForState(state, slideId, variants);
  }
}
