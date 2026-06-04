import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import type { CurrentSlideValidation } from "./current-slide-validation-model.ts";
import type { MediaFit, MediaFocalPoint } from "./media-control-model.ts";

type JsonRecord = StudioClientState.JsonRecord;
type BusyElement = HTMLElement & {
  disabled: boolean;
};

export type Material = JsonRecord & {
  alt?: string;
  caption?: string;
  fileName?: string;
  id: string;
  provider?: string;
  title?: string;
  url?: string;
};

export type SvglLogoResult = JsonRecord & {
  assetUrl: string;
  brandUrl?: string;
  category?: string;
  id: string;
  title: string;
  variant: string;
};

type SlideSpecPayload = JsonRecord & {
  domPreview?: unknown;
  material?: Material;
  materials?: Material[];
  slideSpec?: JsonRecord;
  validation?: CurrentSlideValidation;
};

type Request = <TResponse = SlideSpecPayload>(url: string, options?: RequestInit) => Promise<TResponse>;

export type MaterialEditorActionDependencies = {
  applySlideSpecPayload: (payload: unknown, fallbackSpec: unknown) => void;
  elements: Pick<StudioClientElements.Elements,
    "fillMaterialButton" |
    "fitMaterialButton" |
    "materialAlt" |
    "materialCaption" |
    "materialDetachButton" |
    "materialFile" |
    "materialUploadButton" |
    "operationStatus" |
    "recenterMaterialButton" |
    "svglSearchButton" |
    "svglSearchQuery"
  >;
  isRecord: (value: unknown) => value is JsonRecord;
  onDomPreviewPayload: (payload: SlideSpecPayload) => void;
  onMediaValidation: (validation: CurrentSlideValidation, slideId: string) => void;
  onSlideMaterialPayloadApplied: () => void;
  onUploadComplete: () => void;
  readFileAsDataUrl: (file: File) => Promise<string | ArrayBuffer | null>;
  renderCustomVisuals: () => void;
  renderMaterials: () => void;
  renderPreviews: () => void;
  renderSlideFields: () => void;
  renderStatus: () => void;
  renderVariantComparison: () => void;
  request: Request;
  setBusy: (button: BusyElement, label: string) => () => void;
  state: StudioClientState.State;
  windowRef: Window;
};

export function createMaterialEditorActions(deps: MaterialEditorActionDependencies) {
  const {
    applySlideSpecPayload,
    elements,
    isRecord,
    onDomPreviewPayload,
    onMediaValidation,
    onSlideMaterialPayloadApplied,
    onUploadComplete,
    readFileAsDataUrl,
    renderCustomVisuals,
    renderMaterials,
    renderPreviews,
    renderSlideFields,
    renderStatus,
    renderVariantComparison,
    request,
    setBusy,
    state,
    windowRef
  } = deps;
  let svglResults: SvglLogoResult[] = [];

  function normalizeSvglResults(value: unknown): SvglLogoResult[] {
    const payload = isRecord(value) && Array.isArray(value.results) ? value.results : [];
    return payload.filter((item): item is SvglLogoResult => {
      if (!isRecord(item)) {
        return false;
      }

      return typeof item.assetUrl === "string"
        && typeof item.id === "string"
        && typeof item.title === "string"
        && typeof item.variant === "string";
    });
  }

  function applySlideMaterialPayload(payload: SlideSpecPayload, fallbackSpec: JsonRecord): void {
    applySlideSpecPayload(payload, fallbackSpec);
    onMediaValidation({
      ok: false,
      state: "draft-unchecked"
    }, state.selectedSlideId || "");
    if (payload.domPreview) {
      onDomPreviewPayload(payload);
    }
    state.materials = payload.materials || state.materials;
    renderSlideFields();
    renderPreviews();
    renderVariantComparison();
    renderStatus();
    onSlideMaterialPayloadApplied();
  }

  async function uploadMaterial(): Promise<void> {
    const file = elements.materialFile.files && elements.materialFile.files[0];
    if (!file) {
      windowRef.alert("Choose an image to upload.");
      elements.materialFile.focus();
      return;
    }

    const done = setBusy(elements.materialUploadButton, "Uploading...");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (typeof dataUrl !== "string") {
        throw new Error("Material upload did not produce a data URL.");
      }
      const payload = await request<SlideSpecPayload>("/api/v1/materials", {
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
      onUploadComplete();
      elements.operationStatus.textContent = `Uploaded material ${payload.material?.title || file.name}.`;
    } finally {
      done();
    }
  }

  async function searchSvglLogos(): Promise<void> {
    const query = elements.svglSearchQuery.value.trim();
    if (!query) {
      windowRef.alert("Enter a logo name to search.");
      elements.svglSearchQuery.focus();
      return;
    }

    const done = setBusy(elements.svglSearchButton, "Searching...");
    try {
      const payload = await request(`/api/v1/material-providers/svgl/search?query=${encodeURIComponent(query)}`);
      svglResults = normalizeSvglResults(payload);
      renderMaterials();
      elements.operationStatus.textContent = svglResults.length
        ? `Found ${svglResults.length} logo result${svglResults.length === 1 ? "" : "s"} for ${query}.`
        : `No SVGL logo results for ${query}.`;
    } finally {
      done();
    }
  }

  async function importSvglLogo(result: SvglLogoResult, button: HTMLButtonElement): Promise<void> {
    const done = setBusy(button, "Importing...");
    try {
      const payload = await request<SlideSpecPayload>("/api/v1/material-providers/svgl/import", {
        body: JSON.stringify({
          assetUrl: result.assetUrl,
          brandUrl: result.brandUrl || "",
          category: result.category || "",
          id: result.id,
          title: result.title,
          variant: result.variant
        }),
        method: "POST"
      });
      state.materials = payload.materials || state.materials;
      renderMaterials();
      onUploadComplete();
      elements.operationStatus.textContent = `Imported ${payload.material?.title || result.title} from SVGL.`;
    } finally {
      done();
    }
  }

  async function attachMaterialToSlide(material: Material, button: HTMLButtonElement | null = null): Promise<void> {
    if (!state.selectedSlideId) {
      return;
    }

    const done = button ? setBusy(button, "Attaching...") : null;
    try {
      const payload = await request<SlideSpecPayload>(`/api/v1/slides/${state.selectedSlideId}/material`, {
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
      const payload = await request<SlideSpecPayload>(`/api/v1/slides/${state.selectedSlideId}/material`, {
        body: JSON.stringify({ materialId: "" }),
        method: "POST"
      });
      applySlideMaterialPayload(payload, payload.slideSpec || state.selectedSlideSpec || {});
      elements.operationStatus.textContent = "Detached material from the selected slide.";
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
      const payload = await request<SlideSpecPayload>(`/api/v1/slides/${state.selectedSlideId}/slide-spec`, {
        body: JSON.stringify({
          rebuild: false,
          slideSpec: nextSpec
        }),
        method: "POST"
      });
      applySlideSpecPayload(payload, nextSpec);
      const validationPayload = await request<SlideSpecPayload>(`/api/v1/slides/${state.selectedSlideId}/validate-current`, {
        body: JSON.stringify({ slideSpec: nextSpec }),
        method: "POST"
      });
      onMediaValidation(validationPayload.validation || {
        ok: false,
        state: "draft-unchecked"
      }, state.selectedSlideId || "");
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

  return {
    attachMaterialToSlide,
    detachMaterialFromSlide,
    getSvglResults: () => svglResults,
    importSvglLogo,
    searchSvglLogos,
    updateSelectedMediaTreatment,
    uploadMaterial
  };
}
