import type { StudioClientElements } from "../elements.ts";
import type { StudioClientPreferences } from "./preferences.ts";
import type { StudioClientState } from "../state.ts";

export namespace StudioClientAppTheme {
  type AppThemeApplyOptions = {
    persist?: boolean;
  };

  type AppThemePreferences = {
    loadAppTheme: () => string;
    persistAppTheme: (theme: StudioClientPreferences.AppTheme) => void;
  };

  export function createAppTheme({
    document,
    elements,
    preferences,
    state
  }: {
    document: Document;
    elements: StudioClientElements.Elements;
    preferences: AppThemePreferences;
    state: StudioClientState.State;
  }) {
    function load(): string {
      return preferences.loadAppTheme();
    }

    function persist(): void {
      preferences.persistAppTheme(state.ui.appTheme === "dark" ? "dark" : "light");
    }

    function apply(theme: string, options: AppThemeApplyOptions = {}): void {
      state.ui.appTheme = theme === "dark" ? "dark" : "light";
      document.documentElement.dataset.appTheme = state.ui.appTheme;
      document.documentElement.style.colorScheme = state.ui.appTheme;

      const isDark = state.ui.appTheme === "dark";
      elements.themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
      elements.themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      elements.themeToggleLabel.textContent = isDark ? "Dark" : "Light";

      if (options.persist) {
        persist();
      }
    }

    function toggle(): void {
      apply(state.ui.appTheme === "dark" ? "light" : "dark", { persist: true });
    }

    function mount(): void {
      elements.themeToggle.addEventListener("click", toggle);
    }

    return {
      apply,
      load,
      mount,
      persist,
      toggle
    };
  }
}
