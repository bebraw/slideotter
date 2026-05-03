type JsonRecord = Record<string, unknown>;

export type Theme = {
  accent: string;
  bg: string;
  fontFamily: string;
  light: string;
  muted: string;
  panel: string;
  primary: string;
  progressFill: string;
  progressTrack: string;
  secondary: string;
  surface: string;
};

const baseTheme: Theme = {
  accent: "f28f3b",
  bg: "f5f8fc",
  fontFamily: "\"Avenir Next\", \"Helvetica Neue\", \"Segoe UI\", sans-serif",
  light: "d7e6f5",
  muted: "56677c",
  panel: "f8fbfe",
  primary: "183153",
  progressFill: "275d8c",
  progressTrack: "d7e6f5",
  secondary: "275d8c",
  surface: "ffffff"
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function normalizeColor(value: unknown, fallback: string): string {
  const normalized = String(value || "").trim().replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function hexToRgb(hex: unknown): { b: number; g: number; r: number } {
  const normalized = normalizeColor(hex, "000000");
  return {
    b: parseInt(normalized.slice(4, 6), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    r: parseInt(normalized.slice(0, 2), 16)
  };
}

function luminanceChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: unknown): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * luminanceChannel(r)) +
    (0.7152 * luminanceChannel(g)) +
    (0.0722 * luminanceChannel(b));
}

function contrastRatio(foreground: unknown, background: unknown): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(color: unknown, background: string, minRatio: number, candidates: string[] = []): string {
  const normalized = normalizeColor(color, baseTheme.primary);
  if (contrastRatio(normalized, background) >= minRatio) {
    return normalized;
  }

  return [...candidates, "101820", "ffffff", "f7fcfb"]
    .map((candidate) => normalizeColor(candidate, baseTheme.primary))
    .sort((a: string, b: string) => contrastRatio(b, background) - contrastRatio(a, background))[0] || normalized;
}

function withHash(color: unknown): string {
  return `#${String(color || "").replace(/^#/, "")}`;
}

function normalizeFontFamily(value: unknown): string {
  const key = String(value || "").trim().toLowerCase();
  const allowed: Record<string, string> = {
    avenir: "\"Avenir Next\", \"Helvetica Neue\", \"Segoe UI\", sans-serif",
    editorial: "Georgia, \"Times New Roman\", serif",
    mono: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
    workshop: "\"Trebuchet MS\", Verdana, sans-serif"
  };

  const customFont = sanitizeFontFamily(value);
  return allowed[key] || Object.values(allowed).find((stack) => stack.toLowerCase() === key) || customFont || baseTheme.fontFamily;
}

function sanitizeFontFamily(value: unknown): string | null {
  const source = String(value || "").trim();
  if (
    !source
    || source.length > 180
    || /[;{}]/u.test(source)
    || /\b(?:expression|import|url|var)\s*\(/iu.test(source)
  ) {
    return null;
  }

  const allowedGenerics = new Set(["cursive", "fantasy", "monospace", "sans-serif", "serif", "system-ui"]);
  const families = source.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!families.length) {
    return null;
  }

  const sanitized = families.map((family) => {
    const unquoted = family.replace(/^["']|["']$/g, "").trim();
    const normalized = unquoted.toLowerCase();
    if (allowedGenerics.has(normalized)) {
      return normalized;
    }
    if (!/^[a-z0-9][a-z0-9 ._-]{0,48}$/iu.test(unquoted)) {
      return null;
    }
    return /\s/u.test(unquoted) ? `"${unquoted.replace(/"/gu, "")}"` : unquoted;
  });

  return sanitized.every(Boolean) ? sanitized.join(", ") : null;
}

export function normalizeTheme(input: unknown): Theme {
  const source = asRecord(input);
  const bg = normalizeColor(source.bg, baseTheme.bg);
  const requestedPrimary = normalizeColor(source.primary, baseTheme.primary);
  const requestedSecondary = normalizeColor(source.secondary, baseTheme.secondary);
  const requestedAccent = normalizeColor(source.accent, baseTheme.accent);
  const requestedMuted = normalizeColor(source.muted, baseTheme.muted);
  const primary = ensureContrast(requestedPrimary, bg, 4.5);
  const secondary = ensureContrast(requestedSecondary, bg, 4.5, [primary]);
  const accent = ensureContrast(requestedAccent, bg, 3, [secondary, primary]);
  const muted = ensureContrast(requestedMuted, bg, 4.5, [primary, secondary]);
  const progressTrack = normalizeColor(source.progressTrack || source.light, baseTheme.progressTrack);
  const progressFill = ensureContrast(
    normalizeColor(source.progressFill || secondary, baseTheme.progressFill),
    progressTrack,
    3,
    [primary, secondary]
  );

  return {
    accent,
    bg,
    fontFamily: normalizeFontFamily(source.fontFamily),
    light: normalizeColor(source.light, baseTheme.light),
    muted,
    panel: normalizeColor(source.panel, baseTheme.panel),
    primary,
    progressFill,
    progressTrack,
    secondary,
    surface: normalizeColor(source.surface, baseTheme.surface)
  };
}

export function renderThemeVars(theme: Theme): string {
  const onPanel = ensureContrast(theme.primary, theme.panel, 4.5);
  const onPanelMuted = ensureContrast(theme.muted, theme.panel, 4.5, [onPanel]);
  const onSurface = ensureContrast(theme.primary, theme.surface, 4.5);
  const onSurfaceMuted = ensureContrast(theme.muted, theme.surface, 4.5, [onSurface]);

  return [
    `--dom-accent:${withHash(theme.accent)}`,
    `--dom-bg:${withHash(theme.bg)}`,
    `--dom-font-family:${theme.fontFamily}`,
    `--dom-light:${withHash(theme.light)}`,
    `--dom-muted:${withHash(theme.muted)}`,
    `--dom-on-panel:${withHash(onPanel)}`,
    `--dom-on-panel-muted:${withHash(onPanelMuted)}`,
    `--dom-on-surface:${withHash(onSurface)}`,
    `--dom-on-surface-muted:${withHash(onSurfaceMuted)}`,
    `--dom-panel:${withHash(theme.panel)}`,
    `--dom-primary:${withHash(theme.primary)}`,
    `--dom-progress-fill:${withHash(theme.progressFill)}`,
    `--dom-progress-track:${withHash(theme.progressTrack)}`,
    `--dom-secondary:${withHash(theme.secondary)}`,
    `--dom-surface:${withHash(theme.surface)}`
  ].join(";");
}
