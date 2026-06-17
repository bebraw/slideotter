import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import { buildSlideNavigationLabels } from "./manual-slide-navigation-labels.ts";
import { buildManualDeckEditReference } from "./manual-slide-model.ts";
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

type ManualOptionSelect = Pick<HTMLElement, "replaceChildren"> & {
  disabled: boolean;
  options: HTMLOptionsCollection;
  selectedOptions: HTMLCollectionOf<HTMLOptionElement>;
  size: number;
  value: string;
};

type ManualSlideType = "content" | "divider" | "quote" | "photo" | "photoGrid";

type ManualSlideTypePresentation = {
  buttonLabel: string;
  materialCount: number;
  showsMaterialField: boolean;
  summaryLabel: string;
  summaryPlaceholder: string;
  titlePlaceholder: string;
};

const manualSlideTypePresentation: Record<ManualSlideType, ManualSlideTypePresentation> = {
  content: {
    buttonLabel: "Create system slide",
    materialCount: 0,
    showsMaterialField: false,
    summaryLabel: "Summary",
    summaryPlaceholder: "What boundary, signal, and guardrails should this system explain?",
    titlePlaceholder: "System name"
  },
  divider: {
    buttonLabel: "Create divider",
    materialCount: 0,
    showsMaterialField: false,
    summaryLabel: "Summary",
    summaryPlaceholder: "Optional notes for yourself; divider slides stay title-only.",
    titlePlaceholder: "Section title"
  },
  photo: {
    buttonLabel: "Create photo slide",
    materialCount: 1,
    showsMaterialField: true,
    summaryLabel: "Caption",
    summaryPlaceholder: "Optional caption shown with the photo.",
    titlePlaceholder: "Photo slide title"
  },
  photoGrid: {
    buttonLabel: "Create photo grid",
    materialCount: 2,
    showsMaterialField: true,
    summaryLabel: "Caption",
    summaryPlaceholder: "Optional caption shown above the image grid.",
    titlePlaceholder: "Photo grid title"
  },
  quote: {
    buttonLabel: "Create quote slide",
    materialCount: 0,
    showsMaterialField: false,
    summaryLabel: "Quote",
    summaryPlaceholder: "Paste the quote or pull quote text. Attribution and source can be added in JSON.",
    titlePlaceholder: "Quote slide title"
  }
};
const manualSlideTypes = new Set<string>(Object.keys(manualSlideTypePresentation));

function getManualSlideType(value: unknown): ManualSlideType {
  const slideType = String(value || "");
  return manualSlideTypes.has(slideType) ? slideType as ManualSlideType : "content";
}

function getMaterials(state: StudioClientState.State): Material[] {
  return (Array.isArray(state.materials) ? state.materials : [])
    .map(toMaterial)
    .filter((material): material is Material => Boolean(material));
}

function updateManualTextFields(elements: StudioClientElements.Elements, presentation: ManualSlideTypePresentation): void {
  if (elements.manualSystemTitle) {
    elements.manualSystemTitle.placeholder = presentation.titlePlaceholder;
  }
  if (elements.manualSystemSummary) {
    elements.manualSystemSummary.placeholder = presentation.summaryPlaceholder;
    elements.manualSystemSummary.disabled = presentation === manualSlideTypePresentation.divider;
  }
}

function updateSummaryField(summaryField: Element | null, presentation: ManualSlideTypePresentation): void {
  if (!(summaryField instanceof HTMLElement)) {
    return;
  }

  summaryField.hidden = presentation === manualSlideTypePresentation.divider;
  const label = summaryField.querySelector("span");
  if (label) {
    label.textContent = presentation.summaryLabel;
  }
}

function updateMaterialFieldVisibility(materialField: Element | null, presentation: ManualSlideTypePresentation): void {
  if (materialField instanceof HTMLElement) {
    materialField.hidden = !presentation.showsMaterialField;
  }
}

function updateManualFieldVisibility(presentation: ManualSlideTypePresentation): void {
  updateSummaryField(document.querySelector(".manual-system-summary-field"), presentation);
  updateMaterialFieldVisibility(document.querySelector(".manual-system-material-field"), presentation);
}

function getRetainedMaterialIds(materials: Material[], selectedIds: string[]): string[] {
  const materialIds = new Set(materials.map((material: Material) => material.id));
  return selectedIds.filter((id: string) => materialIds.has(id));
}

function getDefaultMaterialIds(materials: Material[], maxCount: number): string[] {
  return maxCount > 0 ? materials.slice(0, maxCount).map((material: Material) => material.id) : [];
}

function selectManualMaterials(materials: Material[], selectedIds: string[], maxCount: number): string[] {
  const retainedIds = getRetainedMaterialIds(materials, selectedIds);
  return (retainedIds.length ? retainedIds : getDefaultMaterialIds(materials, maxCount)).slice(0, maxCount);
}

function findManualTitleMaterial(materials: Material[], selectedIds: string[]): Material | null {
  return materials.find((material: Material) => material.id === selectedIds[0]) ?? materials[0] ?? null;
}

function canUpdateMaterialTitlePlaceholder(
  titleInput: StudioClientElements.Elements["manualSystemTitle"],
  materials: Material[],
  presentation: ManualSlideTypePresentation
): titleInput is NonNullable<StudioClientElements.Elements["manualSystemTitle"]> {
  return [
    Boolean(titleInput),
    presentation.showsMaterialField,
    materials.length > 0,
    !titleInput?.value.trim()
  ].every(Boolean);
}

function updateMaterialTitlePlaceholder(
  elements: StudioClientElements.Elements,
  materials: Material[],
  selectedIds: string[],
  presentation: ManualSlideTypePresentation
): void {
  const titleInput = elements.manualSystemTitle;
  if (!canUpdateMaterialTitlePlaceholder(titleInput, materials, presentation)) {
    return;
  }

  const selectedMaterial = findManualTitleMaterial(materials, selectedIds);
  titleInput.placeholder = selectedMaterial?.title ?? presentation.titlePlaceholder;
}

function createManualMaterialOption(
  createDomElement: CreateDomElement,
  material: Material
): HTMLElement {
  return createDomElement("option", {
    attributes: { value: material.id },
    text: material.title || material.fileName || material.id
  });
}

function createManualMaterialOptions(createDomElement: CreateDomElement, materials: Material[]): HTMLElement[] {
  return materials.length
    ? materials.map((material: Material) => createManualMaterialOption(createDomElement, material))
    : [createDomElement("option", { attributes: { value: "" }, text: "Upload a material first" })];
}

function applyManualMaterialSelection(select: ManualOptionSelect, selectedIds: string[]): void {
  Array.from<HTMLOptionElement>(select.options).forEach((option) => {
    option.selected = selectedIds.includes(option.value);
  });
}

function updateManualMaterialSelectState(select: ManualOptionSelect, materials: Material[], presentation: ManualSlideTypePresentation): void {
  select.disabled = !presentation.showsMaterialField || !materials.length;
  select.size = presentation.materialCount > 1
    ? Math.min(4, Math.max(2, materials.length))
    : 1;
}

function updateManualMaterialField(
  options: Pick<ManualSlideFormOptions, "createDomElement" | "elements" | "state">,
  presentation: ManualSlideTypePresentation
): void {
  const { createDomElement, elements, state } = options;
  if (!elements.manualSystemMaterial) {
    return;
  }

  const selectedIds = Array.from<HTMLOptionElement>(elements.manualSystemMaterial.selectedOptions || []).map((option) => option.value);
  const materials = getMaterials(state);
  const nextSelectedIds = selectManualMaterials(materials, selectedIds, presentation.materialCount);

  elements.manualSystemMaterial.replaceChildren(...createManualMaterialOptions(createDomElement, materials));
  applyManualMaterialSelection(elements.manualSystemMaterial, nextSelectedIds);
  updateManualMaterialSelectState(elements.manualSystemMaterial, materials, presentation);
  updateMaterialTitlePlaceholder(elements, materials, nextSelectedIds, presentation);
}

function createSlidePlacementOptions(
  createDomElement: CreateDomElement,
  slides: StudioClientState.StudioSlide[]
): HTMLElement[] {
  return [
    createDomElement("option", { attributes: { value: "" }, text: "At end" }),
    ...slides.map((slide: StudioClientState.StudioSlide) => createDomElement("option", {
      attributes: { value: slide.id },
      text: `After ${slide.index}. ${slide.title}`
    }))
  ];
}

function createSlideDeleteOptions(
  createDomElement: CreateDomElement,
  slides: StudioClientState.StudioSlide[]
): HTMLElement[] {
  return slides.map((slide: StudioClientState.StudioSlide) => createDomElement("option", {
    attributes: { value: slide.id },
    text: `${slide.index}. ${slide.title}`
  }));
}

function updateManualDeckSelectOptions(
  createDomElement: CreateDomElement,
  elements: StudioClientElements.Elements,
  slides: StudioClientState.StudioSlide[]
): void {
  elements.manualSystemAfter.replaceChildren(...createSlidePlacementOptions(createDomElement, slides));
  elements.manualDeleteSlide.replaceChildren(...createSlideDeleteOptions(createDomElement, slides));
}

function updateManualDeckSelectionState(
  elements: StudioClientElements.Elements,
  selectedSlide: StudioClientState.StudioSlide | null,
  detourChecked: boolean,
  slideCount: number
): void {
  elements.deleteSlideButton.disabled = slideCount <= 1;
  if (elements.manualSystemDetour instanceof HTMLInputElement) {
    elements.manualSystemDetour.disabled = !selectedSlide;
  }
  elements.manualSystemAfter.disabled = detourChecked;
  elements.manualSystemAfter.value = getSelectedSlideId(selectedSlide);
  elements.manualDeleteSlide.value = getSelectedSlideId(selectedSlide);
}

function getDetourChecked(elements: StudioClientElements.Elements): boolean {
  return elements.manualSystemDetour instanceof HTMLInputElement && elements.manualSystemDetour.checked;
}

function getSelectedSlideId(selectedSlide: StudioClientState.StudioSlide | null): string {
  return selectedSlide ? selectedSlide.id : "";
}

function updateManualDeckReferences(
  elements: StudioClientElements.Elements,
  reference: ReturnType<typeof buildManualDeckEditReference>
): void {
  elements.manualSystemReference.textContent = reference.systemReference;
  elements.manualDeleteReference.textContent = reference.deleteReference;
}

function updateCreateSlideButton(elements: StudioClientElements.Elements, isDetour: boolean, presentation: ManualSlideTypePresentation): void {
  if (elements.createSystemSlideButton) {
    elements.createSystemSlideButton.textContent = isDetour ? "Create subslide" : presentation.buttonLabel;
  }
}

export function renderManualDeckEditOptions(options: ManualSlideFormOptions): void {
  const { createDomElement, elements, selectedSlide, state } = options;
  const detourChecked = getDetourChecked(elements);
  const navigationLabels = buildSlideNavigationLabels(state.slides, state.context.deck?.navigation);
  const selectedLabel = selectedSlide ? navigationLabels.get(selectedSlide.id) || null : null;
  const reference = buildManualDeckEditReference({
    detourChecked,
    selectedLabel,
    selectedSlide
  });

  updateManualDeckSelectOptions(createDomElement, elements, state.slides);
  updateManualDeckSelectionState(elements, selectedSlide, detourChecked, state.slides.length);
  updateManualDeckReferences(elements, reference);
}

export function renderManualSlideForm(options: ManualSlideFormOptions): void {
  const { elements } = options;
  const slideType = getManualSlideType(elements.manualSystemType ? elements.manualSystemType.value : "content");
  const presentation = manualSlideTypePresentation[slideType];
  const isDetour = getDetourChecked(elements);
  elements.manualSystemAfter.disabled = isDetour;

  updateManualTextFields(elements, presentation);
  updateManualFieldVisibility(presentation);
  updateManualMaterialField(options, presentation);
  updateCreateSlideButton(elements, isDetour, presentation);
}
