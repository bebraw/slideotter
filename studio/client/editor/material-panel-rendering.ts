import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import { validationDetail, validationLabel, type CurrentSlideValidation } from "./current-slide-validation-model.ts";
import type { Material, SvglLogoResult } from "./material-editor-actions.ts";
import { buildMediaControlState } from "./media-control-model.ts";
import { errorMessage, isRecord, toMaterial } from "./slide-editor-payload.ts";

type JsonRecord = StudioClientState.JsonRecord;

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

type MaterialPanelActions = {
  attachMaterialToSlide: (material: Material, button: HTMLButtonElement) => Promise<unknown>;
  getSvglResults: () => SvglLogoResult[];
  importSvglLogo: (result: SvglLogoResult, button: HTMLButtonElement) => Promise<unknown>;
};

type RenderMaterialsOptions = {
  createDomElement: CreateDomElement;
  elements: StudioClientElements.Elements;
  getMediaValidation: () => CurrentSlideValidation;
  getMediaValidationSlideId: () => string;
  materialEditorActions: MaterialPanelActions;
  renderManualSlideForm: () => void;
  setMediaValidation: (validation: CurrentSlideValidation, slideId: string) => void;
  state: StudioClientState.State;
  windowRef: Window;
};

function getSelectedSlideMaterialId(state: StudioClientState.State): string {
  const media = state.selectedSlideSpec && isRecord(state.selectedSlideSpec.media) ? state.selectedSlideSpec.media : null;
  return typeof media?.id === "string"
    ? media.id
    : "";
}

function getSelectedSlideMedia(state: StudioClientState.State): JsonRecord | null {
  return state.selectedSlideSpec && isRecord(state.selectedSlideSpec.media)
    ? state.selectedSlideSpec.media
    : null;
}

function renderMediaValidation(options: RenderMaterialsOptions): void {
  const slideId = options.state.selectedSlideId || "";
  if (options.getMediaValidationSlideId() !== slideId) {
    options.setMediaValidation({
      ok: false,
      state: "draft-unchecked"
    }, slideId);
  }

  const mediaValidation = options.getMediaValidation();
  const stateName = mediaValidation.state || "draft-unchecked";
  const firstIssue = Array.isArray(mediaValidation.issues) ? mediaValidation.issues[0] : null;
  options.elements.materialValidation.dataset.state = stateName;
  options.elements.materialValidation.replaceChildren(
    options.createDomElement("strong", { text: validationLabel(mediaValidation) }),
    options.createDomElement("span", {
      text: firstIssue && (firstIssue.message || firstIssue.rule)
        ? firstIssue.message || firstIssue.rule
        : validationDetail(mediaValidation)
    })
  );
}

function renderSvglResults(options: RenderMaterialsOptions): void {
  const { createDomElement, elements, materialEditorActions, windowRef } = options;
  const results = materialEditorActions.getSvglResults();
  if (!results.length) {
    elements.svglResults.replaceChildren(createDomElement("span", {
      className: "provider-search-empty",
      text: "Search SVGL to import a logo as presentation material."
    }));
    return;
  }

  elements.svglResults.replaceChildren();
  results.forEach((result: SvglLogoResult) => {
    const buttonElement = createDomElement("button", {
      attributes: {
        type: "button"
      },
      className: "secondary",
      text: "Import"
    });
    if (!(buttonElement instanceof HTMLButtonElement)) {
      return;
    }
    const button = buttonElement;
    const item = createDomElement("article", { className: "svgl-result-card" }, [
      createDomElement("img", {
        attributes: {
          alt: `${result.title} logo`,
          src: result.assetUrl
        }
      }),
      createDomElement("div", { className: "material-card-copy" }, [
        createDomElement("strong", { text: result.variant === "default" ? result.title : `${result.title} (${result.variant})` }),
        createDomElement("span", { text: result.category || result.brandUrl || "SVGL logo" })
      ]),
      button
    ]);
    button.addEventListener("click", () => materialEditorActions.importSvglLogo(result, button).catch((error) => windowRef.alert(errorMessage(error))));
    elements.svglResults.appendChild(item);
  });
}

export function renderMaterials(options: RenderMaterialsOptions): void {
  const { createDomElement, elements, materialEditorActions, renderManualSlideForm, state, windowRef } = options;
  if (!elements.materialList) {
    return;
  }

  const materials = (Array.isArray(state.materials) ? state.materials : [])
    .map(toMaterial)
    .filter((material): material is Material => Boolean(material));
  const selectedMaterialId = getSelectedSlideMaterialId(state);
  const selectedMedia = getSelectedSlideMedia(state);
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
  renderMediaValidation(options);
  renderSvglResults(options);

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
    const buttonElement = createDomElement("button", {
      attributes: {
        type: "button"
      },
      className: "secondary",
      disabled: !state.selectedSlideId || attached,
      text: attached ? "Attached" : "Attach"
    });
    if (!(buttonElement instanceof HTMLButtonElement)) {
      return;
    }
    const button = buttonElement;
    const item = createDomElement("article", {
      className: `material-card${attached ? " active" : ""}${material.provider === "svgl" ? " logo-material" : ""}`
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
    button.addEventListener("click", () => materialEditorActions.attachMaterialToSlide(material, button).catch((error) => windowRef.alert(errorMessage(error))));
    elements.materialList.appendChild(item);
  });

  renderManualSlideForm();
}
