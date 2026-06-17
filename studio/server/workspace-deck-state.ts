import { getPreviewManifest } from "./services/preview-manifest.ts";
import { getDomPreviewState } from "./services/dom-preview-state.ts";
import {
  getActiveOutlinePlanId,
  getPresentationCreationDraft,
  listOutlinePlans,
  listPresentations,
  listSavedThemes
} from "./services/presentations.ts";
import { getDeckContext } from "./services/state.ts";
import { getSlides } from "./services/slides.ts";
import { serializeRuntimeState } from "./runtime-state.ts";

type JsonObject = Record<string, unknown>;

type SlideSummary = JsonObject & {
  archived?: unknown;
  skipped?: unknown;
};

function getStudioDomPreviewState(): JsonObject {
  return getDomPreviewState({ includeDetours: true });
}

function getWorkspaceDeckState(): JsonObject {
  return {
    activeOutlinePlanId: getActiveOutlinePlanId(),
    context: getDeckContext(),
    creationDraft: getPresentationCreationDraft(),
    domPreview: getStudioDomPreviewState(),
    outlinePlans: listOutlinePlans(),
    presentations: listPresentations(),
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    savedThemes: listSavedThemes(),
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide: SlideSummary) => slide.skipped && !slide.archived),
    slides: getSlides()
  };
}

export { getWorkspaceDeckState };
