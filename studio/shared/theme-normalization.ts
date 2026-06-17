export type ThemeTokens = {
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

export const defaultThemeTokens: ThemeTokens = {
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

type RgbColor = {
  b: number;
  g: number;
  r: number;
};

export function normalizeColor(value: unknown, fallback: string): string {
  const normalized = String(value || "").trim().replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

export function parseRgbColor(hex: unknown): RgbColor | null {
  const normalized = normalizeColor(hex, "");
  if (!normalized) {
    return null;
  }

  return {
    b: parseInt(normalized.slice(4, 6), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    r: parseInt(normalized.slice(0, 2), 16)
  };
}

function hexToRgb(hex: unknown): RgbColor {
  return parseRgbColor(hex) || { b: 0, g: 0, r: 0 };
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

export function ensureContrast(
  color: unknown,
  background: string,
  minRatio: number,
  candidates: string[] = [],
  fallback = defaultThemeTokens.primary
): string {
  const normalized = normalizeColor(color, fallback);
  if (contrastRatio(normalized, background) >= minRatio) {
    return normalized;
  }

  return [...candidates, "101820", "ffffff", "f7fcfb"]
    .map((candidate) => normalizeColor(candidate, fallback))
    .sort((a: string, b: string) => contrastRatio(b, background) - contrastRatio(a, background))[0] || normalized;
}

function stripCssFunction(value: string, functionName: string): string {
  const pattern = new RegExp(`${functionName}\\s*\\(`, "giu");
  let source = value;
  let result = "";
  let cursor = 0;
  for (;;) {
    const match = pattern.exec(source);
    if (!match) {
      break;
    }
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

export function sanitizeFontFamily(value: unknown, options: { stripCssVars?: boolean } = {}): string | null {
  const rawSource = String(value || "").trim();
  const source = options.stripCssVars ? stripCssFunction(rawSource, "var").replace(/,+/gu, ",") : rawSource;
  const unsafeFunctionPattern = options.stripCssVars
    ? /\b(?:expression|import|url)\s*\(/iu
    : /\b(?:expression|import|url|var)\s*\(/iu;
  if (
    !source
    || source.length > 180
    || /[;{}]/u.test(source)
    || unsafeFunctionPattern.test(source)
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

export function normalizeFontFamily(value: unknown, fallback = defaultThemeTokens.fontFamily): string {
  const key = String(value || "").trim().toLowerCase();
  const allowed: Record<string, string> = {
    avenir: defaultThemeTokens.fontFamily,
    editorial: "Georgia, \"Times New Roman\", serif",
    mono: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
    workshop: "\"Trebuchet MS\", Verdana, sans-serif"
  };

  const customFont = sanitizeFontFamily(value);
  return allowed[key] || Object.values(allowed).find((stack) => stack.toLowerCase() === key) || customFont || fallback;
}
