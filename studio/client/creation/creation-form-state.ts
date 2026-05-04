import type { StudioClientElements } from "../core/elements";

export type CreationFields = {
  audience?: string;
  constraints?: string;
  imageSearch?: {
    count?: number;
    provider?: string;
    query?: string;
    restrictions?: string;
  };
  lang?: string;
  objective?: string;
  presentationSourceUrls?: string;
  presentationSourceText?: string;
  sourcingStyle?: string;
  targetSlideCount?: number | string | null;
  themeBrief?: string;
  title?: string;
  tone?: string;
  visualTheme?: {
    accent?: string;
    bg?: string;
    fontFamily?: string;
    panel?: string;
    primary?: string;
    progressFill?: string;
    progressTrack?: string;
    secondary?: string;
  };
};

type CreationInputElement = StudioClientElements.StudioElement;
const defaultTargetSlideCount = "5";

function ensureFontOption(select: CreationInputElement, value: string): void {
  if (!value || Array.from(select.options).some((option) => option.value === value)) {
    return;
  }
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `Site font (${value})`;
  option.dataset.customFont = "true";
  select.append(option);
}

export function getCreationFields(elements: StudioClientElements.Elements): CreationFields {
  const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);
  return {
    audience: elements.presentationAudience.value.trim(),
    constraints: elements.presentationConstraints.value.trim(),
    imageSearch: {
      count: 3,
      provider: elements.presentationImageSearchProvider.value,
      query: elements.presentationImageSearchQuery.value.trim(),
      restrictions: elements.presentationImageSearchRestrictions.value.trim()
    },
    lang: elements.presentationLanguage.value.trim(),
    objective: elements.presentationObjective.value.trim(),
    presentationSourceUrls: (elements.presentationSourceUrls.value || elements.presentationOutlineSourceUrls.value || "").trim(),
    presentationSourceText: (elements.presentationSourceText.value || elements.presentationOutlineSourceText.value || "").trim(),
    sourcingStyle: elements.presentationSourcingStyle ? elements.presentationSourcingStyle.value : "grounded",
    targetSlideCount: Number.isFinite(targetSlideCount) ? targetSlideCount : null,
    themeBrief: elements.presentationThemeBrief ? elements.presentationThemeBrief.value.trim() : "",
    title: elements.presentationTitle.value.trim(),
    tone: elements.presentationTone.value.trim(),
    visualTheme: {
      accent: elements.presentationThemeAccent ? elements.presentationThemeAccent.value : "#7c3aed",
      bg: elements.presentationThemeBg ? elements.presentationThemeBg.value : "#fff7ed",
      fontFamily: elements.presentationFontFamily ? elements.presentationFontFamily.value : "Avenir Next",
      panel: elements.presentationThemePanel ? elements.presentationThemePanel.value : "#ffffff",
      primary: elements.presentationThemePrimary ? elements.presentationThemePrimary.value : "#1f2937",
      progressFill: elements.presentationThemeSecondary.value,
      progressTrack: elements.presentationThemeBg.value,
      secondary: elements.presentationThemeSecondary ? elements.presentationThemeSecondary.value : "#f97316"
    }
  };
}

export function getCreationInputElements(elements: StudioClientElements.Elements): CreationInputElement[] {
  return [
    elements.presentationTitle,
    elements.presentationAudience,
    elements.presentationTone,
    elements.presentationTargetSlides,
    elements.presentationLanguage,
    elements.presentationObjective,
    elements.presentationConstraints,
    elements.presentationSourcingStyle,
    elements.presentationThemeBrief,
    elements.presentationSourceUrls,
    elements.presentationOutlineSourceUrls,
    elements.presentationSourceText,
    elements.presentationOutlineSourceText,
    elements.presentationMaterialFile,
    elements.presentationImageSearchQuery,
    elements.presentationImageSearchProvider,
    elements.presentationImageSearchRestrictions,
    elements.presentationSavedTheme,
    elements.presentationFontFamily,
    elements.presentationThemePrimary,
    elements.presentationThemeSecondary,
    elements.presentationThemeAccent,
    elements.presentationThemeBg,
    elements.presentationThemePanel,
    elements.presentationThemeName
  ].filter((element): element is CreationInputElement => Boolean(element));
}

export function isOutlineRelevantInput(elements: StudioClientElements.Elements, element: CreationInputElement): boolean {
  return [
    elements.presentationTitle,
    elements.presentationAudience,
    elements.presentationTone,
    elements.presentationTargetSlides,
    elements.presentationLanguage,
    elements.presentationObjective,
    elements.presentationConstraints,
    elements.presentationSourcingStyle,
    elements.presentationSourceUrls,
    elements.presentationOutlineSourceUrls,
    elements.presentationSourceText,
    elements.presentationOutlineSourceText,
    elements.presentationImageSearchQuery,
    elements.presentationImageSearchProvider,
    elements.presentationImageSearchRestrictions
  ].includes(element);
}

export function isCreationThemeElement(elements: StudioClientElements.Elements, element: CreationInputElement): boolean {
  return [
    elements.presentationFontFamily,
    elements.presentationThemePrimary,
    elements.presentationThemeSecondary,
    elements.presentationThemeAccent,
    elements.presentationThemeBg,
    elements.presentationThemePanel
  ].includes(element);
}

export function syncCreationSourceFields(elements: StudioClientElements.Elements, element: CreationInputElement): void {
  if (element === elements.presentationOutlineSourceUrls) {
    elements.presentationSourceUrls.value = elements.presentationOutlineSourceUrls.value;
  }
  if (element === elements.presentationSourceUrls) {
    elements.presentationOutlineSourceUrls.value = elements.presentationSourceUrls.value;
  }
  if (element === elements.presentationOutlineSourceText) {
    elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
  }
  if (element === elements.presentationSourceText) {
    elements.presentationOutlineSourceText.value = elements.presentationSourceText.value;
  }
}

export function clearCreationForm(elements: StudioClientElements.Elements): void {
  elements.presentationTitle.value = "";
  elements.presentationAudience.value = "";
  elements.presentationTone.value = "";
  elements.presentationTargetSlides.value = defaultTargetSlideCount;
  elements.presentationLanguage.value = "";
  elements.presentationObjective.value = "";
  elements.presentationConstraints.value = "";
  elements.presentationSourcingStyle.value = "";
  elements.presentationThemeBrief.value = "";
  elements.presentationSourceUrls.value = "";
  elements.presentationOutlineSourceUrls.value = "";
  elements.presentationSourceText.value = "";
  elements.presentationOutlineSourceText.value = "";
  elements.presentationMaterialFile.value = "";
  elements.presentationImageSearchQuery.value = "";
  elements.presentationImageSearchProvider.value = "openverse";
  elements.presentationImageSearchRestrictions.value = "";
  elements.presentationFontFamily.value = "avenir";
  elements.presentationThemePrimary.value = "#183153";
  elements.presentationThemeSecondary.value = "#275d8c";
  elements.presentationThemeAccent.value = "#f28f3b";
  elements.presentationThemeBg.value = "#f5f8fc";
  elements.presentationThemePanel.value = "#f8fbfe";
  elements.presentationThemeName.value = "";
  elements.presentationSavedTheme.value = "";
}

export function applyCreationFields(elements: StudioClientElements.Elements, fields: CreationFields = {}): void {
  elements.presentationTitle.value = fields.title || "";
  elements.presentationAudience.value = fields.audience || "";
  elements.presentationTone.value = fields.tone || "";
  elements.presentationTargetSlides.value = fields.targetSlideCount ? String(fields.targetSlideCount) : defaultTargetSlideCount;
  elements.presentationLanguage.value = fields.lang || "";
  elements.presentationObjective.value = fields.objective || "";
  elements.presentationConstraints.value = fields.constraints || "";
  if (elements.presentationSourcingStyle) {
    elements.presentationSourcingStyle.value = fields.sourcingStyle || "";
  }
  if (elements.presentationThemeBrief) {
    elements.presentationThemeBrief.value = fields.themeBrief || "";
  }
  if (elements.presentationSourceUrls) {
    elements.presentationSourceUrls.value = fields.presentationSourceUrls || "";
  }
  if (elements.presentationOutlineSourceUrls) {
    elements.presentationOutlineSourceUrls.value = fields.presentationSourceUrls || "";
  }
  if (elements.presentationSourceText) {
    elements.presentationSourceText.value = fields.presentationSourceText || "";
  }
  if (elements.presentationOutlineSourceText) {
    elements.presentationOutlineSourceText.value = fields.presentationSourceText || "";
  }
  if (elements.presentationImageSearchQuery) {
    elements.presentationImageSearchQuery.value = fields.imageSearch && fields.imageSearch.query || "";
  }
  if (elements.presentationImageSearchProvider) {
    elements.presentationImageSearchProvider.value = fields.imageSearch && fields.imageSearch.provider || "openverse";
  }
  if (elements.presentationImageSearchRestrictions) {
    elements.presentationImageSearchRestrictions.value = fields.imageSearch && fields.imageSearch.restrictions || "";
  }

  const theme = fields.visualTheme || {};
  if (elements.presentationFontFamily) {
    const fontFamily = theme.fontFamily || "avenir";
    ensureFontOption(elements.presentationFontFamily, fontFamily);
    elements.presentationFontFamily.value = fontFamily;
  }
  if (elements.presentationThemePrimary) {
    elements.presentationThemePrimary.value = theme.primary || "#183153";
  }
  if (elements.presentationThemeSecondary) {
    elements.presentationThemeSecondary.value = theme.secondary || "#275d8c";
  }
  if (elements.presentationThemeAccent) {
    elements.presentationThemeAccent.value = theme.accent || "#f28f3b";
  }
  if (elements.presentationThemeBg) {
    elements.presentationThemeBg.value = theme.bg || "#f5f8fc";
  }
  if (elements.presentationThemePanel) {
    elements.presentationThemePanel.value = theme.panel || "#f8fbfe";
  }
}
