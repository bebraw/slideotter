export function applyInitialAppTheme(documentRef: Document, windowRef: Window): void {
  try {
    const storedTheme = windowRef.localStorage.getItem("studio.appTheme");
    const systemTheme = windowRef.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : systemTheme;
    documentRef.documentElement.dataset.appTheme = theme;
  } catch (error) {
    documentRef.documentElement.dataset.appTheme = "light";
  }
}
