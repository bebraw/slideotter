import { StudioClientContextPayloadState } from "../api/context-payload-state.ts";
import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientDeckContextForm } from "./deck-context-form.ts";

export namespace StudioClientDeckContextWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;
  type ContextPayload = JsonRecord & StudioClientContextPayloadState.ContextPayload;

  export type DeckContextWorkbenchOptions = {
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

  export function createDeckContextWorkbench({
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
  }: DeckContextWorkbenchOptions) {
    function renderDeckFields(): void {
      const deck = state.context.deck || {};
      StudioClientDeckContextForm.apply(windowRef.document, elements, deck);
      renderManualDeckEditOptions();
    }

    async function saveDeckContext(): Promise<void> {
      const done = setBusy(elements.saveDeckContextButton, "Saving...");
      try {
        const payload = await request<ContextPayload>("/api/v1/context", {
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

    return {
      renderDeckFields,
      saveDeckContext
    };
  }
}
