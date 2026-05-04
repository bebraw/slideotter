import type {
  ContentRunSlide,
  ContentRunState,
  DeckPlanPayload,
  DeckPlanSlide,
  JsonObject,
  MaterialPayload,
  SlideSpecPayload
} from "./creation-content-run-types.ts";

type ContentRunHelpers = {
  deckPlanSlides: (plan: unknown) => DeckPlanSlide[];
  isContentRunSlide: (value: unknown) => value is ContentRunSlide;
  isContentRunState: (value: unknown) => value is ContentRunState;
  isDeckPlanPayload: (value: unknown) => value is DeckPlanPayload;
  isMaterialPayload: (value: unknown) => value is MaterialPayload;
  isSlideSpecPayload: (value: unknown) => value is SlideSpecPayload;
  slugify: (value: unknown, fallback: string) => string;
};

function createContentRunHelpers(isJsonObject: (value: unknown) => value is JsonObject): ContentRunHelpers {
  function isSlideSpecPayload(value: unknown): value is SlideSpecPayload {
    return isJsonObject(value);
  }

  function isMaterialPayload(value: unknown): value is MaterialPayload {
    return isJsonObject(value);
  }

  function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
    return isJsonObject(value);
  }

  function isDeckPlanPayload(value: unknown): value is DeckPlanPayload {
    return isJsonObject(value);
  }

  function deckPlanSlides(plan: unknown): DeckPlanSlide[] {
    return isDeckPlanPayload(plan) && Array.isArray(plan.slides)
      ? plan.slides.filter(isDeckPlanSlide)
      : [];
  }

  function isContentRunSlide(value: unknown): value is ContentRunSlide {
    return isJsonObject(value);
  }

  function isContentRunState(value: unknown): value is ContentRunState {
    return isJsonObject(value);
  }

  function slugify(value: unknown, fallback: string): string {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
    return slug || fallback;
  }

  return {
    deckPlanSlides,
    isContentRunSlide,
    isContentRunState,
    isDeckPlanPayload,
    isMaterialPayload,
    isSlideSpecPayload,
    slugify
  };
}

export { createContentRunHelpers };
export type { ContentRunHelpers };
