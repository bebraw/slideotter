import type { StudioClientState } from "../core/state.ts";
import { isJsonRecord } from "./dom-preview-record.ts";

type JsonRecord = StudioClientState.JsonRecord;

function domPreviewFallbackTheme(state: StudioClientState.State): unknown {
  return state.context && state.context.deck ? state.context.deck.visualTheme : null;
}

function isDomPreviewSlide(value: unknown): value is StudioClientState.StudioSlide {
  return isJsonRecord(value)
    && typeof value.id === "string"
    && typeof value.index === "number";
}

export function setFromPayload(state: StudioClientState.State, payload: JsonRecord): void {
  const domPreview = isJsonRecord(payload.domPreview)
    ? payload.domPreview
    : {};
  state.domPreview = {
    slides: Array.isArray(domPreview.slides)
      ? domPreview.slides.filter(isDomPreviewSlide)
      : [],
    theme: domPreview.theme || domPreviewFallbackTheme(state)
  };
}

function slideEntryIndex(currentSlide: StudioClientState.StudioSlide | undefined, slideSpec: JsonRecord): number {
  return currentSlide ? currentSlide.index : Number(slideSpec.index || 1);
}

function slideEntryTitle(currentSlide: StudioClientState.StudioSlide | undefined, slideSpec: JsonRecord): string {
  const currentTitle = currentSlide ? currentSlide.title : "";
  return String(slideSpec.title || currentTitle);
}

function buildPatchedSlideEntry(state: StudioClientState.State, slideId: string, slideSpec: JsonRecord): StudioClientState.StudioSlide {
  const currentSlide = state.slides.find((entry) => entry.id === slideId);
  return {
    id: slideId,
    index: slideEntryIndex(currentSlide, slideSpec),
    slideSpec,
    title: slideEntryTitle(currentSlide, slideSpec)
  };
}

function applyPatchedSlide(nextSlides: StudioClientState.StudioSlide[], existingIndex: number, nextEntry: StudioClientState.StudioSlide): void {
  if (existingIndex >= 0) {
    nextSlides[existingIndex] = {
      ...nextSlides[existingIndex],
      ...nextEntry
    };
    return;
  }

  nextSlides.push(nextEntry);
}

export function patchSlideSpec(state: StudioClientState.State, slideId: string, slideSpec: JsonRecord | null): void {
  if (!slideId || !slideSpec) {
    return;
  }

  const nextSlides = Array.isArray(state.domPreview.slides) ? state.domPreview.slides.slice() : [];
  const existingIndex = nextSlides.findIndex((entry) => entry && entry.id === slideId);
  applyPatchedSlide(nextSlides, existingIndex, buildPatchedSlideEntry(state, slideId, slideSpec));

  state.domPreview = {
    ...state.domPreview,
    slides: nextSlides
  };
}

export function getSlideSpec(state: StudioClientState.State, slideId: string): JsonRecord | null {
  const match = Array.isArray(state.domPreview.slides)
    ? state.domPreview.slides.find((entry) => entry && entry.id === slideId)
    : null;
  return match && match.slideSpec ? match.slideSpec : null;
}
