namespace StudioClientPreferences {
  const drawerKeys = {
    assistant: "studio.assistantDrawerOpen",
    context: "studio.contextDrawerOpen",
    structuredDraft: "studio.structuredDraftDrawerOpen"
  };

  export function loadDrawerOpen(key) {
    try {
      return window.localStorage.getItem(drawerKeys[key]) === "true";
    } catch (error) {
      return false;
    }
  }

  export function persistDrawerOpen(key, open) {
    try {
      window.localStorage.setItem(drawerKeys[key], String(open));
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }
  }

  export function loadCurrentPage() {
    const hash = typeof window.location.hash === "string" ? window.location.hash.replace(/^#/, "") : "";
    if (hash === "presentations") {
      return "presentations";
    }
    if (hash === "planning") {
      return "planning";
    }
    if (hash === "layout-studio") {
      return "layout-studio";
    }
    if (hash === "studio") {
      return "studio";
    }

    return "presentations";
  }

  export function persistCurrentPage(page) {
    try {
      window.localStorage.setItem("studio.currentPage", page);
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }
  }

  export function loadAppTheme() {
    try {
      const value = window.localStorage.getItem("studio.appTheme");
      if (value === "dark" || value === "light") {
        return value;
      }
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }

    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  export function persistAppTheme(theme) {
    try {
      window.localStorage.setItem("studio.appTheme", theme);
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }
  }
}
(globalThis as any).StudioClientPreferences = StudioClientPreferences;
