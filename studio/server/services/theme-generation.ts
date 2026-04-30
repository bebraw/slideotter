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

type ThemeUrlReference = {
  colors: string[];
  title: string;
  url: string;
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
      ...(index === 0 && hexMatches[1]
        ? { accent: hexMatches[1][0].startsWith("#") ? hexMatches[1][0] : `#${hexMatches[1][0]}` }
        : {}),
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

function extractThemeUrl(value: unknown): URL | null {
  const text = String(value || "").trim();
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) {
    return null;
  }

  try {
    const url = new URL(match[0]);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function normalizeHexColor(value: unknown): string | null {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match && match[1] ? `#${match[1].toLowerCase()}` : null;
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match && match[1] ? match[1].replace(/\s+/g, " ").trim().slice(0, 80) : "";
}

function extractSiteThemeColors(source: string): string[] {
  const colors: string[] = [];
  const addColor = (value: unknown) => {
    const color = normalizeHexColor(value);
    if (color && !colors.includes(color)) {
      colors.push(color);
    }
  };

  Array.from(source.matchAll(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/gi))
    .forEach((match) => addColor(match[1]));
  Array.from(source.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/gi))
    .forEach((match) => addColor(match[1]));

  const counts = new Map<string, number>();
  Array.from(source.matchAll(/#([0-9a-f]{6})\b/gi)).forEach((match) => {
    const color = normalizeHexColor(match[0]);
    if (!color || color === "#ffffff" || color === "#000000") {
      return;
    }
    counts.set(color, (counts.get(color) || 0) + 1);
  });

  Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .forEach(([color]) => addColor(color));

  return colors.slice(0, 6);
}

async function fetchThemeUrlReference(url: URL, options: ThemeGenerationOptions = {}): Promise<ThemeUrlReference | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  if (typeof options.onProgress === "function") {
    options.onProgress({
      message: `Inspecting site theme colors from ${url.hostname}...`,
      stage: "theme-url"
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: "text/html,text/css;q=0.8,*/*;q=0.2",
        "user-agent": "slideotter-theme-extractor"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }

    const getHeader = (name: string): string => response.headers && typeof response.headers.get === "function"
      ? String(response.headers.get(name) || "")
      : "";
    const contentType = getHeader("content-type");
    if (contentType && !/text\/html|text\/css|application\/xhtml\+xml/i.test(contentType)) {
      return null;
    }
    const contentLength = Number(getHeader("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 1000000) {
      return null;
    }

    const raw = (await response.text()).slice(0, 250000);
    const colors = extractSiteThemeColors(raw);
    if (!colors.length) {
      return null;
    }

    return {
      colors,
      title: extractHtmlTitle(raw) || url.hostname,
      url: url.toString()
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createUrlThemeBrief(brief: string, reference: ThemeUrlReference | null): string {
  if (!reference) {
    return brief;
  }

  return [
    `Site theme colors from ${reference.url}: ${reference.colors.join(" ")}`,
    reference.title ? `Site title: ${reference.title}` : "",
    brief
  ].filter(Boolean).join("\n");
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
  const themeUrl = extractThemeUrl(brief);
  const urlReference = themeUrl ? await fetchThemeUrlReference(themeUrl, options) : null;
  const enrichedBrief = createUrlThemeBrief(brief, urlReference);
  const currentTheme = normalizeVisualTheme({
    ...defaultVisualTheme,
    ...asRecord(fields.currentTheme || fields.visualTheme)
  });
  const anchors = extractThemeAnchors(enrichedBrief);
  const llmStatus = getLlmStatus();

  if (!brief || !llmStatus.available) {
    return {
      ...createFallbackTheme(enrichedBrief, currentTheme),
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
      `Theme description: ${enrichedBrief}`,
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
      ...createFallbackTheme(enrichedBrief, currentTheme),
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
