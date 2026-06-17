import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { getBrief, setBrief } from "../creation/theme-field-brief.ts";
import { apply as applyThemeFields, read as readThemeFields } from "../creation/theme-field-values.ts";
import { StudioClientValidationSettingsForm } from "../runtime/validation-settings-form.ts";

type DeckTextFieldBinding = {
  deckField: keyof Pick<
    StudioClientState.DeckFields,
    "audience" | "author" | "company" | "constraints" | "lang" | "objective" | "subject" | "title" | "tone"
  >;
  element: keyof Pick<
    StudioClientElements.Elements,
    | "deckAudience"
    | "deckAuthor"
    | "deckCompany"
    | "deckConstraints"
    | "deckLang"
    | "deckObjective"
    | "deckSubject"
    | "deckTitle"
    | "deckTone"
  >;
};

type DesignConstraintBinding = {
  constraint: keyof StudioClientState.DesignConstraints;
  element: keyof Pick<
    StudioClientElements.Elements,
    | "designMaxWords"
    | "designMinCaptionGap"
    | "designMinContentGap"
    | "designMinFontSize"
    | "designMinPanelPadding"
  >;
};

const deckTextFieldBindings: DeckTextFieldBinding[] = [
  { deckField: "title", element: "deckTitle" },
  { deckField: "audience", element: "deckAudience" },
  { deckField: "author", element: "deckAuthor" },
  { deckField: "company", element: "deckCompany" },
  { deckField: "objective", element: "deckObjective" },
  { deckField: "lang", element: "deckLang" },
  { deckField: "subject", element: "deckSubject" },
  { deckField: "tone", element: "deckTone" },
  { deckField: "constraints", element: "deckConstraints" }
];

const designConstraintBindings: DesignConstraintBinding[] = [
  { constraint: "minFontSizePt", element: "designMinFontSize" },
  { constraint: "minContentGapIn", element: "designMinContentGap" },
  { constraint: "minCaptionGapIn", element: "designMinCaptionGap" },
  { constraint: "minPanelPaddingIn", element: "designMinPanelPadding" },
  { constraint: "maxWordsPerSlide", element: "designMaxWords" }
];

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
      themeBrief: getBrief(elements),
      title: elements.deckTitle.value,
      tone: elements.deckTone.value,
      validationSettings: StudioClientValidationSettingsForm.read(documentRef, elements),
      visualTheme: readThemeFields(elements)
    };
  }

  function applyDeckTextFields(elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    for (const binding of deckTextFieldBindings) {
      elements[binding.element].value = deck[binding.deckField] || "";
    }
  }

  function applyDesignConstraintFields(elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    const designConstraints = deck.designConstraints || {};
    for (const binding of designConstraintBindings) {
      elements[binding.element].value = String(designConstraints[binding.constraint] ?? "");
    }
  }

  function applyDeckStructureNote(elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    elements.deckStructureNote.textContent = deck.structureLabel
      ? `Applied plan: ${deck.structureLabel}. ${deck.structureSummary || "Deck structure metadata is stored with the saved context."}`
      : "Generate deck plans from the saved brief and outline, then apply one back to the outline and live slide files when it reads right.";
  }

  function applyDeckTheme(documentRef: Document, elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    applyThemeFields(documentRef, elements, deck.visualTheme || {});
  }

  function applyValidationSettings(documentRef: Document, elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    StudioClientValidationSettingsForm.apply(documentRef, elements, deck.validationSettings || {});
  }

  function applyDeckBrief(elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    setBrief(elements, deck.themeBrief || "");
  }

  function applyDeckOutline(elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    elements.deckOutline.value = deck.outline || "";
  }

  export function apply(documentRef: Document, elements: StudioClientElements.Elements, deck: StudioClientState.DeckFields): void {
    applyDeckTextFields(elements, deck);
    applyDesignConstraintFields(elements, deck);
    applyDeckTheme(documentRef, elements, deck);
    applyValidationSettings(documentRef, elements, deck);
    applyDeckBrief(elements, deck);
    applyDeckOutline(elements, deck);
    applyDeckStructureNote(elements, deck);
  }
}
