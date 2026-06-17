import { getBrief as getThemeBrief, setBrief as setThemeBrief } from "./theme-field-brief.ts";
import { apply as applyThemeFields, read as readThemeFields } from "./theme-field-values.ts";
import type { DeckThemeFields as ImportedDeckThemeFields } from "./theme-field-types.ts";
import type { StudioClientElements } from "../core/elements.ts";

export namespace StudioClientThemeFieldState {
  export type DeckThemeFields = ImportedDeckThemeFields;

  export function read(elements: StudioClientElements.Elements): DeckThemeFields {
    return readThemeFields(elements);
  }

  export function apply(documentRef: Document, elements: StudioClientElements.Elements, theme: DeckThemeFields = {}): void {
    applyThemeFields(documentRef, elements, theme);
  }

  export function setBrief(elements: StudioClientElements.Elements, value: unknown): void {
    setThemeBrief(elements, value);
  }

  export function getBrief(elements: StudioClientElements.Elements): string {
    return getThemeBrief(elements);
  }
}
