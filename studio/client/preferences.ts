export namespace StudioClientPreferences {
  export type DrawerPreferenceKey = keyof typeof drawerKeys;
  export type CurrentPage = "layout-studio" | "planning" | "presentations" | "studio";
  export type AppTheme = "dark" | "light";

  const drawerKeys = {
    assistant: "studio.assistantDrawerOpen",
    context: "studio.contextDrawerOpen",
    structuredDraft: "studio.structuredDraftDrawerOpen"
  };

  export function loadDrawerOpen(key: DrawerPreferenceKey): boolean {
    try {
      return window.localStorage.getItem(drawerKeys[key]) === "true";
    } catch (error) {
      return false;
    }
  }

  export function persistDrawerOpen(key: DrawerPreferenceKey, open: boolean): void {
    try {
      window.localStorage.setItem(drawerKeys[key], String(open));
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }
  }

  export function loadCurrentPage(): CurrentPage {
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

  export function persistCurrentPage(page: CurrentPage): void {
    try {
      window.localStorage.setItem("studio.currentPage", page);
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }
  }

  export function loadAppTheme(): AppTheme {
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

  export function persistAppTheme(theme: AppTheme): void {
    try {
      window.localStorage.setItem("studio.appTheme", theme);
    } catch (error) {
      // Ignore unavailable localStorage in restricted environments.
    }
  }
}
