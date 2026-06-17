import type {
  ContentRun,
  ContentRunDeckPlan,
  ContentRunDeckPlanSlide,
  ContentRunSlide
} from "./content-run-types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function runSlides(run: ContentRun | null | undefined): ContentRunSlide[] {
  return run && Array.isArray(run.slides) ? run.slides.filter(isRecord) : [];
}

export function planSlides(deckPlan: ContentRunDeckPlan | null | undefined): ContentRunDeckPlanSlide[] {
  return deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isRecord) : [];
}
