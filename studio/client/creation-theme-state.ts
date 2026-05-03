import { StudioClientState } from "./state.ts";
import { StudioClientThemeFieldState } from "./theme-field-state.ts";

export namespace StudioClientCreationThemeState {
  export type DeckThemeFields = StudioClientThemeFieldState.DeckThemeFields;

  export type ThemeVariant = {
    id: string;
    label: string;
    note?: string;
    theme: DeckThemeFields;
  };

  export function getSavedThemeFields(
    savedThemes: StudioClientState.SavedTheme[],
    themeId: string | undefined
  ): DeckThemeFields | null {
    const savedTheme = savedThemes.find((theme) => theme.id === themeId);
    return savedTheme && savedTheme.theme ? savedTheme.theme : null;
  }

  export function getSelectedThemeVariant(
    selectedVariant: ThemeVariant | null | undefined,
    currentTheme: DeckThemeFields
  ): ThemeVariant {
    return selectedVariant || {
      id: "current",
      label: "Current",
      note: "Use the selected controls.",
      theme: currentTheme
    };
  }
}
