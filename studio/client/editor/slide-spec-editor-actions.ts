import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import type { SlideSpecPayload } from "./slide-editor-payload.ts";

type JsonRecord = StudioClientState.JsonRecord;
type SlideSpec = JsonRecord;
type BusyElement = HTMLElement & {
  disabled: boolean;
};
type Request = <TResponse = SlideSpecPayload>(url: string, options?: RequestInit) => Promise<TResponse>;

type SlideSpecEditorDependencies = {
  applySlideSpecPayload: (payload: unknown, fallbackSpec: unknown) => void;
  elements: StudioClientElements.Elements;
  errorMessage: (error: unknown) => string;
  formatSourceCodeNodes: (source: unknown, format?: string) => Array<HTMLElement | string>;
  patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => void;
  renderPreviews: () => void;
  renderSlideFields: () => void;
  renderStatus: () => void;
  renderVariantComparison: () => void;
  request: Request;
  setBusy: (button: BusyElement, label: string) => () => void;
  state: StudioClientState.State;
  windowRef: Window;
};

export function createSlideSpecEditorActions(deps: SlideSpecEditorDependencies) {
  let previewFrame: number | null = null;

  function updateSlideSpecHighlight(): void {
    const highlightCode = deps.elements.slideSpecHighlight ? deps.elements.slideSpecHighlight.querySelector("code") : null;
    if (!highlightCode) {
      return;
    }

    highlightCode.replaceChildren(...deps.formatSourceCodeNodes(deps.elements.slideSpecEditor.value, "json"));
    deps.elements.slideSpecHighlight.scrollTop = deps.elements.slideSpecEditor.scrollTop;
    deps.elements.slideSpecHighlight.scrollLeft = deps.elements.slideSpecEditor.scrollLeft;
  }

  function parseSlideSpecEditor(): SlideSpec {
    if (!deps.state.selectedSlideStructured) {
      throw new Error("Structured editing is not available for this slide.");
    }

    try {
      const slideSpec = JSON.parse(deps.elements.slideSpecEditor.value);
      if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
        throw new Error("Slide spec JSON must be an object.");
      }
      return slideSpec;
    } catch (error) {
      throw new Error(`Slide spec JSON is invalid: ${deps.errorMessage(error)}`);
    }
  }

  function previewSlideSpecEditorDraft(): void {
    if (!deps.state.selectedSlideStructured || !deps.state.selectedSlideId) {
      return;
    }

    let slideSpec: SlideSpec;
    try {
      slideSpec = JSON.parse(deps.elements.slideSpecEditor.value);
      if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
        throw new Error("Slide spec JSON must be an object.");
      }
    } catch (error) {
      deps.state.selectedSlideSpecDraftError = deps.errorMessage(error);
      deps.elements.saveSlideSpecButton.disabled = true;
      deps.elements.slideSpecStatus.textContent = `Slide spec JSON is invalid: ${deps.errorMessage(error)}`;
      return;
    }

    deps.state.selectedSlideSpec = slideSpec;
    deps.state.selectedSlideSpecDraftError = null;
    deps.patchDomSlideSpec(deps.state.selectedSlideId, slideSpec);
    deps.elements.saveSlideSpecButton.disabled = false;
    deps.elements.slideSpecStatus.textContent = "Previewing unsaved JSON edits. Save persists without rebuilding.";
    deps.renderPreviews();
    deps.renderVariantComparison();
  }

  function scheduleSlideSpecEditorPreview(): void {
    updateSlideSpecHighlight();

    if (previewFrame !== null && typeof deps.windowRef.cancelAnimationFrame === "function") {
      deps.windowRef.cancelAnimationFrame(previewFrame);
    }

    const preview = (): void => {
      previewFrame = null;
      previewSlideSpecEditorDraft();
    };

    if (typeof deps.windowRef.requestAnimationFrame === "function") {
      previewFrame = deps.windowRef.requestAnimationFrame(preview);
      return;
    }

    preview();
  }

  async function saveSlideSpec(): Promise<void> {
    if (!deps.state.selectedSlideId) {
      return;
    }

    const slideSpec = parseSlideSpecEditor();
    const done = deps.setBusy(deps.elements.saveSlideSpecButton, "Saving...");
    try {
      const payload = await deps.request<SlideSpecPayload>(`/api/slides/${deps.state.selectedSlideId}/slide-spec`, {
        body: JSON.stringify({
          rebuild: false,
          slideSpec
        }),
        method: "POST"
      });
      deps.applySlideSpecPayload(payload, slideSpec);
      deps.renderSlideFields();
      deps.renderPreviews();
      deps.renderVariantComparison();
      deps.renderStatus();
      deps.elements.operationStatus.textContent = "Saved slide spec.";
    } finally {
      done();
    }
  }

  return {
    parseSlideSpecEditor,
    previewSlideSpecEditorDraft,
    saveSlideSpec,
    scheduleSlideSpecEditorPreview,
    updateSlideSpecHighlight
  };
}
