export namespace StudioClientAppTheme {
  type AppThemeApplyOptions = {
    persist?: boolean;
  };

  export function createAppTheme({ document, elements, preferences, state }) {
    function load() {
      return preferences.loadAppTheme();
    }

    function persist() {
      preferences.persistAppTheme(state.ui.appTheme);
    }

    function apply(theme, options: AppThemeApplyOptions = {}) {
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

    function toggle() {
      apply(state.ui.appTheme === "dark" ? "light" : "dark", { persist: true });
    }

    function mount() {
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
