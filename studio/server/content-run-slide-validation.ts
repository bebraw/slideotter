import { validateSlideSpecInDom } from "./services/dom-validate.ts";
import type { JsonObject } from "./creation-content-run-types.ts";

function summarizeValidationErrors(errors: unknown[]): string {
  return errors
    .map((error) => {
      if (!error || typeof error !== "object" || Array.isArray(error)) {
        return "";
      }
      const record = error as Record<string, unknown>;
      return [record.rule, record.message].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("; ");
}

export async function assertGeneratedSlideFitsDom(slideIndex: number, slideSpec: JsonObject): Promise<void> {
  const validation = await validateSlideSpecInDom({
    index: slideIndex,
    slideSpec,
    title: String(slideSpec.title || `Slide ${slideIndex}`)
  });

  if (!validation.ok) {
    const details = summarizeValidationErrors(validation.errors);
    throw new Error(details ? `Generated slide failed DOM validation: ${details}` : "Generated slide failed DOM validation.");
  }
}
