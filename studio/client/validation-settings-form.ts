import { StudioClientElements } from "./elements.ts";

export namespace StudioClientValidationSettingsForm {
  export type ValidationSettings = {
    mediaValidationMode?: string;
    rules?: Record<string, unknown>;
  };

  function getRuleSelects(documentRef: Document): HTMLSelectElement[] {
    return Array.from(documentRef.querySelectorAll<HTMLSelectElement>("[data-validation-rule]"));
  }

  export function apply(
    documentRef: Document,
    elements: StudioClientElements.Elements,
    validationSettings: ValidationSettings
  ): void {
    const validationRules = validationSettings.rules || {};
    elements.validationMediaMode.value = String(validationSettings.mediaValidationMode || "fast");
    getRuleSelects(documentRef).forEach((element) => {
      const rule = element.dataset.validationRule;
      element.value = rule ? String(validationRules[rule] || "warning") : "warning";
    });
  }

  export function read(documentRef: Document, elements: StudioClientElements.Elements): ValidationSettings {
    return {
      mediaValidationMode: String(elements.validationMediaMode.value),
      rules: Object.fromEntries(
        getRuleSelects(documentRef).map((element) => [
          element.dataset.validationRule,
          element.value
        ])
      )
    };
  }
}
