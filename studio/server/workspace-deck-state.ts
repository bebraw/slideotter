import { getPreviewManifest } from "./services/preview-manifest.ts";
import { getDomPreviewState } from "./services/dom-preview-state.ts";
import {
  getActiveOutlinePlanId,
  listOutlinePlans
} from "./services/presentation-outline-plans.ts";
import { getPresentationCreationDraft } from "./services/presentation-creation-draft.ts";
import { listPresentations } from "./services/presentation-lifecycle.ts";
import { listSavedThemes } from "./services/presentation-theme-store.ts";
import { getDeckContext } from "./services/deck-context-store.ts";
import { getSlides } from "./services/slide-queries.ts";
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
