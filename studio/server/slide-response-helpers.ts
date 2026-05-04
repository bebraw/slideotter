import { readSlideSpec } from "./services/slides.ts";
import { errorMessage } from "./server-errors.ts";

type JsonObject = Record<string, unknown>;

export function serializeSlideSpec(slideSpec: unknown): string {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

export function describeStructuredSlide(slideId: string): JsonObject {
  try {
    const slideSpec = readSlideSpec(slideId);
    return {
      slideSpec,
      slideSpecError: null,
      structured: true
    };
  } catch (error) {
    return {
      slideSpec: null,
      slideSpecError: errorMessage(error),
      structured: false
    };
  }
}
