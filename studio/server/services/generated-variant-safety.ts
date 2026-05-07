import { asRecord as asJsonObject } from "../../shared/json-utils.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import { assertVisibleSlideTextQuality } from "./visible-text-quality.ts";

type SlideSpec = Record<string, unknown>;

const unsafeGeneratedVariantTextPatterns: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/iu,
  /do\s+not\s+follow\s+(?:the\s+)?(?:system|developer|schema)/iu,
  /<\s*script\b/iu,
  /```/u
];

export function serializeSlideSpec(slideSpec: unknown): string {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

export function findUnsafeGeneratedVariantText(value: unknown, path = "slideSpec"): string | null {
  if (typeof value === "string") {
    return unsafeGeneratedVariantTextPatterns.some((pattern) => pattern.test(value)) ? path : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findUnsafeGeneratedVariantText(value[index], `${path}[${index}]`);
      if (result) {
        return result;
      }
    }
    return null;
  }
  const record = asJsonObject(value);
  for (const [key, entry] of Object.entries(record)) {
    const result = findUnsafeGeneratedVariantText(entry, `${path}.${key}`);
    if (result) {
      return result;
    }
  }
  return null;
}

export function validateGeneratedVariantSlideSpec(slideSpec: unknown, label = "LLM variant"): SlideSpec {
  const unsafePath = findUnsafeGeneratedVariantText(slideSpec);
  if (unsafePath) {
    throw new Error(`${label} copied instruction-like or executable text into ${unsafePath}`);
  }
  return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec(slideSpec)), label);
}

export function applyCandidateSlideDefaults(candidateSlideSpec: unknown, baseSlideSpec: unknown): SlideSpec {
  const nextSpec = {
    ...asJsonObject(candidateSlideSpec)
  };
  const base = asJsonObject(baseSlideSpec);

  if (
    base.media &&
    !Object.hasOwn(asJsonObject(candidateSlideSpec), "media")
  ) {
    nextSpec.media = {
      ...asJsonObject(base.media)
    };
  }

  if (
    Array.isArray(base.mediaItems) &&
    !Object.hasOwn(asJsonObject(candidateSlideSpec), "mediaItems")
  ) {
    nextSpec.mediaItems = base.mediaItems.map((item: unknown) => ({
      ...asJsonObject(item)
    }));
  }

  if (
    base.layout &&
    !Object.hasOwn(asJsonObject(candidateSlideSpec), "layout")
  ) {
    nextSpec.layout = base.layout;
  }

  if (
    base.logo &&
    !Object.hasOwn(asJsonObject(candidateSlideSpec), "logo")
  ) {
    nextSpec.logo = base.logo;
  }

  return validateGeneratedVariantSlideSpec(nextSpec, "Variant candidate");
}
