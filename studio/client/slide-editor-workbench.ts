import type { StudioClientElements } from "./elements";
import type { StudioClientState } from "./state";

export namespace StudioClientSlideEditorWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;
  type PathSegment = number | string;
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
  type SlideSpecPayload = JsonRecord & {
    context?: StudioClientState.DeckContext;
    domPreview?: unknown;
    insertedSlideId?: string;
    material?: Material;
    materials?: Material[];
    previews?: StudioClientState.State["previews"];
    runtime?: StudioClientState.RuntimeState | null;
    selectedSlideId?: string | null;
    slide?: StudioClientState.StudioSlide;
    slides?: StudioClientState.StudioSlide[];
    slideSpec?: SlideSpec;
    slideSpecError?: string | null;
    source?: string;
    structured?: boolean;
  };
  type Request = <TResponse = SlideSpecPayload>(url: string, options?: RequestInit) => Promise<TResponse>;
  type Deps = {
    clearTransientVariants: (slideId: string) => void;
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
    readFileAsDataUrl: (file: Blob) => Promise<string | ArrayBuffer | null>;
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
    windowRef: Pick<Window, "alert">;
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

  function toSlideSpecPayload(value: unknown): SlideSpecPayload {
    return isRecord(value) ? value : {};
  }

  function readIndexedValue(container: unknown, segment: PathSegment): unknown {
    if (Array.isArray(container) && typeof segment === "number") {
      return container[segment];
    }
    if (isRecord(container)) {
      return container[String(segment)];
    }
    return undefined;
  }

  function writeIndexedValue(container: unknown, segment: PathSegment, value: unknown): void {
    if (Array.isArray(container) && typeof segment === "number") {
      container[segment] = value;
      return;
    }
    if (isRecord(container)) {
      container[String(segment)] = value;
      return;
    }
    throw new Error(`Cannot edit unknown slide field segment: ${segment}`);
  }

  export function createSlideEditorWorkbench(deps: Deps) {
    const {
      clearTransientVariants,
      createDomElement,
      elements,
      highlightJsonSource,
      loadSlide,
      patchDomSlideSpec,
      readFileAsDataUrl,
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

    let activeInlineTextEdit: InlineEdit | null = null;
    let slideSpecPreviewFrame: number | null = null;

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
    
    function pathToArray(path: unknown): PathSegment[] {
      if (Array.isArray(path)) {
        return path.map((segment) => Number.isInteger(Number(segment)) && String(segment).trim() !== ""
          ? Number(segment)
          : String(segment));
      }
    
      return String(path || "")
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => Number.isInteger(Number(segment)) ? Number(segment) : segment);
    }
    
    function pathToString(path: unknown): string {
      return (Array.isArray(path) ? path : pathToArray(path)).map(String).join(".");
    }
    
    function canonicalJson(value: unknown): string {
      if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(",")}]`;
      }
    
      if (isRecord(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
      }
    
      return JSON.stringify(value);
    }
    
    function hashFieldValue(value: unknown): string {
      let hash = 2166136261;
      const text = canonicalJson(value);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }
    
    function getSlideSpecPathValue(slideSpec: unknown, path: unknown): unknown {
      return pathToArray(path).reduce<unknown>((current, segment) => {
        return readIndexedValue(current, segment);
      }, slideSpec);
    }
    
    function cloneSlideSpecWithPath(slideSpec: unknown, path: unknown, value: unknown): SlideSpec {
      const nextSpec = JSON.parse(JSON.stringify(slideSpec));
      const segments = String(path || "").split(".");
      const field = segments.pop();
      const target = segments.reduce<unknown>((current, segment) => {
        if (current === null || current === undefined) {
          throw new Error(`Cannot edit unknown slide field: ${path}`);
        }
    
        return readIndexedValue(current, Number.isInteger(Number(segment)) ? Number(segment) : segment);
      }, nextSpec);
    
      if (!target || field === undefined) {
        throw new Error(`Cannot edit unknown slide field: ${path}`);
      }
    
      writeIndexedValue(target, Number.isInteger(Number(field)) ? Number(field) : field, value);
      return nextSpec;
    }
    
    function normalizeInlineText(value: unknown): string {
      return String(value || "").replace(/\s+/g, " ").trim();
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
      const fieldPath = pathToArray(editElement.dataset.editPath || "");
      const fieldValue = getSlideSpecPathValue(state.selectedSlideSpec, fieldPath);
      const text = normalizeInlineText(selectedText || editElement.textContent || fieldValue);
      if (!fieldPath.length || fieldValue === undefined || !text) {
        return null;
      }
    
      return {
        anchorText: text,
        fieldHash: hashFieldValue(fieldValue),
        fieldPath,
        label: editElement.dataset.editLabel || "Slide text",
        path: pathToString(fieldPath),
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
      activeInlineTextEdit = { element, path: pathToArray(path) };
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
        element.removeEventListener("keydown", handleKeydown);
        element.contentEditable = "false";
    
        if (mode === "cancel") {
          element.textContent = original;
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
      element.addEventListener("keydown", handleKeydown);
    }
    
    function renderManualDeckEditOptions(): void {
      const previousInsert = elements.manualSystemAfter.value;
      const previousDelete = elements.manualDeleteSlide.value;
      const selectedSlide = state.slides.find((slide: StudioClientState.StudioSlide) => slide.id === state.selectedSlideId);

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
    
      if (previousInsert && state.slides.some((slide: StudioClientState.StudioSlide) => slide.id === previousInsert)) {
        elements.manualSystemAfter.value = previousInsert;
      } else {
        elements.manualSystemAfter.value = selectedSlide ? selectedSlide.id : "";
      }
    
      if (previousDelete && state.slides.some((slide: StudioClientState.StudioSlide) => slide.id === previousDelete)) {
        elements.manualDeleteSlide.value = previousDelete;
      } else {
        elements.manualDeleteSlide.value = selectedSlide ? selectedSlide.id : (state.slides[0] ? state.slides[0].id : "");
      }
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
    
    function renderMaterials(): void {
      if (!elements.materialList) {
        return;
      }
    
      const materials = (Array.isArray(state.materials) ? state.materials : [])
        .map(toMaterial)
        .filter((material): material is Material => Boolean(material));
      const selectedMaterialId = getSelectedSlideMaterialId();
      elements.materialDetachButton.disabled = !state.selectedSlideId || !selectedMaterialId;
    
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
    
    function setManualSlideDetailsOpen(kind: "delete" | "system"): void {
      const openSystem = kind === "system" && !elements.manualSystemDetails.open;
      const openDelete = kind === "delete" && !elements.manualDeleteDetails.open;
      elements.manualSystemDetails.open = openSystem;
      elements.manualDeleteDetails.open = openDelete;
      elements.openManualSystemButton.setAttribute("aria-expanded", openSystem ? "true" : "false");
      elements.openManualDeleteButton.setAttribute("aria-expanded", openDelete ? "true" : "false");
      if (openSystem) {
        elements.manualSystemTitle.focus();
      } else if (openDelete) {
        elements.manualDeleteSlide.focus();
      }
    }
    
    function renderManualSlideForm(): void {
      const slideType = elements.manualSystemType ? elements.manualSystemType.value : "content";
      const isDivider = slideType === "divider";
      const isQuote = slideType === "quote";
      const isPhoto = slideType === "photo";
      const isPhotoGrid = slideType === "photoGrid";
      const summaryField = document.querySelector(".manual-system-summary-field");
      const materialField = document.querySelector(".manual-system-material-field");
    
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
        elements.createSystemSlideButton.textContent = isDivider
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
        const payload = await request<SlideSpecPayload>("/api/slides/system", {
          body: JSON.stringify({
            afterSlideId: elements.manualSystemAfter.value,
            materialId: selectedMaterialIds[0] || "",
            materialIds: selectedMaterialIds,
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
          ? `Created divider slide ${title}.`
          : slideType === "quote"
            ? `Created quote slide ${title}.`
            : slideType === "photo"
              ? `Created photo slide ${title}.`
              : slideType === "photoGrid"
                ? `Created photo grid slide ${title}.`
          : `Created system slide ${title}.`;
      } finally {
        done();
      }
    }
    
    async function deleteSlideFromDeck(): Promise<void> {
      const slideId = elements.manualDeleteSlide.value;
      const slide = state.slides.find((entry: StudioClientState.StudioSlide) => entry.id === slideId);
      if (!slide) {
        window.alert("Choose a slide to remove.");
        return;
      }
    
      const confirmed = window.confirm(`Remove "${slide.title}" from the active deck? The slide file will be archived, not deleted.`);
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
      elements.createSystemSlideButton.addEventListener("click", () => createSystemSlide().catch((error) => windowRef.alert(errorMessage(error))));
      elements.deleteSlideButton.addEventListener("click", () => deleteSlideFromDeck().catch((error) => windowRef.alert(errorMessage(error))));
      elements.materialUploadButton.addEventListener("click", () => uploadMaterial().catch((error) => windowRef.alert(errorMessage(error))));
      elements.materialDetachButton.addEventListener("click", () => detachMaterialFromSlide().catch((error) => windowRef.alert(errorMessage(error))));
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
      hashFieldValue,
      mount,
      parseSlideSpecEditor,
      pathToString,
      renderManualDeckEditOptions,
      renderManualSlideForm,
      renderMaterials,
      renderSlideFields,
      saveSlideContext,
      setManualSlideDetailsOpen,
      updateSlideSpecHighlight
    };
  }
}
