import { StudioClientContextPayloadState } from "../api/context-payload-state.ts";
import { StudioClientCore } from "../core/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientDeckContextForm } from "./deck-context-form.ts";

export namespace StudioClientDeckContextActions {
  type JsonRecord = StudioClientState.JsonRecord;
  type ContextPayload = JsonRecord & StudioClientContextPayloadState.ContextPayload;

  export type DeckContextActionsOptions = {
    buildDeck: () => Promise<unknown>;
    elements: StudioClientElements.Elements;
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    renderManualDeckEditOptions: () => void;
    renderPreviews: () => void;
    renderVariants: () => void;
    request: <T>(url: string, options?: StudioClientCore.JsonRequestOptions) => Promise<T>;
    setBusy: (button: HTMLElement & { disabled: boolean }, label: string) => () => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type DeckContextActions = {
    renderDeckFields: () => void;
    saveDeckContext: () => Promise<void>;
  };

  export function createDeckContextActions({
    buildDeck,
    elements,
    renderDeckLengthPlan,
    renderDeckStructureCandidates,
    renderManualDeckEditOptions,
    renderPreviews,
    renderVariants,
    request,
    setBusy,
    state,
    windowRef
  }: DeckContextActionsOptions): DeckContextActions {
    function renderDeckFields(): void {
      const deck = state.context.deck || {};
      StudioClientDeckContextForm.apply(windowRef.document, elements, deck);
      renderManualDeckEditOptions();
    }

    return {
      renderDeckFields,
      saveDeckContext: async () => {
        const done = setBusy(elements.saveDeckContextButton, "Saving...");
        try {
          const payload = await request<ContextPayload>("/api/context", {
            body: JSON.stringify({
              deck: StudioClientDeckContextForm.read(windowRef.document, elements)
            }),
            method: "POST"
          });

          StudioClientContextPayloadState.applyContextPayload(state, payload, { resetDeckStructure: true });
          renderDeckFields();
          renderDeckLengthPlan();
          renderDeckStructureCandidates();
          renderPreviews();
          renderVariants();
          await buildDeck();
          elements.operationStatus.textContent = "Saved deck context and rebuilt the live deck.";
        } finally {
          done();
        }
      }
    };
  }
}
