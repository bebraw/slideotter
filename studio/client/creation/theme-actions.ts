import { StudioClientContextPayloadState } from "../api/context-payload-state.ts";
import { StudioClientCore } from "../core/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientCreationThemeState } from "./creation-theme-state.ts";
import { StudioClientPresentationCreationWorkbench } from "./presentation-creation-workbench.ts";
import { StudioClientThemeCandidateState } from "./theme-candidate-state.ts";
import { StudioClientThemeFieldState } from "./theme-field-state.ts";

export namespace StudioClientThemeActions {
  type JsonRecord = StudioClientState.JsonRecord;
  type ContextPayload = JsonRecord & StudioClientContextPayloadState.ContextPayload;
  type DeckThemeFields = StudioClientThemeFieldState.DeckThemeFields;
  type ThemeSavePayload = JsonRecord & StudioClientCreationThemeState.ThemeSavePayload;
  type PresentationCreationWorkbench = ReturnType<typeof StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench>;
  type ThemeWorkbench = {
    getSelectedVariant: () => StudioClientCreationThemeState.ThemeVariant;
    resetCandidates: () => void;
  };

  export type PersistThemeOptions = {
    closeDrawer?: boolean;
  };

  export type ThemeActionsOptions = {
    buildDeck: () => Promise<unknown>;
    elements: StudioClientElements.Elements;
    getThemeWorkbench: () => ThemeWorkbench | null;
    presentationCreationWorkbench: PresentationCreationWorkbench;
    renderCreationThemeStage: () => void;
    renderPreviews: () => void;
    renderSavedThemes: () => void;
    request: <T>(url: string, options?: StudioClientCore.JsonRequestOptions) => Promise<T>;
    setBusy: (button: HTMLElement & { disabled: boolean }, label: string) => () => void;
    setThemeDrawerOpen: (open: boolean) => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type ThemeActions = {
    applyCreationTheme: (theme: DeckThemeFields | undefined) => void;
    applyDeckThemeFields: (theme?: DeckThemeFields) => void;
    applySavedTheme: (themeId: string) => void;
    applySavedThemeToDeck: (themeId: string | undefined) => void;
    getDeckThemeBriefValue: () => string;
    getDeckVisualThemeFromFields: () => DeckThemeFields;
    getSelectedCreationThemeVariant: () => StudioClientCreationThemeState.ThemeVariant;
    persistSelectedThemeToDeck: (options?: PersistThemeOptions) => Promise<void>;
    resetThemeCandidates: () => void;
    saveDeckTheme: () => Promise<void>;
    savePresentationTheme: () => Promise<void>;
    setDeckThemeBriefValue: (value: unknown) => void;
  };

  export function createThemeActions({
    buildDeck,
    elements,
    getThemeWorkbench,
    presentationCreationWorkbench,
    renderCreationThemeStage,
    renderPreviews,
    renderSavedThemes,
    request,
    setBusy,
    setThemeDrawerOpen,
    state,
    windowRef
  }: ThemeActionsOptions): ThemeActions {
    function getDeckVisualThemeFromFields(): DeckThemeFields {
      return StudioClientThemeFieldState.read(elements);
    }

    function applyDeckThemeFields(theme: DeckThemeFields = {}): void {
      StudioClientThemeFieldState.apply(windowRef.document, elements, theme);
    }

    function applyCreationTheme(theme: DeckThemeFields | undefined): void {
      applyDeckThemeFields(theme || {});
      renderCreationThemeStage();
    }

    function getSelectedCreationThemeVariant(): StudioClientCreationThemeState.ThemeVariant {
      return StudioClientCreationThemeState.getSelectedThemeVariant(
        getThemeWorkbench()?.getSelectedVariant(),
        getDeckVisualThemeFromFields()
      );
    }

    function resetThemeCandidates(): void {
      StudioClientThemeCandidateState.resetCandidates(state);
      getThemeWorkbench()?.resetCandidates();
    }

    return {
      applyCreationTheme,
      applyDeckThemeFields,
      applySavedTheme: (themeId: string) => {
        const theme = StudioClientCreationThemeState.getSavedThemeFields(state.savedThemes, themeId);
        if (!theme) {
          return;
        }

        presentationCreationWorkbench.applyFields({
          ...presentationCreationWorkbench.getFields(),
          visualTheme: theme
        });
      },
      applySavedThemeToDeck: (themeId: string | undefined) => {
        const theme = StudioClientCreationThemeState.getSavedThemeFields(state.savedThemes, themeId);
        if (!theme) {
          return;
        }

        applyDeckThemeFields(theme);
        resetThemeCandidates();
        renderCreationThemeStage();
      },
      getDeckThemeBriefValue: () => StudioClientThemeFieldState.getBrief(elements),
      getDeckVisualThemeFromFields,
      getSelectedCreationThemeVariant,
      persistSelectedThemeToDeck: async (options: PersistThemeOptions = {}) => {
        const theme = getSelectedCreationThemeVariant().theme;
        applyCreationTheme(theme);
        const { StudioClientDeckContextForm } = await import("../planning/deck-context-form.ts");
        const payload = await request<ContextPayload>("/api/context", {
          body: JSON.stringify({
            deck: StudioClientDeckContextForm.read(windowRef.document, elements)
          }),
          method: "POST"
        });
        StudioClientContextPayloadState.applyContextPayload(state, payload);
        renderCreationThemeStage();
        renderPreviews();
        await buildDeck();
        if (options.closeDrawer) {
          setThemeDrawerOpen(false);
        }
        elements.operationStatus.textContent = "Theme applied to the active deck.";
      },
      resetThemeCandidates,
      saveDeckTheme: async () => {
        const selectedVariant = getSelectedCreationThemeVariant();
        const name = selectedVariant && selectedVariant.label && selectedVariant.id !== "current"
          ? selectedVariant.label
          : elements.deckTitle.value.trim() || "Current theme";
        const done = setBusy(elements.saveDeckThemeButton, "Saving...");
        try {
          const payload = await request<ThemeSavePayload>("/api/themes/save", {
            body: JSON.stringify({
              name,
              theme: getDeckVisualThemeFromFields()
            }),
            method: "POST"
          });
          StudioClientCreationThemeState.applyThemeSavePayload(state, payload);
          renderSavedThemes();
          elements.operationStatus.textContent = `Saved theme "${name}" for reuse.`;
        } finally {
          done();
        }
      },
      savePresentationTheme: async () => {
        const name = elements.presentationThemeName.value.trim() || elements.presentationTitle.value.trim() || "Saved theme";
        const done = elements.savePresentationThemeButton ? setBusy(elements.savePresentationThemeButton, "Saving...") : () => {};
        try {
          const payload = await request<ThemeSavePayload>("/api/themes/save", {
            body: JSON.stringify({
              name,
              theme: presentationCreationWorkbench.getFields().visualTheme
            }),
            method: "POST"
          });
          const savedTheme = StudioClientCreationThemeState.applyThemeSavePayload(state, payload);
          renderSavedThemes();
          elements.presentationSavedTheme.value = savedTheme ? savedTheme.id : "";
          elements.presentationCreationStatus.textContent = `Saved theme "${name}" for reuse.`;
        } finally {
          done();
        }
      },
      setDeckThemeBriefValue: (value: unknown) => {
        StudioClientThemeFieldState.setBrief(elements, value);
      }
    };
  }
}
