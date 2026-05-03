import { StudioClientState } from "../state.ts";

export namespace StudioClientVariantState {
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

  export function getSlideVariants(state: StudioClientState.State): VariantRecord[] {
    return [
      ...state.transientVariants,
      ...state.variants
    ].filter((variant: VariantRecord) => variant && variant.slideId === state.selectedSlideId);
  }

  export function getSelectedVariant(state: StudioClientState.State): VariantRecord | null {
    const variants = getSlideVariants(state);
    if (!variants.length) {
      state.selectedVariantId = null;
      return null;
    }

    if (!variants.some((variant: VariantRecord) => variant.id === state.selectedVariantId)) {
      state.selectedVariantId = null;
    }

    return variants.find((variant: VariantRecord) => variant.id === state.selectedVariantId) || null;
  }

  export function clearTransientVariants(state: StudioClientState.State, slideId: string): void {
    state.transientVariants = state.transientVariants.filter((variant: VariantRecord) => variant.slideId !== slideId);
  }

  export function replacePersistedVariantsForSlide(
    state: StudioClientState.State,
    slideId: string,
    variants: unknown
  ): void {
    state.variants = [
      ...state.variants.filter((variant: VariantRecord) => variant.slideId !== slideId),
      ...toVariants(variants)
    ];
  }
}
