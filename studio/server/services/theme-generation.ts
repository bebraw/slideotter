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

type CssColorDeclaration = {
  color: string;
  name: string;
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
  colorSchemePreference?: unknown;
  currentTheme?: unknown;
  themeBrief?: unknown;
  title?: unknown;
  tone?: unknown;
  visualTheme?: unknown;
};

type ThemeGenerationOptions = {
  colorSchemePreference?: unknown;
  onProgress?: unknown;
};

type ThemeUrlReference = {
  colors: string[];
  colorScheme: ThemeColorScheme;
  fontFamily?: string;
  title: string;
  url: string;
};

type ThemeColorScheme = "auto" | "dark" | "light";

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

function inferFontFamilyToken(brief: unknown): string | null {
  const source = String(brief || "").toLowerCase();
  const fontSignals: Array<[string, RegExp]> = [
    ["mono", /\b(mono|monospace|code|coding|terminal|console|developer|technical|data|matrix|command line)\b/],
    ["editorial", /\b(editorial|serif|magazine|newspaper|journal|literary|classic|classical|formal|luxury|premium|georgia|times)\b/],
    ["workshop", /\b(workshop|hands-on|hands on|craft|crafted|maker|playful|friendly|casual|warm|practical|grilling|grill|kamado|trebuchet|verdana)\b/],
    ["avenir", /\b(avenir|modern|clean|minimal|minimalist|corporate|neutral|simple|helvetica|sans)\b/]
  ];
  const match = fontSignals.find(([, pattern]) => pattern.test(source));
  return match ? match[0] : null;
}

function resolveCurrentFontToken(currentTheme: VisualTheme = {}): string {
  const font = String(currentTheme.fontFamily || "").toLowerCase();
  if (fontFamilies.includes(font)) {
    return font;
  }
  if (/trebuchet|verdana|workshop/.test(font)) {
    return "workshop";
  }
  if (/mono|consolas|sfmono|liberation/.test(font)) {
    return "mono";
  }
  if (/avenir|helvetica|segoe|sans-serif/.test(font)) {
    return "avenir";
  }
  if (/georgia|times|(?<!-)serif/.test(font)) {
    return "editorial";
  }
  return "avenir";
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
  const baseFont = inferFontFamilyToken(brief) || resolveCurrentFontToken(currentTheme);

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

function normalizeThemeColorScheme(value: unknown): ThemeColorScheme {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dark" || normalized === "light" ? normalized : "auto";
}

function normalizeHexColor(value: unknown): string | null {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match || !match[1]) {
    return null;
  }
  const hex = match[1].toLowerCase();
  return hex.length === 3
    ? `#${hex.split("").map((character) => `${character}${character}`).join("")}`
    : `#${hex}`;
}

function normalizeCssColor(value: unknown): string | null {
  const text = String(value || "").trim();
  const hex = normalizeHexColor(text);
  if (hex) {
    return hex;
  }

  const rgbMatch = text.match(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*([0-9.]+%?))?/i);
  if (!rgbMatch) {
    return null;
  }
  const alpha = rgbMatch[4];
  if (alpha === "0" || alpha === "0%" || alpha === "0.0") {
    return null;
  }
  return `#${rgbToHex({
    b: Number(rgbMatch[3]),
    g: Number(rgbMatch[2]),
    r: Number(rgbMatch[1])
  })}`;
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match && match[1] ? match[1].replace(/\s+/g, " ").trim().slice(0, 80) : "";
}

function extractCssCustomPropertyColors(source: string): CssColorDeclaration[] {
  const declarations: CssColorDeclaration[] = [];
  Array.from(source.matchAll(/--([a-z0-9_-]+)\s*:\s*([^;{}]+)/giu)).forEach((match) => {
    const name = String(match[1] || "").toLowerCase();
    if (/(?:facebook|linkedin|twitter|social|logo)/u.test(name)) {
      return;
    }
    const color = normalizeCssColor(match[2]);
    if (color) {
      declarations.push({ color, name });
    }
  });
  return declarations;
}

function addCustomPropertyColor(colors: string[], declarations: CssColorDeclaration[], pattern: RegExp): void {
  const declaration = declarations.find((property) => pattern.test(property.name));
  const color = declaration ? normalizeCssColor(declaration.color) : null;
  if (color && !colors.includes(color)) {
    colors.push(color);
  }
}

function extractSiteThemeColors(source: string): string[] {
  const colors: string[] = [];
  const semanticColors = new Map<string, string>();
  const addColor = (value: unknown) => {
    const color = normalizeCssColor(value);
    if (color && !colors.includes(color)) {
      colors.push(color);
    }
  };
  const countColor = (counts: Map<string, number>, value: unknown) => {
    const color = normalizeCssColor(value);
    if (!color || color === "#ffffff" || color === "#000000") {
      return;
    }
    counts.set(color, (counts.get(color) || 0) + 1);
  };

  const customProperties = extractCssCustomPropertyColors(source);
  [
    /^color__core__accent$/u,
    /^color__attention__(?:text|border)$/u,
    /^hds-color-core-brand(?:dark)?-(?:600|500|400)$/u,
    /^(?:text|essential)-bright-accent$/u,
    /^color-progressive$/u,
    /^bgcolor-accent-emphasis$/u,
    /^(?:bs-)?primary$/u,
    /^(?:brand|brand-primary|color-brand|theme-primary)$/u,
    /^(?:green|brand-green)-50$/u,
    /^(?:bs-)?success$/u,
    /^(?:bs-)?accent$/u,
    /^(?:bs-)?info$/u,
    /^(?:bs-)?dark$/u
  ].forEach((pattern) => addCustomPropertyColor(colors, customProperties, pattern));

  Array.from(source.matchAll(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/gi))
    .forEach((match) => addColor(match[1]));
  Array.from(source.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/gi))
    .forEach((match) => addColor(match[1]));

  Array.from(source.matchAll(/[^{}]*(?:bg|text|border|hover\\:text|hover\\:bg)-(?<role>primary|secondary|accent|muted)[^{]*\{(?<body>[^}]*)\}/gi))
    .forEach((match) => {
      const role = match.groups?.role;
      if (!role || semanticColors.has(role)) {
        return;
      }
      const body = match.groups?.body || "";
      const declaration = body.match(/(?:background-color|border-color|color):([^;}]+)/i);
      const color = declaration ? normalizeCssColor(declaration[1]) : null;
      if (color) {
        semanticColors.set(role, color);
      }
    });

  ["primary", "secondary", "accent", "muted"].forEach((role) => {
    addColor(semanticColors.get(role));
  });

  const counts = new Map<string, number>();
  Array.from(source.matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi)).forEach((match) => {
    countColor(counts, match[0]);
  });
  Array.from(source.matchAll(/rgba?\(\s*\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}[^)]*\)/gi)).forEach((match) => {
    countColor(counts, match[0]);
  });

  Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .forEach(([color]) => addColor(color));

  return colors.slice(0, 6);
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    const previous = index > 0 ? source[index - 1] : "";
    if (quote) {
      if (character === quote && previous !== "\\") {
        quote = null;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") {
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function extractSchemeAwareCss(source: string, preference: ThemeColorScheme): string {
  const mediaPattern = /@media[^{]*prefers-color-scheme\s*:\s*(dark|light)[^{]*\{/giu;
  const chunks: string[] = [];
  const darkBlocks: string[] = [];
  const lightBlocks: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = mediaPattern.exec(source)) !== null) {
    const blockStart = match.index;
    const openBrace = source.indexOf("{", blockStart);
    if (openBrace === -1) {
      continue;
    }
    const closeBrace = findMatchingBrace(source, openBrace);
    if (closeBrace === -1) {
      continue;
    }

    chunks.push(source.slice(cursor, blockStart));
    const scheme = String(match[1] || "").toLowerCase();
    const body = source.slice(openBrace + 1, closeBrace);
    if (scheme === "dark") {
      darkBlocks.push(body);
    } else {
      lightBlocks.push(body);
    }
    cursor = closeBrace + 1;
    mediaPattern.lastIndex = closeBrace + 1;
  }

  chunks.push(source.slice(cursor));
  const base = chunks.join("\n");
  if (preference === "dark") {
    return darkBlocks.length ? darkBlocks.join("\n") : base;
  }
  if (preference === "light") {
    return lightBlocks.length ? lightBlocks.join("\n") : base;
  }
  return base;
}

function decodeHtmlAttribute(value: unknown): string {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripCssFunction(source: string, functionName: string): string {
  const pattern = new RegExp(`${functionName}\\s*\\(`, "igu");
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const openParen = source.indexOf("(", match.index);
    if (openParen === -1) {
      continue;
    }
    let depth = 0;
    let closeParen = -1;
    for (let index = openParen; index < source.length; index += 1) {
      const character = source[index];
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          closeParen = index;
          break;
        }
      }
    }
    if (closeParen === -1) {
      continue;
    }
    result += source.slice(cursor, match.index);
    cursor = closeParen + 1;
    pattern.lastIndex = closeParen + 1;
  }
  return result + source.slice(cursor);
}

function sanitizeFontFamily(value: unknown): string | null {
  const source = stripCssFunction(String(value || "").trim(), "var").replace(/,+/gu, ",");
  if (
    !source
    || source.length > 180
    || /[;{}]/u.test(source)
    || /\b(?:expression|import|url)\s*\(/iu.test(source)
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

function extractCssFontFamily(body: string): string | null {
  const declaration = body.match(/font-family\s*:\s*([^;}]+)/i);
  return declaration ? sanitizeFontFamily(declaration[1]) : null;
}

function extractCssFontCustomProperties(source: string): string | null {
  const declarations = Array.from(source.matchAll(/--([a-z0-9_-]*(?:font|family|stack)[a-z0-9_-]*)\s*:\s*([^;{}]+)/giu))
    .map((match) => ({
      name: String(match[1] || "").toLowerCase(),
      value: String(match[2] || "")
    }));
  const priority = [
    /body.*font.*stack/u,
    /fontfamily/u,
    /font-family/u,
    /font.*sans/u,
    /font.*stack/u,
    /font.*family/u
  ];
  for (const pattern of priority) {
    const declaration = declarations.find((item) => pattern.test(item.name));
    const font = declaration ? sanitizeFontFamily(declaration.value) : null;
    if (font && !/^(inherit|sans-serif|serif|monospace)$/iu.test(font)) {
      return font;
    }
  }
  return null;
}

function extractSiteFontFamily(source: string): string | null {
  const scopedRules = Array.from(source.matchAll(/(?:^|})\s*(?:body|html|:root)[^{]*\{([^}]*)\}/gi));
  for (const match of scopedRules) {
    const font = extractCssFontFamily(match[1] || "");
    if (font && !/^inherit$/iu.test(font)) {
      return font;
    }
  }

  const customPropertyFont = extractCssFontCustomProperties(source);
  if (customPropertyFont) {
    return customPropertyFont;
  }

  const fontFace = source.match(/@font-face\s*\{[^}]*font-family\s*:\s*([^;}]+)/i);
  const declaredFont = fontFace ? sanitizeFontFamily(fontFace[1]) : null;
  if (declaredFont) {
    return `${declaredFont}, sans-serif`;
  }

  const declarations = Array.from(source.matchAll(/font-family\s*:\s*([^;}]+)/gi));
  for (const match of declarations) {
    const font = sanitizeFontFamily(match[1]);
    if (font && !/^(inherit|monospace|["']?object-fit:cover["']?)$/iu.test(font)) {
      return font;
    }
  }

  return null;
}

function extractStylesheetUrls(html: string, baseUrl: URL): URL[] {
  const urls: URL[] = [];
  Array.from(html.matchAll(/<link\b[^>]*>/gi))
    .forEach((match) => {
      const tag = match[0];
      if (!/\brel=["'][^"']*stylesheet[^"']*["']/iu.test(tag)) {
        return;
      }
      const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
      if (!href) {
        return;
      }
      try {
        const stylesheetUrl = new URL(decodeHtmlAttribute(href), baseUrl);
        if (stylesheetUrl.protocol === "http:" || stylesheetUrl.protocol === "https:") {
          urls.push(stylesheetUrl);
        }
      } catch {
        // Ignore malformed stylesheet URLs from third-party markup.
      }
    });
  return urls.slice(0, 8);
}

async function fetchStylesheetText(url: URL, signal: AbortSignal): Promise<string> {
  const response = await fetch(url.toString(), {
    headers: {
      accept: "text/css,*/*;q=0.2",
      "user-agent": "slideotter-theme-extractor"
    },
    signal
  });
  if (!response.ok) {
    return "";
  }
  const contentType = response.headers && typeof response.headers.get === "function"
    ? String(response.headers.get("content-type") || "")
    : "";
  if (contentType && !/text\/css/i.test(contentType)) {
    return "";
  }
  return (await response.text()).slice(0, 400000);
}

function createThemeFromSiteColors(reference: ThemeUrlReference, fontFamily = "avenir") {
  const [primaryBrand, secondaryBrand, mutedBrand] = reference.colors;
  const brand = primaryBrand || "#275d8c";
  const secondary = secondaryBrand || mixColors(brand, "#ffffff", 0.55);
  const muted = mutedBrand || mixColors(brand, "#56677c", 0.45);
  const readableBrand = mixColors(brand, "#101820", 0.35);
  const readablePrimary = mixColors(muted, "#101820", 0.42);

  return normalizeVisualTheme({
    accent: muted,
    bg: mixColors(secondary, "#ffffff", 0.86),
    fontFamily,
    light: secondary,
    muted,
    panel: mixColors(secondary, "#ffffff", 0.92),
    primary: readablePrimary,
    progressFill: readableBrand,
    progressTrack: secondary,
    secondary: readableBrand,
    surface: "#ffffff"
  });
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
    const stylesheetUrls = extractStylesheetUrls(raw, url);
    const stylesheets = (await Promise.all(
      stylesheetUrls.map((stylesheetUrl) => fetchStylesheetText(stylesheetUrl, controller.signal).catch(() => ""))
    )).join("\n").slice(0, 800000);
    const colorScheme = normalizeThemeColorScheme(asRecord(options).colorSchemePreference);
    const themeSource = extractSchemeAwareCss(`${raw}\n${stylesheets}`, colorScheme);
    const colors = extractSiteThemeColors(themeSource);
    if (!colors.length) {
      return null;
    }
    const fontFamily = extractSiteFontFamily(`${raw}\n${stylesheets}`);

    return {
      colors,
      colorScheme,
      ...(fontFamily ? { fontFamily } : {}),
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
    `Site color mode: ${reference.colorScheme}`,
    reference.fontFamily ? `Site font family: ${reference.fontFamily}` : "",
    reference.title ? `Site title: ${reference.title}` : "",
    brief
  ].filter(Boolean).join("\n");
}

function createThemeFromAnchor(anchor: ThemeAnchor, fontFamily = "avenir") {
  const color = anchor.color || "#275d8c";
  const accent = anchor.accent || mixColors(color, "#f28f3b", 0.35);
  const readableColor = mixColors(color, "#101820", 0.45);
  const readableAccent = mixColors(accent, "#101820", 0.6);
  return normalizeVisualTheme({
    accent: readableAccent,
    bg: mixColors(color, "#ffffff", 0.9),
    fontFamily,
    light: mixColors(color, "#ffffff", 0.78),
    muted: mixColors(readableColor, "#56677c", 0.45),
    panel: mixColors(color, "#ffffff", 0.95),
    primary: readableColor,
    progressFill: readableColor,
    progressTrack: mixColors(color, "#ffffff", 0.78),
    secondary: readableColor,
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
  const colorSchemePreference = normalizeThemeColorScheme(fields.colorSchemePreference);
  const urlReference = themeUrl ? await fetchThemeUrlReference(themeUrl, {
    ...options,
    colorSchemePreference
  }) : null;
  const enrichedBrief = createUrlThemeBrief(brief, urlReference);
  const currentTheme = normalizeVisualTheme({
    ...defaultVisualTheme,
    ...asRecord(fields.currentTheme || fields.visualTheme)
  });
  const baseFont = urlReference?.fontFamily || inferFontFamilyToken(enrichedBrief) || resolveCurrentFontToken(currentTheme);
  if (urlReference) {
    return {
      name: normalizeThemeName(urlReference.title || themeUrl?.hostname || "Site theme", "Site theme"),
      source: "fallback",
      theme: createThemeFromSiteColors(urlReference, baseFont)
    };
  }
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
      "Also translate typography cues into fontFamily: mono for technical/code/data themes, editorial for serif/classic/magazine themes, workshop for warm hands-on craft themes, and avenir for clean modern themes.",
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
    ...asRecord(result.theme),
    ...(inferFontFamilyToken(enrichedBrief) ? { fontFamily: inferFontFamilyToken(enrichedBrief) } : {})
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
