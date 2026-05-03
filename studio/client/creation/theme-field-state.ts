import { StudioClientElements } from "../elements.ts";
import { StudioClientState } from "../state.ts";

export namespace StudioClientThemeFieldState {
  export type DeckThemeFields = StudioClientState.VisualTheme;

  function toColorInputValue(value: unknown, fallback = "#000000"): string {
    const normalized = String(value || "").trim().replace(/^#/, "");
    return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : fallback;
  }

  function toFontSelectValue(value: unknown): string {
    const normalized = String(value || "").trim().toLowerCase();
    if (["avenir", "editorial", "workshop", "mono"].includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("georgia") || normalized.includes("times new roman")) {
      return "editorial";
    }
    if (normalized.includes("trebuchet") || normalized.includes("verdana")) {
      return "workshop";
    }
    if (normalized.includes("sfmono") || normalized.includes("consolas") || normalized.includes("liberation mono")) {
      return "mono";
    }
    const customFont = String(value || "").trim();
    return customFont || "avenir";
  }

  function ensureFontOption(documentRef: Document, elements: StudioClientElements.Elements, value: string): void {
    if (Array.from(elements.themeFontFamily.options).some((option) => option.value === value)) {
      return;
    }
    const option = documentRef.createElement("option");
    option.value = value;
    option.textContent = `Site font (${value})`;
    option.dataset.customFont = "true";
    elements.themeFontFamily.append(option);
  }

  export function read(elements: StudioClientElements.Elements): DeckThemeFields {
    return {
      accent: elements.themeAccent.value,
      bg: elements.themeBg.value,
      fontFamily: elements.themeFontFamily.value,
      light: elements.themeLight.value,
      muted: elements.themeMuted.value,
      panel: elements.themePanel.value,
      primary: elements.themePrimary.value,
      progressFill: elements.themeProgressFill.value,
      progressTrack: elements.themeProgressTrack.value,
      secondary: elements.themeSecondary.value,
      surface: elements.themeSurface.value
    };
  }

  export function apply(documentRef: Document, elements: StudioClientElements.Elements, theme: DeckThemeFields = {}): void {
    const fontValue = toFontSelectValue(theme.fontFamily);
    ensureFontOption(documentRef, elements, fontValue);
    elements.themeFontFamily.value = fontValue;
    elements.themePrimary.value = toColorInputValue(theme.primary, "#183153");
    elements.themeSecondary.value = toColorInputValue(theme.secondary, "#275d8c");
    elements.themeAccent.value = toColorInputValue(theme.accent, "#f28f3b");
    elements.themeMuted.value = toColorInputValue(theme.muted, "#56677c");
    elements.themeLight.value = toColorInputValue(theme.light, "#d7e6f5");
    elements.themeBg.value = toColorInputValue(theme.bg, "#f5f8fc");
    elements.themePanel.value = toColorInputValue(theme.panel, "#f8fbfe");
    elements.themeSurface.value = toColorInputValue(theme.surface, "#ffffff");
    elements.themeProgressTrack.value = toColorInputValue(theme.progressTrack, "#d7e6f5");
    elements.themeProgressFill.value = toColorInputValue(theme.progressFill, "#275d8c");
  }

  export function setBrief(elements: StudioClientElements.Elements, value: unknown): void {
    const nextValue = String(value || "");
    elements.deckThemeBrief.value = nextValue;
    if (elements.themeBrief) {
      elements.themeBrief.value = nextValue;
    }
  }

  export function getBrief(elements: StudioClientElements.Elements): string {
    return String(elements.themeBrief ? elements.themeBrief.value : elements.deckThemeBrief.value || "");
  }
}
