import { getAssistantSession, getAssistantSuggestions } from "./services/assistant.ts";
import { getPreviewManifest } from "./services/build.ts";
import { listCustomVisuals } from "./services/custom-visuals.ts";
import { getDomPreviewState } from "./services/dom-preview.ts";
import {
  readFavoriteLayouts,
  readLayouts
} from "./services/layouts.ts";
import { listMaterials } from "./services/materials.ts";
import {
  getPresentationCreationDraft,
  listOutlinePlans,
  listPresentations,
  listSavedThemes
} from "./services/presentations.ts";
import { buildActionDescriptors } from "./services/selection-scope.ts";
import { listSources } from "./services/sources.ts";
import { getDeckContext } from "./services/state.ts";
import { getSlides } from "./services/slides.ts";
import {
  getVariantStorageStatus,
  listAllVariants
} from "./services/variants.ts";
import { serializeRuntimeState } from "./runtime-state.ts";

type JsonObject = Record<string, unknown>;

type SlideSummary = JsonObject & {
  archived?: unknown;
  skipped?: unknown;
};

export function getStudioDomPreviewState(): JsonObject {
  return getDomPreviewState({ includeDetours: true });
}

export function getWorkspaceState(): JsonObject {
  return {
    assistant: {
      actions: buildActionDescriptors(),
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    domPreview: getStudioDomPreviewState(),
    creationDraft: getPresentationCreationDraft(),
    favoriteLayouts: readFavoriteLayouts().layouts,
    layouts: readLayouts().layouts,
    materials: listMaterials(),
    customVisuals: listCustomVisuals(),
    outlinePlans: listOutlinePlans(),
    presentations: listPresentations(),
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide: SlideSummary) => slide.skipped && !slide.archived),
    slides: getSlides(),
    sources: listSources(),
    savedThemes: listSavedThemes(),
    variantStorage: getVariantStorageStatus(),
    variants: listAllVariants()
  };
}

export function createPresentationPayload(extra: JsonObject = {}): JsonObject {
  return {
    ...extra,
    ...getWorkspaceState()
  };
}
