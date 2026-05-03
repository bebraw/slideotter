import type { StudioClientState } from "../core/state";
import type { CustomVisual } from "./custom-visual-model.ts";
import type { CurrentSlideValidation } from "./current-slide-validation-model.ts";
import type { Material } from "./material-editor-actions.ts";

export type SlideSpecPayload = StudioClientState.JsonRecord & {
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
  slideSpec?: StudioClientState.JsonRecord;
  slideSpecError?: string | null;
  source?: string;
  structured?: boolean;
  validation?: CurrentSlideValidation;
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isRecord(value: unknown): value is StudioClientState.JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function toMaterial(value: StudioClientState.JsonRecord): Material | null {
  return typeof value.id === "string" ? { ...value, id: value.id } : null;
}

export function toSlideSpecPayload(value: unknown): SlideSpecPayload {
  return isRecord(value) ? value : {};
}
