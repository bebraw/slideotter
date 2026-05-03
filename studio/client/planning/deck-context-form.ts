import { StudioClientElements } from "../elements.ts";
import { StudioClientState } from "../state.ts";
import { StudioClientThemeFieldState } from "../theme-field-state.ts";
import { StudioClientValidationSettingsForm } from "../validation-settings-form.ts";

export namespace StudioClientDeckContextForm {
  export function read(documentRef: Document, elements: StudioClientElements.Elements): StudioClientState.DeckFields {
    return {
      audience: elements.deckAudience.value,
      author: elements.deckAuthor.value,
      company: elements.deckCompany.value,
      constraints: elements.deckConstraints.value,
      designConstraints: {
        maxWordsPerSlide: elements.designMaxWords.value,
        minCaptionGapIn: elements.designMinCaptionGap.value,
        minContentGapIn: elements.designMinContentGap.value,
        minFontSizePt: elements.designMinFontSize.value,
        minPanelPaddingIn: elements.designMinPanelPadding.value
      },
      lang: elements.deckLang.value,
      objective: elements.deckObjective.value,
      outline: elements.deckOutline.value,
      subject: elements.deckSubject.value,
      themeBrief: StudioClientThemeFieldState.getBrief(elements),
      title: elements.deckTitle.value,
      tone: elements.deckTone.value,
      validationSettings: StudioClientValidationSettingsForm.read(documentRef, elements),
      visualTheme: StudioClientThemeFieldState.read(elements)
    };
  }

  export function apply(documentRef: Document, elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    const designConstraints = deck.designConstraints || {};
    elements.deckTitle.value = deck.title || "";
    elements.deckAudience.value = deck.audience || "";
    elements.deckAuthor.value = deck.author || "";
    elements.deckCompany.value = deck.company || "";
    elements.deckObjective.value = deck.objective || "";
    elements.deckLang.value = deck.lang || "";
    elements.deckSubject.value = deck.subject || "";
    elements.deckTone.value = deck.tone || "";
    elements.deckConstraints.value = deck.constraints || "";
    elements.designMinFontSize.value = String(designConstraints.minFontSizePt ?? "");
    elements.designMinContentGap.value = String(designConstraints.minContentGapIn ?? "");
    elements.designMinCaptionGap.value = String(designConstraints.minCaptionGapIn ?? "");
    elements.designMinPanelPadding.value = String(designConstraints.minPanelPaddingIn ?? "");
    elements.designMaxWords.value = String(designConstraints.maxWordsPerSlide ?? "");
    StudioClientThemeFieldState.apply(documentRef, elements, deck.visualTheme || {});
    StudioClientValidationSettingsForm.apply(documentRef, elements, deck.validationSettings || {});
    StudioClientThemeFieldState.setBrief(elements, deck.themeBrief || "");
    elements.deckOutline.value = deck.outline || "";
    elements.deckStructureNote.textContent = deck.structureLabel
      ? `Applied plan: ${deck.structureLabel}. ${deck.structureSummary || "Deck structure metadata is stored with the saved context."}`
      : "Generate deck plans from the saved brief and outline, then apply one back to the outline and live slide files when it reads right.";
  }
}
