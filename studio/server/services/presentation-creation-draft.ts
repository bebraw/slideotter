import {
  normalizeCreationDraft,
  type JsonObject
} from "./presentation-state.ts";
import {
  ensurePresentationRuntime,
  readPresentationRuntimeState,
  writePresentationRuntimeState
} from "./presentation-runtime-store.ts";

function getPresentationCreationDraft(): JsonObject {
  const registry = ensurePresentationRuntime();
  return readPresentationRuntimeState(registry).creationDraft;
}

function savePresentationCreationDraft(draft: JsonObject): JsonObject {
  const registry = ensurePresentationRuntime();
  const nextDraft = normalizeCreationDraft({
    ...draft,
    updatedAt: new Date().toISOString()
  });
  writePresentationRuntimeState({
    creationDraft: nextDraft
  }, registry);
  return nextDraft;
}

function clearPresentationCreationDraft(): JsonObject {
  return savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan: null,
    fields: {},
    outlineLocks: {},
    retrieval: null,
    stage: "brief"
  });
}

export {
  clearPresentationCreationDraft,
  getPresentationCreationDraft,
  savePresentationCreationDraft
};
