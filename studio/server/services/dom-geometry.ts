export type RectLike = {
  bottom?: number;
  height?: number;
  left?: number;
  right?: number;
  top?: number;
  width?: number;
};

export type NormalizedRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type RgbColor = {
  b: number;
  g: number;
  r: number;
};

export function normalizeRect(rect: RectLike): NormalizedRect {
  return {
    bottom: Number(rect.bottom || 0),
    height: Number(rect.height || 0),
    left: Number(rect.left || 0),
    right: Number(rect.right || 0),
    top: Number(rect.top || 0),
    width: Number(rect.width || 0)
  };
}

export function shortestDistanceBetweenRects(first: RectLike, second: RectLike): number {
  const a = normalizeRect(first);
  const b = normalizeRect(second);
  const horizontalOverlap = a.left < b.right && a.right > b.left;
  const verticalOverlap = a.top < b.bottom && a.bottom > b.top;

  if (horizontalOverlap) {
    if (b.top >= a.bottom) {
      return b.top - a.bottom;
    }
    if (a.top >= b.bottom) {
      return a.top - b.bottom;
    }
  }

  if (verticalOverlap) {
    if (b.left >= a.right) {
      return b.left - a.right;
    }
    if (a.left >= b.right) {
      return a.left - b.right;
    }
  }

  if (horizontalOverlap || verticalOverlap) {
    return -Math.min(
      Math.abs(a.bottom - b.top),
      Math.abs(b.bottom - a.top),
      Math.abs(a.right - b.left),
      Math.abs(b.right - a.left)
    );
  }

  const dx = Math.max(a.left - b.right, b.left - a.right, 0);
  const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
  return Math.sqrt((dx * dx) + (dy * dy));
}

export function getRectIntersection(first: RectLike, second: RectLike): {
  area: number;
  height: number;
  width: number;
} {
  const a = normalizeRect(first);
  const b = normalizeRect(second);
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  return {
    area: width * height,
    height,
    width
  };
}

export function unionRects(current: NormalizedRect | null, next: NormalizedRect): NormalizedRect {
  if (!current) {
    return { ...next };
  }

  return {
    bottom: Math.max(current.bottom, next.bottom),
    height: Math.max(current.bottom, next.bottom) - Math.min(current.top, next.top),
    left: Math.min(current.left, next.left),
    right: Math.max(current.right, next.right),
    top: Math.min(current.top, next.top),
    width: Math.max(current.right, next.right) - Math.min(current.left, next.left)
  };
}

function parseCssColor(value: unknown): RgbColor | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return null;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    if (!raw) {
      return null;
    }
    const full = raw.length === 3
      ? raw.split("").map((char) => char + char).join("")
      : raw;
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16)
    };
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) {
    return null;
  }

  const rgbParts = rgbMatch[1];
  if (!rgbParts) {
    return null;
  }

  const parts = rgbParts.split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return null;
  }
  const [r, g, b] = parts;
  if (r === undefined || g === undefined || b === undefined) {
    return null;
  }

  return {
    r: Number(r),
    g: Number(g),
    b: Number(b)
  };
}

function linearizeChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * linearizeChannel(color.r) +
    0.7152 * linearizeChannel(color.g) +
    0.0722 * linearizeChannel(color.b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = parseCssColor(foreground);
  const bg = parseCssColor(background);
  if (!fg || !bg) {
    return Number.POSITIVE_INFINITY;
  }

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}
