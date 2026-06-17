import type { GeneratedSlideSpec, JsonObject } from "./generated-slide-types.ts";
import { assertGeneratedSlideQuality } from "./generated-slide-quality-assertions.ts";
import {
  repairGeneratedSlideSpec,
  repairNearbyDuplicateItems
} from "./generated-slide-quality-repair.ts";

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
  repairNearbyDuplicateItems?: boolean | undefined;
};

export function finalizeGeneratedSlideSpecs(slideSpecs: GeneratedSlideSpec[], options: ProgressOptions = {}): GeneratedSlideSpec[] {
  const repairedSlideSpecs = (options.repairNearbyDuplicateItems
    ? repairNearbyDuplicateItems(slideSpecs)
    : slideSpecs
  ).map(repairGeneratedSlideSpec);
  if (typeof options.onProgress === "function") {
    const repairedFields = repairedSlideSpecs.reduce((count, slideSpec, index) => {
      return count + (JSON.stringify(slideSpec) === JSON.stringify(slideSpecs[index]) ? 0 : 1);
    }, 0);

    if (repairedFields > 0) {
      options.onProgress({
        message: `Repaired generated text on ${repairedFields} slide${repairedFields === 1 ? "" : "s"} before validation.`,
        stage: "quality-repair"
      });
    }
  }

  return assertGeneratedSlideQuality(repairedSlideSpecs);
}
