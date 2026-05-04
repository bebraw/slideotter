import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import { buildManualDeckEditReference, buildSlideNavigationLabels } from "./manual-slide-model.ts";
import type { Material } from "./material-editor-actions.ts";
import { toMaterial } from "./slide-editor-payload.ts";

type CreateDomElement = (
  tagName: string,
  options?: {
    attributes?: Record<string, string | number | boolean>;
    className?: string;
    disabled?: boolean;
    text?: unknown;
  },
  children?: Array<Node | string | number | boolean>
) => HTMLElement;

type ManualSlideFormOptions = {
  createDomElement: CreateDomElement;
  elements: StudioClientElements.Elements;
  selectedSlide: StudioClientState.StudioSlide | null;
  state: StudioClientState.State;
};

export function renderManualDeckEditOptions(options: ManualSlideFormOptions): void {
  const { createDomElement, elements, selectedSlide, state } = options;
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

export function renderManualSlideForm(options: ManualSlideFormOptions): void {
  const { createDomElement, elements, state } = options;
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
