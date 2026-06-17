import type { StudioClientElements } from "../core/elements.ts";
import type { DeckThemeFields } from "./theme-field-types.ts";

const knownFontValues = ["avenir", "editorial", "workshop", "mono"];
const fontAliases: Array<{ match: RegExp; value: string }> = [
  { match: /georgia|times new roman/, value: "editorial" },
  { match: /trebuchet|verdana/, value: "workshop" },
  { match: /sfmono|consolas|liberation mono/, value: "mono" }
];

type FontValueResolver = (value: unknown, normalized: string) => string | undefined;

function toColorInputValue(value: unknown, fallback = "#000000"): string {
  const normalized = String(value || "").trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : fallback;
}

function knownFontValue(_value: unknown, normalized: string): string | undefined {
  if (knownFontValues.includes(normalized)) {
    return normalized;
  }
}

function aliasFontValue(_value: unknown, normalized: string): string | undefined {
  const alias = fontAliases.find((entry) => entry.match.test(normalized));
  if (alias) {
    return alias.value;
  }
}

function customFontValue(value: unknown): string {
  return String(value || "").trim() || "avenir";
}

const fontValueResolvers: FontValueResolver[] = [knownFontValue, aliasFontValue, customFontValue];

function toFontSelectValue(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase();
  for (const resolveFontValue of fontValueResolvers) {
    const resolved = resolveFontValue(value, normalized);
    if (resolved) {
      return resolved;
    }
  }
  return "avenir";
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
