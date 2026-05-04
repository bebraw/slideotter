import { StudioClientContextPayloadState } from "../api/context-payload-state.ts";
import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientRuntimePayloadState } from "./runtime-payload-state.ts";
import { StudioClientValidationSettingsForm } from "./validation-settings-form.ts";

export namespace StudioClientBuildValidationWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;
  type ContextPayload = JsonRecord & StudioClientContextPayloadState.ContextPayload;

  export type BuildPayload = JsonRecord & {
    pdf?: {
      path?: string;
      url?: string;
    };
    previews: StudioClientState.State["previews"];
    runtime: StudioClientState.State["runtime"];
  };

  export type ValidationPayload = BuildPayload & StudioClientRuntimePayloadState.ValidationPayload;

  export type BuildValidationWorkbenchOptions = {
    documentRef: Document;
    elements: StudioClientElements.Elements;
    renderDeckFields: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderValidation: () => void;
    renderVariantComparison: () => void;
    request: <T>(url: string, options?: StudioClientCore.JsonRequestOptions) => Promise<T>;
    setBusy: (button: HTMLElement & { disabled: boolean }, label: string) => () => void;
    state: StudioClientState.State;
  };

  export type BuildValidationWorkbench = {
    buildDeck: () => Promise<BuildPayload>;
    saveValidationSettings: () => Promise<void>;
    validate: (includeRender: boolean) => Promise<void>;
  };

  export function createBuildValidationWorkbench({
    documentRef,
    elements,
    renderDeckFields,
    renderPreviews,
    renderStatus,
    renderValidation,
    renderVariantComparison,
    request,
    setBusy,
    state
  }: BuildValidationWorkbenchOptions): BuildValidationWorkbench {
    async function buildDeck(): Promise<BuildPayload> {
      const payload = await request<BuildPayload>("/api/v1/build", {
        body: JSON.stringify({}),
        method: "POST"
      });
      StudioClientRuntimePayloadState.applyBuildPayload(state, payload);
      renderStatus();
      renderPreviews();
      renderVariantComparison();
      return payload;
    }

    return {
      buildDeck,
      saveValidationSettings: async () => {
        const done = setBusy(elements.saveValidationSettingsButton, "Saving...");
        try {
          const payload = await request<ContextPayload>("/api/v1/context", {
            body: JSON.stringify({
              deck: {
                validationSettings: StudioClientValidationSettingsForm.read(documentRef, elements)
              }
            }),
            method: "POST"
          });

          StudioClientContextPayloadState.applyContextPayload(state, payload);
          renderDeckFields();
          await buildDeck();
          elements.operationStatus.textContent = "Saved check settings and rebuilt the live deck.";
        } finally {
          done();
        }
      },
      validate: async (includeRender: boolean) => {
        const button = includeRender ? elements.validateRenderButton : elements.validateButton;
        const done = setBusy(button, includeRender ? "Running render gate..." : "Validating...");
        try {
          const payload = await request<ValidationPayload>("/api/v1/validate", {
            body: JSON.stringify({ includeRender }),
            method: "POST"
          });
          StudioClientRuntimePayloadState.applyValidationPayload(state, payload);
          renderStatus();
          renderPreviews();
          renderVariantComparison();
          renderValidation();
        } finally {
          done();
        }
      }
    };
  }
}
