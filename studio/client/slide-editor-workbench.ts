namespace StudioClientSlideEditorWorkbench {
  export function createSlideEditorWorkbench(deps) {
    const {
      clearTransientVariants,
      elements,
      escapeHtml,
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

    let activeInlineTextEdit = null;
    let slideSpecPreviewFrame = null;

    function updateSlideSpecHighlight() {
      const highlightCode = elements.slideSpecHighlight ? elements.slideSpecHighlight.querySelector("code") : null;
      if (!highlightCode) {
        return;
      }
    
      highlightCode.innerHTML = highlightJsonSource(elements.slideSpecEditor.value);
      elements.slideSpecHighlight.scrollTop = elements.slideSpecEditor.scrollTop;
      elements.slideSpecHighlight.scrollLeft = elements.slideSpecEditor.scrollLeft;
    }
    
    function enableDomSlideTextEditing(viewport) {
      const slideViewport = viewport ? viewport.querySelector(".dom-slide-viewport") : null;
      if (!slideViewport || !state.selectedSlideStructured || !state.selectedSlideSpec) {
        return;
      }
    
      slideViewport.classList.add("dom-slide-viewport--editable");
      slideViewport.querySelectorAll("[data-edit-path]").forEach((element) => {
        element.tabIndex = 0;
        element.title = `Double-click to edit ${element.dataset.editLabel || "text"}`;
      });
    }
    
    function pathToArray(path) {
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
    
    function pathToString(path) {
      return (Array.isArray(path) ? path : pathToArray(path)).map(String).join(".");
    }
    
    function canonicalJson(value) {
      if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(",")}]`;
      }
    
      if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
      }
    
      return JSON.stringify(value);
    }
    
    function hashFieldValue(value) {
      let hash = 2166136261;
      const text = canonicalJson(value);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }
    
    function getSlideSpecPathValue(slideSpec, path) {
      return pathToArray(path).reduce((current, segment) => {
        if (current === null || current === undefined) {
          return undefined;
        }
    
        return current[segment];
      }, slideSpec);
    }
    
    function cloneSlideSpecWithPath(slideSpec, path, value) {
      const nextSpec = JSON.parse(JSON.stringify(slideSpec));
      const segments = String(path || "").split(".");
      const field = segments.pop();
      const target = segments.reduce((current, segment) => {
        if (current === null || current === undefined) {
          throw new Error(`Cannot edit unknown slide field: ${path}`);
        }
    
        return current[Number.isInteger(Number(segment)) ? Number(segment) : segment];
      }, nextSpec);
    
      if (!target || field === undefined) {
        throw new Error(`Cannot edit unknown slide field: ${path}`);
      }
    
      target[Number.isInteger(Number(field)) ? Number(field) : field] = value;
      return nextSpec;
    }
    
    function normalizeInlineText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }
    
    function applySlideSpecPayload(payload, fallbackSpec) {
      const nextSpec = payload.slideSpec || fallbackSpec;
      state.selectedSlideSpec = nextSpec;
      state.selectedSlideSpecDraftError = null;
      state.selectedSlideSpecError = payload.slideSpecError || null;
      state.selectedSlideStructured = payload.structured === true;
      state.selectedSlideSource = payload.source;
      if (payload.slide) {
        state.slides = state.slides.map((slide) => slide.id === payload.slide.id ? payload.slide : slide);
        state.selectedSlideIndex = payload.slide.index;
      }
      patchDomSlideSpec(state.selectedSlideId, nextSpec);
      state.previews = payload.previews || state.previews;
    }
    
    function selectElementText(element) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    function clearAssistantSelection() {
      state.assistant.selection = null;
      renderAssistantSelection();
    }
    
    function getSelectionEditElement(selection) {
      if (!selection || selection.rangeCount === 0) {
        return null;
      }
    
      const range = selection.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const element = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
      const editElement = element ? element.closest("[data-edit-path]") : null;
      return editElement && elements.activePreview.contains(editElement) ? editElement : null;
    }
    
    function getSelectionEditElements(selection) {
      if (!selection || selection.rangeCount === 0 || !elements.activePreview) {
        return [];
      }
    
      const range = selection.getRangeAt(0);
      return Array.from(elements.activePreview.querySelectorAll("[data-edit-path]"))
        .filter((element) => {
          try {
            return range.intersectsNode(element);
          } catch (error) {
            return false;
          }
        });
    }
    
    function buildSelectionEntry(editElement, selectedText) {
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
    
    function captureAssistantSelection() {
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
      const uniqueElements = Array.from(new Map(editElements.map((element: any) => [element.dataset.editPath || "", element])).values());
      const selections = uniqueElements.length > 1
        ? uniqueElements.map((element) => buildSelectionEntry(element, "")).filter(Boolean)
        : [buildSelectionEntry(editElement, text.slice(0, 500))].filter(Boolean);
    
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
    
    function beginInlineTextEdit(element, path) {
      if (activeInlineTextEdit || !state.selectedSlideId || !state.selectedSlideSpec) {
        return;
      }
    
      const original = normalizeInlineText(getSlideSpecPathValue(state.selectedSlideSpec, path) ?? element.textContent);
      activeInlineTextEdit = { element, path };
      element.dataset.inlineEditing = "true";
      element.contentEditable = "plaintext-only";
      element.spellcheck = true;
      element.focus();
      selectElementText(element);
    
      const finish = async (mode) => {
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
          const payload = await request(`/api/slides/${state.selectedSlideId}/slide-spec`, {
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
          window.alert(error.message);
          renderPreviews();
        }
      };
    
      const handleBlur = () => {
        finish("save").catch((error) => window.alert(error.message));
      };
    
      const handleKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish("cancel").catch((error) => window.alert(error.message));
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
    
    function renderManualDeckEditOptions() {
      const previousInsert = elements.manualSystemAfter.value;
      const previousDelete = elements.manualDeleteSlide.value;
      const selectedSlide = state.slides.find((slide) => slide.id === state.selectedSlideId);
      const slideOptions = state.slides
        .map((slide) => `<option value="${escapeHtml(slide.id)}">${slide.index}. ${escapeHtml(slide.title)}</option>`)
        .join("");
    
      elements.manualSystemAfter.innerHTML = [
        "<option value=\"\">At end</option>",
        ...state.slides.map((slide) => `<option value="${escapeHtml(slide.id)}">After ${slide.index}. ${escapeHtml(slide.title)}</option>`)
      ].join("");
      elements.manualDeleteSlide.innerHTML = slideOptions;
      elements.deleteSlideButton.disabled = state.slides.length <= 1;
    
      if (previousInsert && state.slides.some((slide) => slide.id === previousInsert)) {
        elements.manualSystemAfter.value = previousInsert;
      } else {
        elements.manualSystemAfter.value = selectedSlide ? selectedSlide.id : "";
      }
    
      if (previousDelete && state.slides.some((slide) => slide.id === previousDelete)) {
        elements.manualDeleteSlide.value = previousDelete;
      } else {
        elements.manualDeleteSlide.value = selectedSlide ? selectedSlide.id : (state.slides[0] ? state.slides[0].id : "");
      }
    }
    
    function renderSlideFields() {
      const slideContext = state.context.slides[state.selectedSlideId] || {};
      elements.slideTitle.value = slideContext.title || "";
      elements.slideIntent.value = slideContext.intent || "";
      elements.slideMustInclude.value = slideContext.mustInclude || "";
      elements.slideNotes.value = slideContext.notes || "";
      elements.slideLayoutHint.value = slideContext.layoutHint || "";
    
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
    
    function getSelectedSlideMaterialId() {
      return state.selectedSlideSpec && state.selectedSlideSpec.media
        ? state.selectedSlideSpec.media.id
        : "";
    }
    
    function renderMaterials() {
      if (!elements.materialList) {
        return;
      }
    
      const materials = Array.isArray(state.materials) ? state.materials : [];
      const selectedMaterialId = getSelectedSlideMaterialId();
      elements.materialDetachButton.disabled = !state.selectedSlideId || !selectedMaterialId;
    
      if (!materials.length) {
        elements.materialList.innerHTML = "<div class=\"material-empty\"><strong>No materials yet</strong><span>Upload an image to make it available to this presentation.</span></div>";
        renderManualSlideForm();
        return;
      }
    
      elements.materialList.innerHTML = "";
      materials.forEach((material) => {
        const attached = material.id === selectedMaterialId;
        const item = document.createElement("article");
        item.className = `material-card${attached ? " active" : ""}`;
        item.innerHTML = `
          <img src="${escapeHtml(material.url)}" alt="${escapeHtml(material.alt || material.title || "Material")}">
          <div class="material-card-copy">
            <strong>${escapeHtml(material.title || material.fileName || "Material")}</strong>
            <span>${escapeHtml(material.caption || material.alt || "No caption")}</span>
          </div>
          <button class="secondary" type="button">${attached ? "Attached" : "Attach"}</button>
        `;
    
        const button = item.querySelector("button");
        button.disabled = !state.selectedSlideId || attached;
        button.addEventListener("click", () => attachMaterialToSlide(material, button).catch((error) => window.alert(error.message)));
        elements.materialList.appendChild(item);
      });
    
      renderManualSlideForm();
    }
    
    function setManualSlideDetailsOpen(kind) {
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
    
    function renderManualSlideForm() {
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
        const selectedIds = Array.from(elements.manualSystemMaterial.selectedOptions || []).map((option: any) => option.value);
        const materials = Array.isArray(state.materials) ? state.materials : [];
        elements.manualSystemMaterial.innerHTML = materials.length
          ? materials.map((material) => `<option value="${escapeHtml(material.id)}">${escapeHtml(material.title || material.fileName || material.id)}</option>`).join("")
          : "<option value=\"\">Upload a material first</option>";
        const nextSelectedIds = selectedIds.filter((id) => materials.some((material) => material.id === id));
        if (!nextSelectedIds.length && materials.length) {
          nextSelectedIds.push(...materials.slice(0, isPhotoGrid ? 2 : 1).map((material) => material.id));
        }
        if (!isPhotoGrid) {
          nextSelectedIds.splice(1);
        }
        Array.from(elements.manualSystemMaterial.options).forEach((option: any) => {
          option.selected = nextSelectedIds.includes(option.value);
        });
        elements.manualSystemMaterial.disabled = !(isPhoto || isPhotoGrid) || !materials.length;
        elements.manualSystemMaterial.size = isPhotoGrid ? Math.min(4, Math.max(2, materials.length)) : 1;
        if ((isPhoto || isPhotoGrid) && materials.length) {
          const selectedMaterial = materials.find((material) => material.id === nextSelectedIds[0]) || materials[0];
          if (elements.manualSystemTitle && !elements.manualSystemTitle.value.trim()) {
            elements.manualSystemTitle.placeholder = selectedMaterial.title || (isPhotoGrid ? "Photo grid title" : "Photo slide title");
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
    
    async function createSystemSlide() {
      const title = elements.manualSystemTitle.value.trim();
      const slideType = elements.manualSystemType ? elements.manualSystemType.value : "content";
      const summary = slideType === "divider" ? "" : elements.manualSystemSummary.value.trim();
      const selectedMaterialIds = elements.manualSystemMaterial
        ? Array.from(elements.manualSystemMaterial.selectedOptions || []).map((option: any) => option.value).filter(Boolean)
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
        const payload = await request("/api/slides/system", {
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
        await loadSlide(state.selectedSlideId);
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
    
    async function deleteSlideFromDeck() {
      const slideId = elements.manualDeleteSlide.value;
      const slide = state.slides.find((entry) => entry.id === slideId);
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
        const payload = await request("/api/slides/delete", {
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
    
    async function saveSlideContext() {
      const payload = await request(`/api/slides/${state.selectedSlideId}/context`, {
        body: JSON.stringify({
          intent: elements.slideIntent.value,
          layoutHint: elements.slideLayoutHint.value,
          mustInclude: elements.slideMustInclude.value,
          notes: elements.slideNotes.value,
          title: elements.slideTitle.value
        }),
        method: "POST"
      });
    
      state.context = payload.context;
      renderSlideFields();
    }
    
    async function uploadMaterial() {
      const file = elements.materialFile.files && elements.materialFile.files[0];
      if (!file) {
        window.alert("Choose an image to upload.");
        elements.materialFile.focus();
        return;
      }
    
      const done = setBusy(elements.materialUploadButton, "Uploading...");
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const payload = await request("/api/materials", {
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
        elements.operationStatus.textContent = `Uploaded material ${payload.material.title}.`;
      } finally {
        done();
      }
    }
    
    function applySlideMaterialPayload(payload, fallbackSpec) {
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
    
    async function attachMaterialToSlide(material, button = null) {
      if (!state.selectedSlideId) {
        return;
      }
    
      const done = button ? setBusy(button, "Attaching...") : null;
      try {
        const payload = await request(`/api/slides/${state.selectedSlideId}/material`, {
          body: JSON.stringify({
            alt: elements.materialAlt.value.trim() || material.alt || material.title,
            caption: elements.materialCaption.value.trim() || material.caption || "",
            materialId: material.id
          }),
          method: "POST"
        });
        applySlideMaterialPayload(payload, payload.slideSpec);
        elements.operationStatus.textContent = `Attached ${material.title} to the selected slide.`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function detachMaterialFromSlide() {
      if (!state.selectedSlideId) {
        return;
      }
    
      const done = setBusy(elements.materialDetachButton, "Detaching...");
      try {
        const payload = await request(`/api/slides/${state.selectedSlideId}/material`, {
          body: JSON.stringify({ materialId: "" }),
          method: "POST"
        });
        applySlideMaterialPayload(payload, payload.slideSpec);
        elements.operationStatus.textContent = "Detached material from the selected slide.";
      } finally {
        done();
      }
    }
    
    function parseSlideSpecEditor() {
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
        throw new Error(`Slide spec JSON is invalid: ${error.message}`);
      }
    }
    
    function previewSlideSpecEditorDraft() {
      if (!state.selectedSlideStructured || !state.selectedSlideId) {
        return;
      }
    
      let slideSpec;
      try {
        slideSpec = JSON.parse(elements.slideSpecEditor.value);
        if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
          throw new Error("Slide spec JSON must be an object.");
        }
      } catch (error) {
        state.selectedSlideSpecDraftError = error.message;
        elements.saveSlideSpecButton.disabled = true;
        elements.slideSpecStatus.textContent = `Slide spec JSON is invalid: ${error.message}`;
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
    
    function scheduleSlideSpecEditorPreview() {
      updateSlideSpecHighlight();
    
      if (slideSpecPreviewFrame !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(slideSpecPreviewFrame);
      }
    
      const preview = () => {
        slideSpecPreviewFrame = null;
        previewSlideSpecEditorDraft();
      };
    
      if (typeof window.requestAnimationFrame === "function") {
        slideSpecPreviewFrame = window.requestAnimationFrame(preview);
        return;
      }
    
      preview();
    }
    
    async function saveSlideSpec() {
      if (!state.selectedSlideId) {
        return;
      }
    
      const slideSpec = parseSlideSpecEditor();
      const done = setBusy(elements.saveSlideSpecButton, "Saving...");
      try {
        const payload = await request(`/api/slides/${state.selectedSlideId}/slide-spec`, {
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

    function mount() {
      elements.openManualSystemButton.addEventListener("click", () => setManualSlideDetailsOpen("system"));
      elements.openManualDeleteButton.addEventListener("click", () => setManualSlideDetailsOpen("delete"));
      elements.createSystemSlideButton.addEventListener("click", () => createSystemSlide().catch((error) => windowRef.alert(error.message)));
      elements.deleteSlideButton.addEventListener("click", () => deleteSlideFromDeck().catch((error) => windowRef.alert(error.message)));
      elements.materialUploadButton.addEventListener("click", () => uploadMaterial().catch((error) => windowRef.alert(error.message)));
      elements.materialDetachButton.addEventListener("click", () => detachMaterialFromSlide().catch((error) => windowRef.alert(error.message)));
      elements.saveSlideSpecButton.addEventListener("click", () => saveSlideSpec().catch((error) => windowRef.alert(error.message)));
      elements.slideSpecEditor.addEventListener("input", scheduleSlideSpecEditorPreview);
      elements.slideSpecEditor.addEventListener("scroll", updateSlideSpecHighlight);
      elements.activePreview.addEventListener("dblclick", (event) => {
        const target = event.target.closest("[data-edit-path]");
        if (!target || !elements.activePreview.contains(target)) {
          return;
        }

        event.preventDefault();
        beginInlineTextEdit(target, target.dataset.editPath);
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
(globalThis as any).StudioClientSlideEditorWorkbench = StudioClientSlideEditorWorkbench;
