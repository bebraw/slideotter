import { asRecord, escapeHtml, toFiniteNumber, toFiniteNumberOr } from "./html.ts";
import { renderPresentationScript } from "./presentation-script.ts";
import { renderSlideBody } from "./slide-layouts.ts";
import {
  toDocumentPayload,
  toSlideEntries,
  toSlideSpec,
  type DocumentMetadata,
  type DocumentPayload,
  type SlideEntry
} from "./slide-data.ts";
import { normalizeTheme, renderThemeVars } from "./theme.ts";

export { normalizeTheme } from "./theme.ts";

type SlideDomRendererApi = {
  normalizeTheme: (input: unknown) => unknown;
  renderDeckDocument: (payload: unknown) => string;
  renderDeckMarkup: (slides: unknown, options?: Record<string, unknown>) => string;
  renderPresentationDocument: (payload: unknown) => string;
  renderSlideDocument: (payload: unknown) => string;
  renderSlideMarkup: (slideSpec: unknown, options?: Record<string, unknown>) => string;
};

function normalizeLayoutName(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (normalized === "default") {
    return "standard";
  }
  return normalized || "standard";
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
    <article class="dom-slide dom-slide--${escapeHtml(slideType)} dom-slide--layout-${escapeHtml(layout)}" style="${escapeHtml(renderThemeVars(theme))}" data-slide-type="${escapeHtml(slideType)}" data-slide-layout="${escapeHtml(layout)}"${dataSlideId}${dataSlideIndex}${dataPresentationX}${dataPresentationY}>
      ${renderSlideBody(spec)}
      ${renderPageBadge(progressIndex, progressTotal)}
    </article>
  `;
}

export function renderDeckMarkup(slides: unknown, options?: Record<string, unknown>): string {
  const slideList = toSlideEntries(slides);
  const config = asRecord(options);
  const totalSlides = slideList.length || 1;

  return `
    <div class="dom-deck-document__slides">
      ${slideList.map((entry: SlideEntry, slideIndex: number) => renderSlideMarkup(entry.slideSpec, {
        index: toFiniteNumberOr(entry.index, slideIndex + 1),
        presentationX: toFiniteNumber(entry.presentationX) ?? undefined,
        presentationY: toFiniteNumber(entry.presentationY) ?? undefined,
        slideId: entry.id,
        theme: config.theme,
        totalSlides
      })).join("")}
    </div>
  `;
}

function renderDocumentHead(config: DocumentPayload): string {
  const title = escapeHtml(config.title || "Deck Preview");
  const lang = escapeHtml(config.lang || "en");
  const inlineCss = typeof config.inlineCss === "string" ? config.inlineCss : "";
  const metadata: DocumentMetadata = asRecord(config.metadata);
  const metaTags: string[] = [];

  if (metadata.author) {
    metaTags.push(`    <meta name="author" content="${escapeHtml(metadata.author)}">`);
  }

  if (metadata.company) {
    metaTags.push(`    <meta name="application-name" content="${escapeHtml(metadata.company)}">`);
  }

  if (metadata.subject) {
    metaTags.push(`    <meta name="subject" content="${escapeHtml(metadata.subject)}">`);
  }

  if (metadata.objective) {
    metaTags.push(`    <meta name="description" content="${escapeHtml(metadata.objective)}">`);
  }

  return [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${title}</title>`,
    ...metaTags,
    inlineCss
      ? `    <style>\n${inlineCss}\n    </style>`
      : "    <link rel=\"stylesheet\" href=\"/styles.css\">",
    "  </head>"
  ].join("\n");
}

export function renderDeckDocument(payload: unknown): string {
  const config = toDocumentPayload(payload);
  const title = escapeHtml(config.title || "Deck Preview");
  const metadata: DocumentMetadata = asRecord(config.metadata);
  const subjectLine = metadata.subject
    ? `<p class="dom-deck-document__subject">${escapeHtml(metadata.subject)}</p>`
    : "";
  const metaParts = [metadata.company, metadata.author].filter(Boolean);
  const metaLine = metaParts.length
    ? `<p class="dom-deck-document__meta">${escapeHtml(metaParts.join(" · "))}</p>`
    : "";

  return [
    renderDocumentHead(config),
    "  <body class=\"dom-deck-document\">",
    "    <main class=\"dom-deck-document__page\">",
    `      <header class="dom-deck-document__header"><p class="eyebrow">Deck preview</p><h1>${title}</h1>${subjectLine}${metaLine}</header>`,
    renderDeckMarkup(config.slides || [], { theme: config.theme }),
    "    </main>",
    "  </body>",
    "</html>"
  ].join("\n");
}

export function renderSlideDocument(payload: unknown): string {
  const config = toDocumentPayload(payload);
  const slideSpec = toSlideSpec(config.slideSpec);

  return [
    renderDocumentHead(config),
    "  <body class=\"dom-slide-document\">",
    "    <main class=\"dom-slide-document__page\">",
    renderSlideMarkup(slideSpec, {
      index: config.index,
      slideId: config.slideId,
      theme: config.theme,
      totalSlides: config.totalSlides
    }),
    "    </main>",
    "  </body>",
    "</html>"
  ].join("\n");
}

export function renderPresentationDocument(payload: unknown): string {
  const config = toDocumentPayload(payload);
  const title = escapeHtml(config.title || "Presentation");
  const slideEntries = toSlideEntries(config.slides);
  const coreSlideTotal = slideEntries
    .filter((entry: SlideEntry) => {
      const presentationY = toFiniteNumber(entry.presentationY);
      return presentationY === null || presentationY === 0;
    })
    .length || slideEntries.length || 1;
  const detourTotalsByX = slideEntries.reduce((totals: Record<string, number>, entry: SlideEntry) => {
    const presentationX = toFiniteNumber(entry.presentationX);
    const presentationY = toFiniteNumber(entry.presentationY);
    if (presentationX !== null && presentationY !== null && presentationY > 0) {
      const key = String(presentationX);
      totals[key] = Math.max(totals[key] || 0, presentationY);
    }

    return totals;
  }, {});

  return [
    renderDocumentHead(config),
    "  <body class=\"dom-presentation-document\">",
    "    <main class=\"dom-presentation-document__page\">",
    `      <section class="dom-presentation-document__slides" aria-label="${title} slides">`,
    slideEntries.map((entry: SlideEntry, slideIndex: number) => {
      const presentationX = toFiniteNumberOr(entry.presentationX, slideIndex + 1);
      const presentationY = toFiniteNumberOr(entry.presentationY, 0);
      const progressIndex = presentationY > 0 ? presentationY : presentationX;
      const progressTotal = presentationY > 0 ? detourTotalsByX[String(presentationX)] || presentationY : coreSlideTotal;

      return renderSlideMarkup(entry.slideSpec, {
        index: toFiniteNumberOr(entry.index, slideIndex + 1),
        presentationX,
        presentationY,
        progressIndex,
        progressTotal,
        slideId: entry.id,
        theme: config.theme,
        totalSlides: slideEntries.length || 1
      });
    }).join(""),
    "      </section>",
    "    </main>",
    `    <script>\n${renderPresentationScript()}\n    </script>`,
    "  </body>",
    "</html>"
  ].join("\n");
}

const api: SlideDomRendererApi = {
  normalizeTheme,
  renderDeckDocument,
  renderPresentationDocument,
  renderSlideDocument,
  renderDeckMarkup,
  renderSlideMarkup
};

const slideDomGlobalScope = typeof globalThis !== "undefined"
  ? globalThis as typeof globalThis & { SlideDomRenderer?: SlideDomRendererApi }
  : null;

if (slideDomGlobalScope) {
  slideDomGlobalScope.SlideDomRenderer = api;
}
