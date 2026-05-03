import type { StudioClientElements } from "../core/elements";
import { StudioClientFileReaderActions } from "../core/file-reader-actions.ts";
import type { StudioClientState } from "../core/state";
import { validationDetail, validationLabel } from "./current-slide-validation-model.ts";
import { buildManualDeckEditReference, buildSlideNavigationLabels } from "./manual-slide-model.ts";
import { buildMediaControlState, normalizeMediaFocalPoint } from "./media-control-model.ts";
import { StudioClientSlideSpecPath } from "./slide-spec-path.ts";
import type { CurrentSlideValidation } from "./current-slide-validation-model.ts";
import type { MediaFit, MediaFocalPoint } from "./media-control-model.ts";

export namespace StudioClientSlideEditorWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;
  type PathSegment = StudioClientSlideSpecPath.PathSegment;
  type SlideSpec = JsonRecord;
  type InlineEdit = {
    element: HTMLElement;
    path: PathSegment[];
  };
  type BusyElement = HTMLElement & {
    disabled: boolean;
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
  type Material = JsonRecord & {
    alt?: string;
    caption?: string;
    fileName?: string;
    id: string;
    title?: string;
    url?: string;
  };
  type CustomVisual = JsonRecord & {
    content?: string;
    description?: string;
    id: string;
    role?: string;
    title?: string;
  };
  type SlideSpecPayload = JsonRecord & {
    context?: StudioClientState.DeckContext;
    domPreview?: unknown;
    insertedSlideId?: string;
    material?: Material;
    materials?: Material[];
    customVisual?: CustomVisual;
    customVisuals?: CustomVisual[];
    previews?: StudioClientState.State["previews"];
    runtime?: StudioClientState.RuntimeState | null;
    selectedSlideId?: string | null;
    slide?: StudioClientState.StudioSlide;
    slides?: StudioClientState.StudioSlide[];
    slideSpec?: SlideSpec;
    slideSpecError?: string | null;
    source?: string;
    structured?: boolean;
    validation?: CurrentSlideValidation;
  };
  type SlideReorderPayload = SlideSpecPayload & {
    selectedSlideId?: string | null;
  };
  type Request = <TResponse = SlideSpecPayload>(url: string, options?: RequestInit) => Promise<TResponse>;
  export type SlideEditorWorkbenchDependencies = {
    createDomElement: (tagName: string, options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      disabled?: boolean;
      text?: unknown;
    }, children?: Array<Node | string | number | boolean>) => HTMLElement;
    elements: StudioClientElements.Elements;
    highlightJsonSource: (value: string) => string;
    loadSlide: (slideId: string) => Promise<void>;
    patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => void;
    renderAssistantSelection: () => void;
    renderDeckFields: () => void;
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariantComparison: () => void;
    renderVariants: () => void;
    request: Request;
    setBusy: (button: BusyElement, label: string) => () => void;
    setCurrentPage: (page: string) => void;
    setDomPreviewState: (payload: SlideSpecPayload) => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function toMaterial(value: JsonRecord): Material | null {
    return typeof value.id === "string" ? { ...value, id: value.id } : null;
  }

  function toCustomVisual(value: JsonRecord): CustomVisual | null {
    return typeof value.id === "string" ? { ...value, id: value.id } : null;
  }

  function toSlideSpecPayload(value: unknown): SlideSpecPayload {
    return isRecord(value) ? value : {};
  }

  export function createSlideEditorWorkbench(deps: SlideEditorWorkbenchDependencies) {
    const {
      createDomElement,
      elements,
      highlightJsonSource,
      loadSlide,
      patchDomSlideSpec,
      renderAssistantSelection,
      renderDeckFields,
      renderDeckLengthPlan,
      renderDeckStructureCandidates,
      renderPreviews,
      renderStatus,
      renderVariantComparison,
      renderVariants,
      request,
      setBusy,
      setCurrentPage,
      setDomPreviewState,
      state,
      windowRef
    } = deps;
    const { readFileAsDataUrl } = StudioClientFileReaderActions.createFileReaderActions({
      windowRef
    });
    let mediaValidation: CurrentSlideValidation = {
      ok: false,
      state: "draft-unchecked"
    };
    let mediaValidationSlideId = "";

    let activeInlineTextEdit: InlineEdit | null = null;
    let slideSpecPreviewFrame: number | null = null;
    let draggedReorderSlideId = "";
    let reorderSlideIds: string[] = [];

    function updateSlideSpecHighlight(): void {
      const highlightCode = elements.slideSpecHighlight ? elements.slideSpecHighlight.querySelector("code") : null;
      if (!highlightCode) {
        return;
      }
    
      highlightCode.innerHTML = highlightJsonSource(elements.slideSpecEditor.value);
      elements.slideSpecHighlight.scrollTop = elements.slideSpecEditor.scrollTop;
      elements.slideSpecHighlight.scrollLeft = elements.slideSpecEditor.scrollLeft;
    }
    
    function enableDomSlideTextEditing(viewport: Element | null): void {
      const slideViewport = viewport ? viewport.querySelector(".dom-slide-viewport") : null;
      if (!slideViewport || !state.selectedSlideStructured || !state.selectedSlideSpec) {
        return;
      }
    
      slideViewport.classList.add("dom-slide-viewport--editable");
      slideViewport.querySelectorAll("[data-edit-path]").forEach((element) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }
        element.tabIndex = 0;
        element.title = `Double-click to edit ${element.dataset.editLabel || "text"}`;
      });
    }
    
    function getSlideSpecPathValue(slideSpec: unknown, path: unknown): unknown {
      return StudioClientSlideSpecPath.getPathValue(slideSpec, path);
    }
    
    function cloneSlideSpecWithPath(slideSpec: SlideSpec, path: unknown, value: unknown): SlideSpec {
      return StudioClientSlideSpecPath.cloneWithPath(slideSpec, path, value);
    }
    
    function normalizeInlineText(value: unknown): string {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

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
    
    function applySlideSpecPayload(rawPayload: unknown, fallbackSpec: unknown): void {
      const payload = toSlideSpecPayload(rawPayload);
      const nextSpec = payload.slideSpec || fallbackSpec;
      if (!isRecord(nextSpec)) {
        return;
      }
      state.selectedSlideSpec = nextSpec;
      state.selectedSlideSpecDraftError = null;
      state.selectedSlideSpecError = payload.slideSpecError || null;
      state.selectedSlideStructured = payload.structured === true;
      state.selectedSlideSource = payload.source || "";
      if (payload.slide) {
        const updatedSlide = payload.slide;
        state.slides = state.slides.map((slide) => slide.id === updatedSlide.id ? updatedSlide : slide);
        state.selectedSlideIndex = updatedSlide.index;
      }
      if (state.selectedSlideId) {
        patchDomSlideSpec(state.selectedSlideId, nextSpec);
      }
      state.previews = payload.previews || state.previews;
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
          renderSlideFields();
          renderPreviews();
          renderVariantComparison();
          renderStatus();
          elements.operationStatus.textContent = `Saved ${element.dataset.editLabel || "slide text"}.`;
        } catch (error) {
          window.alert(errorMessage(error));
          renderPreviews();
        }
      };
    
      const handleBlur = (): void => {
        finish("save").catch((error) => window.alert(errorMessage(error)));
      };

      const handleInput = (): void => {
        const nextText = normalizeInlineText(element.textContent);
        if (!nextText) {
          return;
        }
        updateStructuredDraftFromInlineEdit(path, nextText);
      };
    
      const handleKeydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish("cancel").catch((error) => window.alert(errorMessage(error)));
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
    
    function getSelectedSlide(): StudioClientState.StudioSlide | null {
      return state.slides.find((slide: StudioClientState.StudioSlide) => slide.id === state.selectedSlideId) || null;
    }

    function renderManualDeckEditOptions(): void {
      const selectedSlide = getSelectedSlide();
      const detourChecked = elements.manualSystemDetour instanceof HTMLInputElement && elements.manualSystemDetour.checked;
      const navigationLabels = buildSlideNavigationLabels(state.slides, state.context.deck?.navigation);
      const selectedLabel = selectedSlide ? navigationLabels.get(selectedSlide.id) || null : null;
      const reference = buildManualDeckEditReference({
        detourChecked,
        selectedLabel,
        selectedSlide
      });

      elements.manualSystemAfter.replaceChildren(
        createDomElement("option", { attributes: { value: "" }, text: "At end" }),
        ...state.slides.map((slide: StudioClientState.StudioSlide) => createDomElement("option", {
          attributes: { value: slide.id },
          text: `After ${slide.index}. ${slide.title}`
        }))
      );
      elements.manualDeleteSlide.replaceChildren(...state.slides.map((slide: StudioClientState.StudioSlide) => createDomElement("option", {
        attributes: { value: slide.id },
        text: `${slide.index}. ${slide.title}`
      })));
      elements.deleteSlideButton.disabled = state.slides.length <= 1;
      if (elements.manualSystemDetour instanceof HTMLInputElement) {
        elements.manualSystemDetour.disabled = !selectedSlide;
      }
      elements.manualSystemAfter.disabled = detourChecked;
      elements.manualSystemAfter.value = selectedSlide ? selectedSlide.id : "";
      elements.manualDeleteSlide.value = selectedSlide ? selectedSlide.id : "";
      elements.manualSystemReference.textContent = reference.systemReference;
      elements.manualDeleteReference.textContent = reference.deleteReference;
    }
    
    function renderSlideFields(): void {
      const slideContext = state.selectedSlideId ? state.context.slides?.[state.selectedSlideId] || {} : {};
      elements.slideTitle.value = typeof slideContext.title === "string" ? slideContext.title : "";
      elements.slideIntent.value = typeof slideContext.intent === "string" ? slideContext.intent : "";
      elements.slideMustInclude.value = typeof slideContext.mustInclude === "string" ? slideContext.mustInclude : "";
      elements.slideNotes.value = typeof slideContext.notes === "string" ? slideContext.notes : "";
      elements.slideLayoutHint.value = typeof slideContext.layoutHint === "string" ? slideContext.layoutHint : "";
    
      if (state.selectedSlideStructured && state.selectedSlideSpec) {
        state.selectedSlideSpecDraftError = null;
        elements.slideSpecEditor.disabled = false;
        elements.saveSlideSpecButton.disabled = false;
        elements.captureVariantButton.disabled = false;
        elements.slideSpecEditor.value = JSON.stringify(state.selectedSlideSpec, null, 2);
        updateSlideSpecHighlight();
        elements.slideSpecStatus.textContent = "Ready. Valid JSON changes preview immediately; save persists without rebuilding.";
        return;
      }
    
      state.selectedSlideSpecDraftError = null;
      elements.slideSpecEditor.disabled = true;
      elements.saveSlideSpecButton.disabled = true;
      elements.captureVariantButton.disabled = false;
      elements.slideSpecEditor.value = "";
      updateSlideSpecHighlight();
      elements.slideSpecStatus.textContent = state.selectedSlideSpecError
        ? `Structured editing is unavailable for this slide: ${state.selectedSlideSpecError}`
        : "Structured editing is unavailable for this slide.";
    }
    
    function getSelectedSlideMaterialId(): string {
      const media = state.selectedSlideSpec && isRecord(state.selectedSlideSpec.media) ? state.selectedSlideSpec.media : null;
      return typeof media?.id === "string"
        ? media.id
        : "";
    }

    function getSelectedSlideCustomVisualId(): string {
      const customVisual = state.selectedSlideSpec && isRecord(state.selectedSlideSpec.customVisual) ? state.selectedSlideSpec.customVisual : null;
      return typeof customVisual?.id === "string"
        ? customVisual.id
        : "";
    }

    function getSelectedSlideMedia(): JsonRecord | null {
      return state.selectedSlideSpec && isRecord(state.selectedSlideSpec.media)
        ? state.selectedSlideSpec.media
        : null;
    }

    function renderMediaValidation(): void {
      if (mediaValidationSlideId !== (state.selectedSlideId || "")) {
        mediaValidation = {
          ok: false,
          state: "draft-unchecked"
        };
        mediaValidationSlideId = state.selectedSlideId || "";
      }
      const stateName = mediaValidation.state || "draft-unchecked";
      const firstIssue = Array.isArray(mediaValidation.issues) ? mediaValidation.issues[0] : null;
      elements.materialValidation.dataset.state = stateName;
      elements.materialValidation.replaceChildren(
        createDomElement("strong", { text: validationLabel(mediaValidation) }),
        createDomElement("span", {
          text: firstIssue && (firstIssue.message || firstIssue.rule)
            ? firstIssue.message || firstIssue.rule
            : validationDetail(mediaValidation)
        })
      );
    }
    
    function renderMaterials(): void {
      if (!elements.materialList) {
        return;
      }
    
      const materials = (Array.isArray(state.materials) ? state.materials : [])
        .map(toMaterial)
        .filter((material): material is Material => Boolean(material));
      const selectedMaterialId = getSelectedSlideMaterialId();
      const selectedMedia = getSelectedSlideMedia();
      const mediaControls = buildMediaControlState({
        selectedMaterialId,
        selectedMedia,
        selectedSlideId: state.selectedSlideId
      });
      elements.materialDetachButton.disabled = mediaControls.detachDisabled;
      elements.fitMaterialButton.disabled = mediaControls.fitDisabled;
      elements.fillMaterialButton.disabled = mediaControls.fillDisabled;
      elements.recenterMaterialButton.disabled = mediaControls.recenterDisabled;
      elements.materialFocalPoint.disabled = mediaControls.focalPointDisabled;
      elements.materialFocalPoint.value = mediaControls.focalPointValue;
      renderMediaValidation();
    
      if (!materials.length) {
        elements.materialList.replaceChildren(createDomElement("div", { className: "material-empty" }, [
          createDomElement("strong", { text: "No materials yet" }),
          createDomElement("span", { text: "Upload an image to make it available to this presentation." })
        ]));
        renderManualSlideForm();
        return;
      }
    
      elements.materialList.replaceChildren();
      materials.forEach((material: Material) => {
        const attached = material.id === selectedMaterialId;
        const button = createDomElement("button", {
          attributes: {
            type: "button"
          },
          className: "secondary",
          disabled: !state.selectedSlideId || attached,
          text: attached ? "Attached" : "Attach"
        }) as HTMLButtonElement;
        const item = createDomElement("article", {
          className: `material-card${attached ? " active" : ""}`
        }, [
          createDomElement("img", {
            attributes: {
              alt: material.alt || material.title || "Material",
              src: material.url || ""
            }
          }),
          createDomElement("div", { className: "material-card-copy" }, [
            createDomElement("strong", { text: material.title || material.fileName || "Material" }),
            createDomElement("span", { text: material.caption || material.alt || "No caption" })
          ]),
          button
        ]);
        button.addEventListener("click", () => attachMaterialToSlide(material, button).catch((error) => window.alert(errorMessage(error))));
        elements.materialList.appendChild(item);
      });
    
      renderManualSlideForm();
    }

    function renderCustomVisuals(): void {
      if (!elements.customVisualList) {
        return;
      }

      const customVisuals = (Array.isArray(state.customVisuals) ? state.customVisuals : [])
        .map(toCustomVisual)
        .filter((customVisual): customVisual is CustomVisual => Boolean(customVisual));
      const selectedCustomVisualId = getSelectedSlideCustomVisualId();
      elements.customVisualDetachButton.disabled = !state.selectedSlideId || !selectedCustomVisualId;

      if (!customVisuals.length) {
        elements.customVisualList.replaceChildren(createDomElement("div", { className: "material-empty" }, [
          createDomElement("strong", { text: "No custom visuals yet" }),
          createDomElement("span", { text: "Save a sanitized static SVG to reuse it in this presentation." })
        ]));
        return;
      }

      elements.customVisualList.replaceChildren();
      customVisuals.forEach((customVisual: CustomVisual) => {
        const attached = customVisual.id === selectedCustomVisualId;
        const button = createDomElement("button", {
          attributes: {
            type: "button"
          },
          className: "secondary",
          disabled: !state.selectedSlideId || attached,
          text: attached ? "Attached" : "Attach"
        }) as HTMLButtonElement;
        const preview = createDomElement("div", {
          className: "custom-visual-card-preview"
        });
        preview.innerHTML = customVisual.content || "";
        const item = createDomElement("article", {
          className: `material-card custom-visual-card${attached ? " active" : ""}`
        }, [
          preview,
          createDomElement("div", { className: "material-card-copy" }, [
            createDomElement("strong", { text: customVisual.title || "Custom visual" }),
            createDomElement("span", { text: customVisual.description || customVisual.role || "Static SVG" })
          ]),
          button
        ]);
        button.addEventListener("click", () => attachCustomVisualToSlide(customVisual, button).catch((error) => windowRef.alert(errorMessage(error))));
        elements.customVisualList.appendChild(item);
      });
    }

    function renderMaterialsPanel(): void {
      renderMaterials();
      renderCustomVisuals();
    }
    
    function setManualSlideDetailsOpen(kind: "delete" | "system"): void {
      const openSystem = kind === "system" && !elements.manualSystemDetails.open;
      const openDelete = kind === "delete" && !elements.manualDeleteDetails.open;
      elements.manualSystemDetails.open = openSystem;
      elements.manualDeleteDetails.open = openDelete;
      const slideRailPanel = elements.manualSystemDetails.closest(".slide-rail-panel");
      if (slideRailPanel) {
        slideRailPanel.classList.toggle("is-manual-open", openSystem || openDelete);
      }
      elements.openManualSystemButton.setAttribute("aria-expanded", openSystem ? "true" : "false");
      elements.openManualDeleteButton.setAttribute("aria-expanded", openDelete ? "true" : "false");
      if (openSystem) {
        renderManualDeckEditOptions();
        elements.manualSystemTitle.focus();
      } else if (openDelete) {
        renderManualDeckEditOptions();
        elements.deleteSlideButton.focus();
      }
    }
    
    function renderManualSlideForm(): void {
      const slideType = elements.manualSystemType ? elements.manualSystemType.value : "content";
      const isDivider = slideType === "divider";
      const isQuote = slideType === "quote";
      const isPhoto = slideType === "photo";
      const isPhotoGrid = slideType === "photoGrid";
      const isDetour = elements.manualSystemDetour instanceof HTMLInputElement && elements.manualSystemDetour.checked;
      const summaryField = document.querySelector(".manual-system-summary-field");
      const materialField = document.querySelector(".manual-system-material-field");
      elements.manualSystemAfter.disabled = isDetour;
    
      if (elements.manualSystemTitle) {
        elements.manualSystemTitle.placeholder = isDivider
          ? "Section title"
          : isQuote
            ? "Quote slide title"
            : isPhoto
              ? "Photo slide title"
              : isPhotoGrid
                ? "Photo grid title"
          : "System name";
      }
    
      if (elements.manualSystemSummary) {
        elements.manualSystemSummary.placeholder = isDivider
          ? "Optional notes for yourself; divider slides stay title-only."
          : isQuote
            ? "Paste the quote or pull quote text. Attribution and source can be added in JSON."
            : isPhoto
              ? "Optional caption shown with the photo."
              : isPhotoGrid
                ? "Optional caption shown above the image grid."
          : "What boundary, signal, and guardrails should this system explain?";
        elements.manualSystemSummary.disabled = isDivider;
      }
    
      if (summaryField instanceof HTMLElement) {
        summaryField.hidden = isDivider;
        const label = summaryField.querySelector("span");
        if (label) {
          label.textContent = isQuote ? "Quote" : (isPhoto || isPhotoGrid) ? "Caption" : "Summary";
        }
      }
    
      if (materialField instanceof HTMLElement) {
        materialField.hidden = !(isPhoto || isPhotoGrid);
      }
    
      if (elements.manualSystemMaterial) {
        const selectedIds = Array.from<HTMLOptionElement>(elements.manualSystemMaterial.selectedOptions || []).map((option) => option.value);
        const materials = (Array.isArray(state.materials) ? state.materials : [])
          .map(toMaterial)
          .filter((material): material is Material => Boolean(material));
        elements.manualSystemMaterial.replaceChildren(...(materials.length
          ? materials.map((material: Material) => createDomElement("option", {
            attributes: { value: material.id },
            text: material.title || material.fileName || material.id
          }))
          : [createDomElement("option", { attributes: { value: "" }, text: "Upload a material first" })]));
        const nextSelectedIds = selectedIds.filter((id: string) => materials.some((material: Material) => material.id === id));
        if (!nextSelectedIds.length && materials.length) {
          nextSelectedIds.push(...materials.slice(0, isPhotoGrid ? 2 : 1).map((material: Material) => material.id));
        }
        if (!isPhotoGrid) {
          nextSelectedIds.splice(1);
        }
        Array.from<HTMLOptionElement>(elements.manualSystemMaterial.options).forEach((option) => {
          option.selected = nextSelectedIds.includes(option.value);
        });
        elements.manualSystemMaterial.disabled = !(isPhoto || isPhotoGrid) || !materials.length;
        elements.manualSystemMaterial.size = isPhotoGrid ? Math.min(4, Math.max(2, materials.length)) : 1;
        if ((isPhoto || isPhotoGrid) && materials.length) {
          const selectedMaterial = materials.find((material: Material) => material.id === nextSelectedIds[0]) || materials[0];
          if (elements.manualSystemTitle && !elements.manualSystemTitle.value.trim()) {
            elements.manualSystemTitle.placeholder = selectedMaterial?.title || (isPhotoGrid ? "Photo grid title" : "Photo slide title");
          }
        }
      }
    
      if (elements.createSystemSlideButton) {
        elements.createSystemSlideButton.textContent = isDetour
          ? "Create subslide"
          : isDivider
          ? "Create divider"
          : isQuote
            ? "Create quote slide"
            : isPhoto
              ? "Create photo slide"
              : isPhotoGrid
                ? "Create photo grid"
          : "Create system slide";
      }
    }
    
    async function createSystemSlide(): Promise<void> {
      const title = elements.manualSystemTitle.value.trim();
      const slideType = elements.manualSystemType ? elements.manualSystemType.value : "content";
      const createAsDetour = elements.manualSystemDetour instanceof HTMLInputElement && elements.manualSystemDetour.checked;
      const summary = slideType === "divider" ? "" : elements.manualSystemSummary.value.trim();
      const selectedMaterialIds = elements.manualSystemMaterial
        ? Array.from<HTMLOptionElement>(elements.manualSystemMaterial.selectedOptions || []).map((option) => option.value).filter(Boolean)
        : [];
      if (!title) {
        window.alert(slideType === "divider"
          ? "Add a title for the divider slide."
          : slideType === "quote"
            ? "Add a title for the quote slide."
            : slideType === "photo"
              ? "Add a title for the photo slide."
              : slideType === "photoGrid"
                ? "Add a title for the photo grid slide."
          : "Add a title for the system slide.");
        elements.manualSystemTitle.focus();
        return;
      }
      if (slideType === "quote" && !summary) {
        window.alert("Add the quote text.");
        elements.manualSystemSummary.focus();
        return;
      }
      if (slideType === "photo" && (!elements.manualSystemMaterial || !elements.manualSystemMaterial.value)) {
        window.alert("Choose a material for the photo slide.");
        if (elements.manualSystemMaterial) {
          elements.manualSystemMaterial.focus();
        }
        return;
      }
      if (slideType === "photoGrid" && selectedMaterialIds.length < 2) {
        window.alert("Choose at least two materials for the photo grid slide.");
        if (elements.manualSystemMaterial) {
          elements.manualSystemMaterial.focus();
        }
        return;
      }
    
      const done = setBusy(elements.createSystemSlideButton, "Creating...");
      try {
        const selectedSlide = getSelectedSlide();
        const payload = await request<SlideSpecPayload>("/api/slides/system", {
          body: JSON.stringify({
            afterSlideId: createAsDetour ? "" : selectedSlide?.id || "",
            detour: createAsDetour,
            materialId: selectedMaterialIds[0] || "",
            materialIds: selectedMaterialIds,
            parentSlideId: selectedSlide?.id || "",
            slideType,
            summary,
            title
          }),
          method: "POST"
        });
        state.context = payload.context || state.context;
        if (payload.domPreview) {
          setDomPreviewState(payload);
        }
        state.previews = payload.previews || state.previews;
        state.runtime = payload.runtime || state.runtime;
        state.slides = payload.slides || state.slides;
        state.deckStructureCandidates = [];
        state.selectedDeckStructureId = null;
        state.selectedSlideId = payload.insertedSlideId || state.selectedSlideId;
        state.selectedVariantId = null;
        elements.manualSystemTitle.value = "";
        elements.manualSystemSummary.value = "";
        if (elements.manualSystemType) {
          elements.manualSystemType.value = "content";
        }
        if (elements.manualSystemDetour instanceof HTMLInputElement) {
          elements.manualSystemDetour.checked = false;
        }
        elements.manualSystemDetails.open = false;
        elements.openManualSystemButton.setAttribute("aria-expanded", "false");
        renderManualSlideForm();
        renderDeckFields();
        renderDeckLengthPlan();
        renderDeckStructureCandidates();
        renderStatus();
        renderPreviews();
        renderVariants();
        setCurrentPage("studio");
        if (state.selectedSlideId) {
          await loadSlide(state.selectedSlideId);
        }
        elements.operationStatus.textContent = slideType === "divider"
          ? createAsDetour ? `Created detour ${title}.` : `Created divider slide ${title}.`
          : slideType === "quote"
            ? createAsDetour ? `Created detour ${title}.` : `Created quote slide ${title}.`
            : slideType === "photo"
              ? createAsDetour ? `Created detour ${title}.` : `Created photo slide ${title}.`
              : slideType === "photoGrid"
                ? createAsDetour ? `Created detour ${title}.` : `Created photo grid slide ${title}.`
          : createAsDetour ? `Created detour ${title}.` : `Created system slide ${title}.`;
      } finally {
        done();
      }
    }
    
    async function deleteSlideFromDeck(): Promise<void> {
      const slideId = state.selectedSlideId || "";
      const slide = state.slides.find((entry: StudioClientState.StudioSlide) => entry.id === slideId);
      if (!slide) {
        window.alert("Select a slide to remove.");
        return;
      }
    
      const confirmed = window.confirm(`Remove the current slide "${slide.index}. ${slide.title}" from the active deck? The slide file will be archived, not deleted.`);
      if (!confirmed) {
        return;
      }
    
      const done = setBusy(elements.deleteSlideButton, "Removing...");
      try {
        const payload = await request<SlideSpecPayload>("/api/slides/delete", {
          body: JSON.stringify({ slideId }),
          method: "POST"
        });
        state.context = payload.context || state.context;
        if (payload.domPreview) {
          setDomPreviewState(payload);
        }
        state.previews = payload.previews || state.previews;
        state.runtime = payload.runtime || state.runtime;
        state.slides = payload.slides || state.slides;
        state.deckStructureCandidates = [];
        state.selectedDeckStructureId = null;
        state.selectedSlideId = payload.selectedSlideId || (state.slides[0] ? state.slides[0].id : null);
        state.selectedVariantId = null;
        renderDeckFields();
        renderDeckLengthPlan();
        renderDeckStructureCandidates();
        renderStatus();
        renderPreviews();
        renderVariants();
        setCurrentPage("studio");
        if (state.selectedSlideId) {
          await loadSlide(state.selectedSlideId);
        }
        elements.manualDeleteDetails.open = false;
        elements.openManualDeleteButton.setAttribute("aria-expanded", "false");
        elements.operationStatus.textContent = `Removed ${slide.title} from the deck.`;
      } finally {
        done();
      }
    }

    function reorderIds(source: string[], draggedId: string, targetId: string): string[] {
      if (!draggedId || !targetId || draggedId === targetId) {
        return source;
      }
      const next = source.filter((slideId) => slideId !== draggedId);
      const targetIndex = next.indexOf(targetId);
      if (targetIndex < 0) {
        return source;
      }
      next.splice(targetIndex, 0, draggedId);
      return next;
    }

    function moveReorderSlide(slideId: string, offset: number): void {
      const currentIndex = reorderSlideIds.indexOf(slideId);
      const nextIndex = currentIndex + offset;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= reorderSlideIds.length) {
        return;
      }
      const next = [...reorderSlideIds];
      next.splice(currentIndex, 1);
      next.splice(nextIndex, 0, slideId);
      reorderSlideIds = next;
      renderSlideReorderList();
    }

    function renderSlideReorderList(): void {
      const slidesById = new Map(state.slides.map((slide: StudioClientState.StudioSlide) => [slide.id, slide]));
      const navigationLabels = buildSlideNavigationLabels(state.slides, state.context.deck?.navigation);
      elements.slideReorderList.replaceChildren(...reorderSlideIds.map((slideId, index) => {
        const slide = slidesById.get(slideId);
        const labelInfo = navigationLabels.get(slideId) || { description: "Slide", label: String(index + 1) };
        const item = createDomElement("article", {
          attributes: {
            draggable: "true",
            role: "listitem",
            "data-slide-id": slideId
          },
          className: `slide-reorder-item${slideId === state.selectedSlideId ? " active" : ""}`
        }, [
          createDomElement("span", { className: "slide-reorder-handle", text: "Drag" }),
          createDomElement("div", { className: "slide-reorder-copy" }, [
            createDomElement("strong", { text: slide ? `${labelInfo.label}. ${slide.title || `Slide ${index + 1}`}` : slideId }),
            createDomElement("span", { text: `${labelInfo.description} - File order ${index + 1}` })
          ]),
          createDomElement("div", { className: "slide-reorder-stepper" }, [
            createDomElement("button", {
              attributes: { type: "button", "aria-label": `Move ${slide?.title || slideId} up` },
              className: "secondary utility-button",
              disabled: index === 0,
              text: "Up"
            }),
            createDomElement("button", {
              attributes: { type: "button", "aria-label": `Move ${slide?.title || slideId} down` },
              className: "secondary utility-button",
              disabled: index === reorderSlideIds.length - 1,
              text: "Down"
            })
          ])
        ]);
        const buttons = item.querySelectorAll("button");
        buttons[0]?.addEventListener("click", () => moveReorderSlide(slideId, -1));
        buttons[1]?.addEventListener("click", () => moveReorderSlide(slideId, 1));
        item.addEventListener("dragstart", (event: DragEvent) => {
          draggedReorderSlideId = slideId;
          event.dataTransfer?.setData("text/plain", slideId);
          event.dataTransfer?.setDragImage(item, 12, 12);
        });
        item.addEventListener("dragover", (event: DragEvent) => {
          event.preventDefault();
        });
        item.addEventListener("drop", (event: DragEvent) => {
          event.preventDefault();
          const sourceId = event.dataTransfer?.getData("text/plain") || draggedReorderSlideId;
          reorderSlideIds = reorderIds(reorderSlideIds, sourceId, slideId);
          draggedReorderSlideId = "";
          renderSlideReorderList();
        });
        item.addEventListener("dragend", () => {
          draggedReorderSlideId = "";
        });
        return item;
      }));
    }

    function openSlideReorderDialog(): void {
      reorderSlideIds = state.slides.map((slide: StudioClientState.StudioSlide) => slide.id);
      renderSlideReorderList();
      if (elements.slideReorderDialog instanceof HTMLDialogElement && typeof elements.slideReorderDialog.showModal === "function") {
        elements.slideReorderDialog.showModal();
      } else {
        elements.slideReorderDialog.setAttribute("open", "");
      }
    }

    function closeSlideReorderDialog(): void {
      if (elements.slideReorderDialog instanceof HTMLDialogElement && typeof elements.slideReorderDialog.close === "function") {
        elements.slideReorderDialog.close();
      } else {
        elements.slideReorderDialog.removeAttribute("open");
      }
      draggedReorderSlideId = "";
      reorderSlideIds = [];
    }

    async function applySlideReorder(): Promise<void> {
      if (reorderSlideIds.length !== state.slides.length) {
        window.alert("Reorder list is incomplete. Reopen the reorder dialog and try again.");
        return;
      }
      const currentOrder = state.slides.map((slide: StudioClientState.StudioSlide) => slide.id).join("|");
      const nextOrder = reorderSlideIds.join("|");
      if (currentOrder === nextOrder) {
        closeSlideReorderDialog();
        return;
      }
      const confirmed = window.confirm("Apply this slide order to the active deck?");
      if (!confirmed) {
        return;
      }

      const done = setBusy(elements.applySlideReorderButton, "Applying...");
      try {
        const payload = await request<SlideReorderPayload>("/api/slides/reorder", {
          body: JSON.stringify({
            selectedSlideId: state.selectedSlideId || "",
            slideIds: reorderSlideIds
          }),
          method: "POST"
        });
        state.context = payload.context || state.context;
        if (payload.domPreview) {
          setDomPreviewState(payload);
        }
        state.previews = payload.previews || state.previews;
        state.runtime = payload.runtime || state.runtime;
        state.slides = payload.slides || state.slides;
        state.deckStructureCandidates = [];
        state.selectedDeckStructureId = null;
        state.selectedSlideId = payload.selectedSlideId || state.selectedSlideId;
        state.selectedVariantId = null;
        renderManualDeckEditOptions();
        renderDeckFields();
        renderDeckLengthPlan();
        renderDeckStructureCandidates();
        renderStatus();
        renderPreviews();
        renderVariants();
        setCurrentPage("studio");
        if (state.selectedSlideId) {
          await loadSlide(state.selectedSlideId);
        }
        closeSlideReorderDialog();
        elements.operationStatus.textContent = "Applied slide order.";
      } finally {
        done();
      }
    }
    
    async function saveSlideContext(): Promise<void> {
      const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/context`, {
        body: JSON.stringify({
          intent: elements.slideIntent.value,
          layoutHint: elements.slideLayoutHint.value,
          mustInclude: elements.slideMustInclude.value,
          notes: elements.slideNotes.value,
          title: elements.slideTitle.value
        }),
        method: "POST"
      });
    
      state.context = payload.context || state.context;
      renderSlideFields();
    }
    
    async function uploadMaterial(): Promise<void> {
      const file = elements.materialFile.files && elements.materialFile.files[0];
      if (!file) {
        window.alert("Choose an image to upload.");
        elements.materialFile.focus();
        return;
      }
    
      const done = setBusy(elements.materialUploadButton, "Uploading...");
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (typeof dataUrl !== "string") {
          throw new Error("Material upload did not produce a data URL.");
        }
        const payload = await request<SlideSpecPayload>("/api/materials", {
          body: JSON.stringify({
            alt: elements.materialAlt.value.trim(),
            caption: elements.materialCaption.value.trim(),
            dataUrl,
            fileName: file.name,
            title: file.name
          }),
          method: "POST"
        });
    
        state.materials = payload.materials || state.materials;
        elements.materialFile.value = "";
        if (!elements.materialAlt.value.trim()) {
          elements.materialAlt.value = payload.material && payload.material.alt ? payload.material.alt : "";
        }
        renderMaterials();
        elements.operationStatus.textContent = `Uploaded material ${payload.material?.title || file.name}.`;
      } finally {
        done();
      }
    }
    
    function applySlideMaterialPayload(payload: SlideSpecPayload, fallbackSpec: SlideSpec): void {
      applySlideSpecPayload(payload, fallbackSpec);
      mediaValidation = {
        ok: false,
        state: "draft-unchecked"
      };
      mediaValidationSlideId = state.selectedSlideId || "";
      if (payload.domPreview) {
        setDomPreviewState(payload);
      }
      state.materials = payload.materials || state.materials;
      renderSlideFields();
      renderPreviews();
      renderVariantComparison();
      renderStatus();
    }
    
    async function attachMaterialToSlide(material: Material, button: HTMLButtonElement | null = null): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }
    
      const done = button ? setBusy(button, "Attaching...") : null;
      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/material`, {
          body: JSON.stringify({
            alt: elements.materialAlt.value.trim() || material.alt || material.title,
            caption: elements.materialCaption.value.trim() || material.caption || "",
            materialId: material.id
          }),
          method: "POST"
        });
        applySlideMaterialPayload(payload, payload.slideSpec || state.selectedSlideSpec || {});
        elements.operationStatus.textContent = `Attached ${material.title} to the selected slide.`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function detachMaterialFromSlide(): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }
    
      const done = setBusy(elements.materialDetachButton, "Detaching...");
      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/material`, {
          body: JSON.stringify({ materialId: "" }),
          method: "POST"
        });
        applySlideMaterialPayload(payload, payload.slideSpec || state.selectedSlideSpec || {});
        elements.operationStatus.textContent = "Detached material from the selected slide.";
      } finally {
        done();
      }
    }

    async function saveCustomVisual(): Promise<void> {
      const file = elements.customVisualFile.files && elements.customVisualFile.files[0];
      const fileContent = file ? await file.text() : "";
      const content = fileContent || elements.customVisualContent.value.trim();
      if (!content) {
        windowRef.alert("Paste SVG markup or choose an SVG file.");
        elements.customVisualContent.focus();
        return;
      }

      const done = setBusy(elements.customVisualSaveButton, "Saving...");
      try {
        const title = elements.customVisualTitle.value.trim() || (file ? file.name.replace(/\.svg$/i, "") : "Custom visual");
        const payload = await request<SlideSpecPayload>("/api/custom-visuals", {
          body: JSON.stringify({
            content,
            description: elements.customVisualDescription.value.trim(),
            role: elements.customVisualRole.value,
            title
          }),
          method: "POST"
        });

        state.customVisuals = payload.customVisuals || state.customVisuals;
        elements.customVisualFile.value = "";
        elements.customVisualContent.value = "";
        elements.customVisualTitle.value = "";
        renderCustomVisuals();
        elements.operationStatus.textContent = `Saved custom visual ${payload.customVisual?.title || title}.`;
      } finally {
        done();
      }
    }

    function applySlideCustomVisualPayload(payload: SlideSpecPayload, fallbackSpec: SlideSpec): void {
      applySlideSpecPayload(payload, fallbackSpec);
      state.customVisuals = payload.customVisuals || state.customVisuals;
      renderSlideFields();
      renderCustomVisuals();
      renderPreviews();
      renderVariantComparison();
      renderStatus();
    }

    async function attachCustomVisualToSlide(customVisual: CustomVisual, button: HTMLButtonElement | null = null): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }

      const done = button ? setBusy(button, "Attaching...") : null;
      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/custom-visual`, {
          body: JSON.stringify({
            customVisualId: customVisual.id
          }),
          method: "POST"
        });
        applySlideCustomVisualPayload(payload, payload.slideSpec || state.selectedSlideSpec || {});
        elements.operationStatus.textContent = `Attached ${customVisual.title || "custom visual"} to the selected slide.`;
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function detachCustomVisualFromSlide(): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }

      const done = setBusy(elements.customVisualDetachButton, "Detaching...");
      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/custom-visual`, {
          body: JSON.stringify({ customVisualId: "" }),
          method: "POST"
        });
        applySlideCustomVisualPayload(payload, payload.slideSpec || state.selectedSlideSpec || {});
        elements.operationStatus.textContent = "Detached custom visual from the selected slide.";
      } finally {
        done();
      }
    }

    async function updateSelectedMediaTreatment(fields: { fit?: MediaFit; focalPoint?: MediaFocalPoint }, label: string): Promise<void> {
      if (!state.selectedSlideId || !state.selectedSlideSpec || !isRecord(state.selectedSlideSpec.media)) {
        return;
      }

      const nextSpec = {
        ...state.selectedSlideSpec,
        media: {
          ...state.selectedSlideSpec.media,
          ...fields
        }
      };
      const button = fields.fit === "contain"
        ? elements.fitMaterialButton
        : fields.fit === "cover"
          ? elements.fillMaterialButton
          : elements.recenterMaterialButton;
      const done = setBusy(button, "Updating...");
      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/slide-spec`, {
          body: JSON.stringify({
            rebuild: false,
            slideSpec: nextSpec
          }),
          method: "POST"
        });
        applySlideSpecPayload(payload, nextSpec);
        const validationPayload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/validate-current`, {
          body: JSON.stringify({ slideSpec: nextSpec }),
          method: "POST"
        });
        mediaValidation = validationPayload.validation || {
          ok: false,
          state: "draft-unchecked"
        };
        mediaValidationSlideId = state.selectedSlideId || "";
        renderSlideFields();
        renderMaterials();
        renderCustomVisuals();
        renderPreviews();
        renderVariantComparison();
        renderStatus();
        elements.operationStatus.textContent = label;
      } finally {
        done();
      }
    }
    
    function parseSlideSpecEditor(): SlideSpec {
      if (!state.selectedSlideStructured) {
        throw new Error("Structured editing is not available for this slide.");
      }
    
      try {
        const slideSpec = JSON.parse(elements.slideSpecEditor.value);
        if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
          throw new Error("Slide spec JSON must be an object.");
        }
        return slideSpec;
      } catch (error) {
        throw new Error(`Slide spec JSON is invalid: ${errorMessage(error)}`);
      }
    }
    
    function previewSlideSpecEditorDraft(): void {
      if (!state.selectedSlideStructured || !state.selectedSlideId) {
        return;
      }
    
      let slideSpec: SlideSpec;
      try {
        slideSpec = JSON.parse(elements.slideSpecEditor.value);
        if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
          throw new Error("Slide spec JSON must be an object.");
        }
      } catch (error) {
        state.selectedSlideSpecDraftError = errorMessage(error);
        elements.saveSlideSpecButton.disabled = true;
        elements.slideSpecStatus.textContent = `Slide spec JSON is invalid: ${errorMessage(error)}`;
        return;
      }
    
      state.selectedSlideSpec = slideSpec;
      state.selectedSlideSpecDraftError = null;
      patchDomSlideSpec(state.selectedSlideId, slideSpec);
      elements.saveSlideSpecButton.disabled = false;
      elements.slideSpecStatus.textContent = "Previewing unsaved JSON edits. Save persists without rebuilding.";
      renderPreviews();
      renderVariantComparison();
    }
    
    function scheduleSlideSpecEditorPreview(): void {
      updateSlideSpecHighlight();
    
      if (slideSpecPreviewFrame !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(slideSpecPreviewFrame);
      }
    
      const preview = (): void => {
        slideSpecPreviewFrame = null;
        previewSlideSpecEditorDraft();
      };
    
      if (typeof window.requestAnimationFrame === "function") {
        slideSpecPreviewFrame = window.requestAnimationFrame(preview);
        return;
      }
    
      preview();
    }
    
    async function saveSlideSpec(): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }
    
      const slideSpec = parseSlideSpecEditor();
      const done = setBusy(elements.saveSlideSpecButton, "Saving...");
      try {
        const payload = await request<SlideSpecPayload>(`/api/slides/${state.selectedSlideId}/slide-spec`, {
          body: JSON.stringify({
            rebuild: false,
            slideSpec
          }),
          method: "POST"
        });
        applySlideSpecPayload(payload, slideSpec);
        renderSlideFields();
        renderPreviews();
        renderVariantComparison();
        renderStatus();
        elements.operationStatus.textContent = "Saved slide spec.";
      } finally {
        done();
      }
    }

    function mount(): void {
      elements.openManualSystemButton.addEventListener("click", () => setManualSlideDetailsOpen("system"));
      elements.openManualDeleteButton.addEventListener("click", () => setManualSlideDetailsOpen("delete"));
      elements.openSlideReorderButton.addEventListener("click", () => openSlideReorderDialog());
      elements.cancelSlideReorderButton.addEventListener("click", () => closeSlideReorderDialog());
      elements.applySlideReorderButton.addEventListener("click", () => applySlideReorder().catch((error) => windowRef.alert(errorMessage(error))));
      elements.manualSystemDetour.addEventListener("change", () => {
        renderManualDeckEditOptions();
        renderManualSlideForm();
      });
      elements.createSystemSlideButton.addEventListener("click", () => createSystemSlide().catch((error) => windowRef.alert(errorMessage(error))));
      elements.deleteSlideButton.addEventListener("click", () => deleteSlideFromDeck().catch((error) => windowRef.alert(errorMessage(error))));
      elements.materialUploadButton.addEventListener("click", () => uploadMaterial().catch((error) => windowRef.alert(errorMessage(error))));
      elements.materialDetachButton.addEventListener("click", () => detachMaterialFromSlide().catch((error) => windowRef.alert(errorMessage(error))));
      elements.customVisualSaveButton.addEventListener("click", () => saveCustomVisual().catch((error) => windowRef.alert(errorMessage(error))));
      elements.customVisualDetachButton.addEventListener("click", () => detachCustomVisualFromSlide().catch((error) => windowRef.alert(errorMessage(error))));
      elements.fitMaterialButton.addEventListener("click", () => updateSelectedMediaTreatment({ fit: "contain" }, "Set selected slide media to fit inside its region.").catch((error) => windowRef.alert(errorMessage(error))));
      elements.fillMaterialButton.addEventListener("click", () => updateSelectedMediaTreatment({ fit: "cover" }, "Set selected slide media to fill its region.").catch((error) => windowRef.alert(errorMessage(error))));
      elements.recenterMaterialButton.addEventListener("click", () => updateSelectedMediaTreatment({ focalPoint: "center" }, "Recentered selected slide media.").catch((error) => windowRef.alert(errorMessage(error))));
      elements.materialFocalPoint.addEventListener("change", () => updateSelectedMediaTreatment({
        focalPoint: normalizeMediaFocalPoint(elements.materialFocalPoint.value)
      }, "Updated selected slide media focal point.").catch((error) => windowRef.alert(errorMessage(error))));
      elements.saveSlideSpecButton.addEventListener("click", () => saveSlideSpec().catch((error) => windowRef.alert(errorMessage(error))));
      elements.slideSpecEditor.addEventListener("input", scheduleSlideSpecEditorPreview);
      elements.slideSpecEditor.addEventListener("scroll", updateSlideSpecHighlight);
      elements.activePreview.addEventListener("dblclick", (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target.closest("[data-edit-path]") : null;
        if (!target || !elements.activePreview.contains(target)) {
          return;
        }

        event.preventDefault();
        if (target instanceof HTMLElement) {
          beginInlineTextEdit(target, target.dataset.editPath);
        }
      });
      elements.activePreview.addEventListener("mouseup", captureAssistantSelection);
      elements.activePreview.addEventListener("keyup", captureAssistantSelection);
    }

    return {
      applySlideSpecPayload,
      clearAssistantSelection,
      enableDomSlideTextEditing,
      getSlideSpecPathValue,
      hashFieldValue: StudioClientSlideSpecPath.hashFieldValue,
      mount,
      parseSlideSpecEditor,
      pathToString: StudioClientSlideSpecPath.pathToString,
      renderCustomVisuals,
      renderManualDeckEditOptions,
      renderManualSlideForm,
      renderMaterials,
      renderMaterialsPanel,
      renderSlideFields,
      saveSlideContext,
      setManualSlideDetailsOpen,
      updateSlideSpecHighlight
    };
  }
}
