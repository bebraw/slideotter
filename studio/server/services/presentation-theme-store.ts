import {
  createSlug
} from "./compact-text.ts";
import {
  normalizeVisualTheme,
  theme as defaultVisualTheme
} from "./deck-theme.ts";
import {
  type JsonObject
} from "./presentation-state.ts";
import {
  ensurePresentationRuntime,
  readPresentationRuntimeState,
  writePresentationRuntimeState
} from "./presentation-runtime-store.ts";

function listSavedThemes(): JsonObject[] {
  const registry = ensurePresentationRuntime();
  return readPresentationRuntimeState(registry).savedThemes;
}

function saveRuntimeTheme(fields: JsonObject = {}): JsonObject {
  const registry = ensurePresentationRuntime();
  const runtime = readPresentationRuntimeState(registry);
  const timestamp = new Date().toISOString();
  const name = String(fields.name || "Saved theme").trim() || "Saved theme";
  const id = createSlug(fields.id || name, "theme");
  const existing = runtime.savedThemes.filter((theme: JsonObject) => theme.id !== id);
  const savedTheme = {
    id,
    name,
    theme: normalizeVisualTheme({
      ...defaultVisualTheme,
      ...(fields.theme || fields.visualTheme || {})
    }),
    updatedAt: timestamp
  };

  writePresentationRuntimeState({
    savedThemes: [
      savedTheme,
      ...existing
    ].slice(0, 30)
  }, registry);

  return savedTheme;
}

export {
  listSavedThemes,
  saveRuntimeTheme
};
