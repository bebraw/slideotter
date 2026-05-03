import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import { StudioClientSlideSpecPath } from "./slide-spec-path.ts";

type JsonRecord = StudioClientState.JsonRecord;
type PathSegment = StudioClientSlideSpecPath.PathSegment;
type SlideSpec = JsonRecord;

type InlineEdit = {
  element: HTMLElement;
  path: PathSegment[];
};

type SelectionEntry = {
  anchorText: string;
  fieldHash: string;
  fieldPath: PathSegment[];
  label: string;
  path: string;
  selectedText: string;
  selectionRange: null;
  text: string;
};

type SlideSpecPayload = JsonRecord & {
  slideSpec?: SlideSpec;
};

type Request = <TResponse = SlideSpecPayload>(url: string, options?: RequestInit) => Promise<TResponse>;

export type InlineTextEditingDependencies = {
  applySlideSpecPayload: (payload: unknown, fallbackSpec: unknown) => void;
  elements: Pick<StudioClientElements.Elements,
    "activePreview" |
    "operationStatus" |
    "saveSlideSpecButton" |
    "slideSpecEditor" |
    "slideSpecStatus"
  >;
  getSlideSpecPathValue: (slideSpec: unknown, path: unknown) => unknown;
  onDraftPreview: () => void;
  onError: (error: unknown) => void;
  onSaved: () => void;
  patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => void;
  renderAssistantSelection: () => void;
  renderPreviews: () => void;
  renderVariantComparison: () => void;
  request: Request;
  state: StudioClientState.State;
  updateSlideSpecHighlight: () => void;
};

function normalizeInlineText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cloneSlideSpecWithPath(slideSpec: SlideSpec, path: unknown, value: unknown): SlideSpec {
  return StudioClientSlideSpecPath.cloneWithPath(slideSpec, path, value);
}

function selectElementText(element: HTMLElement): void {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  if (!selection) {
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

export function createInlineTextEditing(deps: InlineTextEditingDependencies) {
  const {
    applySlideSpecPayload,
    elements,
    getSlideSpecPathValue,
    onDraftPreview,
    onError,
    onSaved,
    patchDomSlideSpec,
    renderAssistantSelection,
    renderPreviews,
    renderVariantComparison,
    request,
    state,
    updateSlideSpecHighlight
  } = deps;

  let activeInlineTextEdit: InlineEdit | null = null;

  function updateStructuredDraftFromInlineEdit(path: unknown, value: string): void {
    if (!state.selectedSlideStructured || !state.selectedSlideId || !state.selectedSlideSpec) {
      return;
    }

    const nextSpec = cloneSlideSpecWithPath(state.selectedSlideSpec, path, value);
    state.selectedSlideSpec = nextSpec;
    state.selectedSlideSpecDraftError = null;
    patchDomSlideSpec(state.selectedSlideId, nextSpec);
    elements.slideSpecEditor.value = JSON.stringify(nextSpec, null, 2);
    updateSlideSpecHighlight();
    elements.saveSlideSpecButton.disabled = false;
    elements.slideSpecStatus.textContent = "Previewing inline text edits. Blur or press Enter to save.";
    renderVariantComparison();
  }

  function clearAssistantSelection(): void {
    state.assistant.selection = null;
    renderAssistantSelection();
  }

  function getSelectionEditElement(selection: Selection | null): HTMLElement | null {
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const element = common.nodeType === Node.ELEMENT_NODE && common instanceof Element ? common : common.parentElement;
    const editElement = element ? element.closest("[data-edit-path]") : null;
    return editElement instanceof HTMLElement && elements.activePreview.contains(editElement) ? editElement : null;
  }

  function getSelectionEditElements(selection: Selection | null): HTMLElement[] {
    if (!selection || selection.rangeCount === 0 || !elements.activePreview) {
      return [];
    }

    const range = selection.getRangeAt(0);
    return Array.from(elements.activePreview.querySelectorAll("[data-edit-path]"))
      .filter((element): element is HTMLElement => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        try {
          return range.intersectsNode(element);
        } catch (error) {
          return false;
        }
      });
  }

  function buildSelectionEntry(editElement: HTMLElement, selectedText: string): SelectionEntry | null {
    const fieldPath = StudioClientSlideSpecPath.pathToArray(editElement.dataset.editPath || "");
    const fieldValue = getSlideSpecPathValue(state.selectedSlideSpec, fieldPath);
    const text = normalizeInlineText(selectedText || editElement.textContent || fieldValue);
    if (!fieldPath.length || fieldValue === undefined || !text) {
      return null;
    }

    return {
      anchorText: text,
      fieldHash: StudioClientSlideSpecPath.hashFieldValue(fieldValue),
      fieldPath,
      label: editElement.dataset.editLabel || "Slide text",
      path: StudioClientSlideSpecPath.pathToString(fieldPath),
      selectedText: text,
      selectionRange: null,
      text
    };
  }

  function captureAssistantSelection(): void {
    if (activeInlineTextEdit) {
      return;
    }

    const selection = window.getSelection();
    const text = normalizeInlineText(selection ? selection.toString() : "");
    const editElement = getSelectionEditElement(selection);

    if (!text || !editElement) {
      return;
    }

    const editElements = getSelectionEditElements(selection);
    const uniqueElements = Array.from(new Map(
      editElements
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .map((element) => [element.dataset.editPath || "", element])
    ).values());
    const selections = uniqueElements.length > 1
      ? uniqueElements.map((element) => buildSelectionEntry(element, "")).filter((entry): entry is SelectionEntry => Boolean(entry))
      : [buildSelectionEntry(editElement, text.slice(0, 500))].filter((entry): entry is SelectionEntry => Boolean(entry));

    if (!selections.length) {
      return;
    }

    state.assistant.selection = selections.length > 1
      ? {
          kind: "selectionGroup",
          label: `${selections.length} selected fields`,
          presentationId: state.presentations.activePresentationId,
          selections,
          slideId: state.selectedSlideId,
          slideIndex: state.selectedSlideIndex,
          text: text.slice(0, 500)
        }
      : {
          ...selections[0],
          kind: "selection",
          presentationId: state.presentations.activePresentationId,
          slideId: state.selectedSlideId,
          slideIndex: state.selectedSlideIndex
        };
    renderAssistantSelection();
  }

  function beginInlineTextEdit(element: HTMLElement, path: unknown): void {
    if (activeInlineTextEdit || !state.selectedSlideId || !state.selectedSlideSpec) {
      return;
    }

    const original = normalizeInlineText(getSlideSpecPathValue(state.selectedSlideSpec, path) ?? element.textContent);
    activeInlineTextEdit = { element, path: StudioClientSlideSpecPath.pathToArray(path) };
    element.dataset.inlineEditing = "true";
    element.contentEditable = "plaintext-only";
    element.spellcheck = true;
    element.focus();
    selectElementText(element);

    const finish = async (mode: "cancel" | "save"): Promise<void> => {
      if (activeInlineTextEdit === null) {
        return;
      }

      activeInlineTextEdit = null;
      element.removeEventListener("blur", handleBlur);
      element.removeEventListener("input", handleInput);
      element.removeEventListener("keydown", handleKeydown);
      element.contentEditable = "false";

      if (mode === "cancel") {
        element.textContent = original;
        updateStructuredDraftFromInlineEdit(path, original);
        renderPreviews();
        delete element.dataset.inlineEditing;
        elements.operationStatus.textContent = "Inline text edit canceled.";
        return;
      }

      const nextText = normalizeInlineText(element.textContent);
      if (!nextText) {
        element.textContent = original;
        delete element.dataset.inlineEditing;
        elements.operationStatus.textContent = "Inline text edit canceled because the field was empty.";
        return;
      }

      if (nextText === original) {
        element.textContent = original;
        delete element.dataset.inlineEditing;
        return;
      }

      if (!state.selectedSlideSpec) {
        element.textContent = original;
        delete element.dataset.inlineEditing;
        elements.operationStatus.textContent = "Inline text edit canceled because the slide spec is unavailable.";
        return;
      }

      const nextSpec = cloneSlideSpecWithPath(state.selectedSlideSpec, path, nextText);
      element.dataset.inlineSaving = "true";
      elements.operationStatus.textContent = `Saving ${element.dataset.editLabel || "slide text"}...`;

      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/slide-spec`, {
          body: JSON.stringify({
            rebuild: false,
            slideSpec: nextSpec
          }),
          method: "POST"
        });
        applySlideSpecPayload(payload, nextSpec);
        onSaved();
        elements.operationStatus.textContent = `Saved ${element.dataset.editLabel || "slide text"}.`;
      } catch (error) {
        onError(error);
        renderPreviews();
      }
    };

    const handleBlur = (): void => {
      finish("save").catch(onError);
    };

    const handleInput = (): void => {
      const nextText = normalizeInlineText(element.textContent);
      if (!nextText) {
        return;
      }
      updateStructuredDraftFromInlineEdit(path, nextText);
      onDraftPreview();
    };

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish("cancel").catch(onError);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        element.blur();
      }
    };

    element.addEventListener("blur", handleBlur);
    element.addEventListener("input", handleInput);
    element.addEventListener("keydown", handleKeydown);
  }

  return {
    beginInlineTextEdit,
    captureAssistantSelection,
    clearAssistantSelection
  };
}
