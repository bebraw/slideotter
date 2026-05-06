import { asRecord, escapeHtml, isRecord, toFiniteNumber, toFiniteNumberOr } from "./html.ts";
import { renderSlideBody } from "./slide-layouts.ts";
import { toSlideSpec } from "./slide-data.ts";
import { normalizeTheme, renderThemeVars } from "./theme.ts";

export { normalizeTheme } from "./theme.ts";

type SlideDomRendererApi = {
  normalizeTheme: (input: unknown) => unknown;
  renderSlideMarkup: (slideSpec: unknown, options?: Record<string, unknown>) => string;
};

const allowedLayoutNames = new Set(["agenda", "chapter", "checklist", "identity", "proof", "standard", "statement", "steps"]);

function normalizeLayoutName(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!normalized) {
    return "standard";
  }
  if (!allowedLayoutNames.has(normalized)) {
    throw new Error(`slideSpec.layout must be one of: ${Array.from(allowedLayoutNames).join(", ")}`);
  }
  return normalized;
}

function renderPageBadge(index: unknown, total: unknown): string {
  const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 1;
  const safeTotal = Number.isFinite(Number(total)) && Number(total) > 0 ? Number(total) : safeIndex;
  const progress = Math.max(0, Math.min(100, (safeIndex / safeTotal) * 100));

  return `
    <div class="dom-slide__badge" aria-label="Slide ${safeIndex} of ${safeTotal}">
      <div class="dom-slide__badge-track">
        <div class="dom-slide__badge-fill" style="width:${progress}%;"></div>
      </div>
    </div>
  `;
}

export function renderSlideMarkup(slideSpec: unknown, options?: Record<string, unknown>): string {
  const spec = toSlideSpec(slideSpec);
  const config = asRecord(options);
  const theme = normalizeTheme(config.theme);
  const index = toFiniteNumber(config.index) ?? (Number(spec.index) || 1);
  const totalSlides = toFiniteNumberOr(config.totalSlides, index);
  const progressIndex = toFiniteNumberOr(config.progressIndex, index);
  const progressTotal = toFiniteNumberOr(config.progressTotal, totalSlides);
  const layout = normalizeLayoutName(spec.layout);
  const slideType = spec.type ? String(spec.type) : "unsupported";
  const hasCustomLayout = isRecord(spec.layoutDefinition) && spec.layoutDefinition.type === "slotRegionLayout";
  const customLayoutClass = hasCustomLayout ? " dom-slide--custom-layout" : "";
  const slideId = config.slideId || spec.id || "";
  const dataSlideId = slideId ? ` data-slide-id="${escapeHtml(slideId)}"` : "";
  const dataSlideIndex = ` data-slide-index="${escapeHtml(String(index))}"`;
  const presentationX = toFiniteNumber(config.presentationX);
  const presentationY = toFiniteNumber(config.presentationY);
  const dataPresentationX = presentationX !== null
    ? ` data-presentation-x="${escapeHtml(String(presentationX))}"`
    : "";
  const dataPresentationY = presentationY !== null
    ? ` data-presentation-y="${escapeHtml(String(presentationY))}"`
    : "";

  return `
    <article class="dom-slide dom-slide--${escapeHtml(slideType)} dom-slide--layout-${escapeHtml(layout)}${customLayoutClass}" style="${escapeHtml(renderThemeVars(theme))}" data-slide-type="${escapeHtml(slideType)}" data-slide-layout="${escapeHtml(layout)}"${dataSlideId}${dataSlideIndex}${dataPresentationX}${dataPresentationY}>
      ${renderSlideBody(spec)}
      ${renderPageBadge(progressIndex, progressTotal)}
    </article>
  `;
}

const api: SlideDomRendererApi = {
  normalizeTheme,
  renderSlideMarkup
};

const slideDomGlobalScope = typeof globalThis !== "undefined"
  ? globalThis as typeof globalThis & { SlideDomRenderer?: SlideDomRendererApi }
  : null;

if (slideDomGlobalScope) {
  slideDomGlobalScope.SlideDomRenderer = api;
}
