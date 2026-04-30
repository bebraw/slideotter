const { normalizeVisualTheme, theme: defaultVisualTheme } = require("./deck-theme.ts");
const { createStructuredResponse, getLlmStatus } = require("./llm/client.ts");

const fontFamilies = ["avenir", "editorial", "workshop", "mono"];

type RgbColor = {
  b: number;
  g: number;
  r: number;
};

type ThemeAnchor = {
  accent?: string;
  color: string;
  label: string;
  terms: string[];
};

type VisualTheme = Record<string, unknown> & {
  accent?: unknown;
  fontFamily?: unknown;
  progressFill?: unknown;
  secondary?: unknown;
};

type ThemeGenerationFields = Record<string, unknown> & {
  audience?: unknown;
  brief?: unknown;
  currentTheme?: unknown;
  themeBrief?: unknown;
  title?: unknown;
  tone?: unknown;
  visualTheme?: unknown;
};

type ThemeGenerationOptions = {
  onProgress?: unknown;
};

const semanticColorAnchors = [
  { color: "#2f8fd0", accent: "#f3b647", label: "Sky Blue", terms: ["blue", "sky", "air", "cloud", "clear", "azure"] },
  { color: "#2563eb", accent: "#22c55e", label: "Ocean Blue", terms: ["ocean", "sea", "water", "marine", "navy"] },
  { color: "#2d7a4b", accent: "#b86b25", label: "Forest Green", terms: ["green", "forest", "leaf", "leaves", "moss", "nature", "growth"] },
  { color: "#8a5a32", accent: "#4f7a3a", label: "Tree Brown", terms: ["brown", "tree", "wood", "bark", "earth", "earthy", "soil"] },
  { color: "#a8552d", accent: "#6f4e37", label: "Clay Brown", terms: ["clay", "terracotta", "coffee", "cocoa", "chocolate"] },
  { color: "#dc2626", accent: "#f59e0b", label: "Red", terms: ["red", "ruby", "crimson", "scarlet"] },
  { color: "#ea580c", accent: "#facc15", label: "Orange", terms: ["orange", "amber", "citrus"] },
  { color: "#d97706", accent: "#facc15", label: "Sunset", terms: ["sunset", "sunrise", "sun", "golden hour"] },
  { color: "#ca8a04", accent: "#7c3aed", label: "Gold", terms: ["yellow", "gold", "golden", "honey"] },
  { color: "#0891b2", accent: "#14b8a6", label: "Cyan", terms: ["cyan", "aqua", "turquoise"] },
  { color: "#0f766e", accent: "#f97316", label: "Teal", terms: ["teal", "mint"] },
  { color: "#7c3aed", accent: "#db2777", label: "Purple", terms: ["purple", "violet", "amethyst"] },
  { color: "#8b5cf6", accent: "#e879f9", label: "Lavender", terms: ["lavender", "lilac"] },
  { color: "#db2777", accent: "#f97316", label: "Pink", terms: ["pink", "rose", "magenta", "fuchsia"] },
  { color: "#111827", accent: "#38bdf8", label: "Black", terms: ["black", "dark", "night", "midnight", "charcoal"] },
  { color: "#475569", accent: "#0ea5e9", label: "Slate", terms: ["gray", "grey", "slate", "silver", "metal"] },
  { color: "#64748b", accent: "#f59e0b", label: "White", terms: ["white", "snow", "paper", "clean", "minimal"] }
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeThemeName(value: unknown, fallback = "Generated theme"): string {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  return name ? name.slice(0, 48) : fallback;
}

function createThemeSchema() {
  return {
    additionalProperties: false,
    required: ["name", "theme"],
    type: "object",
    properties: {
      name: {
        maxLength: 48,
        minLength: 2,
        type: "string"
      },
      theme: {
        additionalProperties: false,
        required: [
          "primary",
          "secondary",
          "accent",
          "muted",
          "light",
          "bg",
          "panel",
          "surface",
          "progressTrack",
          "progressFill",
          "fontFamily"
        ],
        type: "object",
        properties: {
          primary: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          secondary: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          accent: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          muted: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          light: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          bg: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          panel: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          surface: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          progressTrack: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          progressFill: { pattern: "^#[0-9a-fA-F]{6}$", type: "string" },
          fontFamily: { enum: fontFamilies, type: "string" }
        }
      }
    }
  };
}

function createFallbackTheme(brief: unknown, currentTheme: VisualTheme = {}) {
  const anchors = extractThemeAnchors(brief);
  const anchor: ThemeAnchor = anchors[0]
    || semanticColorAnchors[hashTextToIndex(brief || "theme", semanticColorAnchors.length)]
    || { color: "#275d8c", label: "Generated theme", terms: [] };
  const baseFont = typeof currentTheme.fontFamily === "string" && fontFamilies.includes(currentTheme.fontFamily) ? currentTheme.fontFamily : "avenir";

  return {
    name: anchor.label || "Generated theme",
    theme: createThemeFromAnchor(anchor, baseFont)
  };
}

function hashTextToIndex(text: unknown, length: number): number {
  if (!length) {
    return 0;
  }

  let hash = 0;
  String(text || "").split("").forEach((character) => {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  });

  return Math.abs(hash) % length;
}

function parseRgb(hex: unknown): RgbColor | null {
  const normalized = String(hex || "").replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalized)) {
    return null;
  }

  return {
    b: parseInt(normalized.slice(4, 6), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    r: parseInt(normalized.slice(0, 2), 16)
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return [r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("");
}

function mixColors(first: unknown, second: unknown, weight = 0.5): string {
  const a = parseRgb(first) || { b: 140, g: 93, r: 39 };
  const b = parseRgb(second) || { b: 255, g: 255, r: 255 };
  return rgbToHex({
    b: a.b * (1 - weight) + b.b * weight,
    g: a.g * (1 - weight) + b.g * weight,
    r: a.r * (1 - weight) + b.r * weight
  });
}

function colorDistance(first: unknown, second: unknown): number {
  const a = parseRgb(first);
  const b = parseRgb(second);
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
    Math.pow(a.g - b.g, 2) +
    Math.pow(a.b - b.b, 2)
  );
}

function extractThemeAnchors(brief: unknown): ThemeAnchor[] {
  const source = String(brief || "").toLowerCase();
  const anchors: ThemeAnchor[] = [];
  const hexMatches = Array.from(source.matchAll(/#?[0-9a-f]{6}\b/g));
  hexMatches.forEach((match, index) => {
    anchors.push({
      color: match[0].startsWith("#") ? match[0] : `#${match[0]}`,
      label: index === 0 ? "Custom Color" : `Custom Color ${index + 1}`,
      terms: []
    });
  });
  semanticColorAnchors.forEach((anchor) => {
    const matchedTerm = anchor.terms.find((term) => new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i").test(source));
    if (matchedTerm) {
      anchors.push(anchor);
    }
  });
  return anchors;
}

function createThemeFromAnchor(anchor: ThemeAnchor, fontFamily = "avenir") {
  const color = anchor.color || "#275d8c";
  const accent = anchor.accent || mixColors(color, "#f28f3b", 0.35);
  return normalizeVisualTheme({
    accent,
    bg: mixColors(color, "#ffffff", 0.9),
    fontFamily,
    light: mixColors(color, "#ffffff", 0.78),
    muted: mixColors(color, "#56677c", 0.62),
    panel: mixColors(color, "#ffffff", 0.95),
    primary: mixColors(color, "#101820", 0.78),
    progressFill: color,
    progressTrack: mixColors(color, "#ffffff", 0.78),
    secondary: color,
    surface: "#ffffff"
  });
}

function themeMatchesAnchors(generatedTheme: VisualTheme, anchors: ThemeAnchor[]): boolean {
  if (!anchors.length) {
    return true;
  }

  const themeColors = [
    generatedTheme.secondary,
    generatedTheme.accent,
    generatedTheme.progressFill
  ];
  return anchors.some((anchor) => {
    const expected = anchor.color;
    return themeColors.some((color) => colorDistance(color, expected) <= 52);
  });
}

async function generateThemeFromBrief(fields: ThemeGenerationFields = {}, options: ThemeGenerationOptions = {}) {
  const brief = String(fields.themeBrief || fields.brief || "").trim();
  const currentTheme = normalizeVisualTheme({
    ...defaultVisualTheme,
    ...asRecord(fields.currentTheme || fields.visualTheme)
  });
  const anchors = extractThemeAnchors(brief);
  const llmStatus = getLlmStatus();

  if (!brief || !llmStatus.available) {
    return {
      ...createFallbackTheme(brief, currentTheme),
      source: "fallback"
    };
  }

  const result = await createStructuredResponse({
    developerPrompt: [
      "You generate deck-level visual theme tokens for a browser presentation studio.",
      "Return JSON only and stay within the provided schema.",
      "Translate the user's theme description into concrete, coherent colors.",
      "Honor literal color and metaphor references. For example, sky means light blue, airy, and bright unless the user says night sky.",
      "Keep text colors readable against the background.",
      "Use fontFamily only from: avenir, editorial, workshop, mono.",
      "Do not mutate slide content. Only return a theme name and theme tokens."
    ].join("\n"),
    maxOutputTokens: 700,
    onProgress: options.onProgress,
    schema: createThemeSchema(),
    schemaName: "deck_visual_theme",
    userPrompt: [
      `Theme description: ${brief}`,
      `Deck title: ${String(fields.title || "").trim() || "Untitled deck"}`,
      `Audience: ${String(fields.audience || "").trim() || "Unknown"}`,
      `Tone: ${String(fields.tone || "").trim() || "Unspecified"}`,
      `Current theme: ${JSON.stringify(currentTheme)}`
    ].join("\n")
  });

  const normalizedTheme = normalizeVisualTheme({
    ...defaultVisualTheme,
    ...asRecord(result.theme)
  });

  if (!themeMatchesAnchors(normalizedTheme, anchors)) {
    return {
      ...createFallbackTheme(brief, currentTheme),
      source: "fallback"
    };
  }

  return {
    name: normalizeThemeName(result.name, "Generated theme"),
    source: "llm",
    theme: normalizedTheme
  };
}

module.exports = {
  generateThemeFromBrief
};
