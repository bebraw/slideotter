import { isSafeInlineCustomVisualContent } from "./custom-visuals.ts";
import { asRecord, editAttrs, escapeHtml, isRecord, toFiniteNumber, toFiniteNumberOr, type JsonRecord } from "./html.ts";
import { renderSlideotterLogo } from "./logo.ts";
import { renderPresentationScript } from "./presentation-script.ts";
import {
  toDocumentPayload,
  toItems,
  toMediaItems,
  toSlideEntries,
  toSlideSpec,
  type CardItem,
  type DocumentMetadata,
  type DocumentPayload,
  type MediaItem,
  type SlideEntry,
  type SlideSpec,
  type SlotRegion,
  type SlotRegionLayoutDefinition
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

function normalizeGridNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function getSlotRegionLayoutDefinition(slideSpec: SlideSpec): SlotRegionLayoutDefinition | null {
  const definition = isRecord(slideSpec.layoutDefinition)
    ? slideSpec.layoutDefinition
    : null;
  if (!definition || definition.type !== "slotRegionLayout" || !Array.isArray(definition.regions)) {
    return null;
  }
  return {
    ...definition,
    regions: definition.regions.filter(isRecord),
    type: "slotRegionLayout"
  };
}

function renderSlotRegionStyle(region: SlotRegion, definition: SlotRegionLayoutDefinition): string {
  const minFontSize = definition && definition.constraints
    ? normalizeGridNumber(definition.constraints.minFontSize, 18, 12, 44)
    : 18;
  const column = normalizeGridNumber(region && region.column, 1, 1, 12);
  const columnSpan = normalizeGridNumber(region && region.columnSpan, 4, 1, 12);
  const row = normalizeGridNumber(region && region.row, 1, 1, 8);
  const rowSpan = normalizeGridNumber(region && region.rowSpan, 2, 1, 8);

  return [
    `grid-column:${column} / span ${columnSpan}`,
    `grid-row:${row} / span ${rowSpan}`,
    `--dom-custom-min-font:${minFontSize}px`
  ].join(";");
}

function renderSlotRegion(region: SlotRegion, definition: SlotRegionLayoutDefinition, body: string): string {
  if (!body) {
    return "";
  }

  const slot = region && region.slot ? String(region.slot) : "";
  const spacing = region && region.spacing
    ? String(region.spacing).replace(/[^a-z0-9-]/gi, "")
    : "normal";

  return `
    <section class="dom-slide__custom-layout-region dom-slide__custom-layout-region--${escapeHtml(slot || "slot")} dom-slide__custom-layout-region--${escapeHtml(spacing)}" style="${escapeHtml(renderSlotRegionStyle(region, definition))}">
      ${body}
    </section>
  `;
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

function renderSectionHeader(slideSpec: SlideSpec): string {
  return `
    <header class="dom-slide__section-header">
      <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
      <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
      <p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
    </header>
  `;
}

function mediaImageStyle(media: JsonRecord, fallbackFit = "contain"): string {
  const fit = String(media.fit || "").trim().toLowerCase() === "cover"
    ? "cover"
    : String(media.fit || "").trim().toLowerCase() === "contain"
      ? "contain"
      : fallbackFit;
  const focalPoint = String(media.focalPoint || "").trim().toLowerCase();
  const focalPoints: Record<string, string> = {
    "bottom": "50% 100%",
    "bottom-left": "0% 100%",
    "bottom-right": "100% 100%",
    "center": "50% 50%",
    "left": "0% 50%",
    "right": "100% 50%",
    "top": "50% 0%",
    "top-left": "0% 0%",
    "top-right": "100% 0%"
  };
  return `object-fit:${fit};object-position:${focalPoints[focalPoint] || focalPoints.center}`;
}

function renderSlideMedia(slideSpec: SlideSpec): string {
  const media = isRecord(slideSpec.media)
    ? slideSpec.media
    : null;
  if (!media || !media.src || !media.alt) {
    return "";
  }

  const caption = media.caption
    ? `<figcaption class="dom-caption"><span class="source">${escapeHtml(media.caption)}</span></figcaption>`
    : "";

  return `
    <figure class="dom-slide__media dom-media">
      <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" style="${escapeHtml(mediaImageStyle(media, "contain"))}">
      ${caption}
    </figure>
  `;
}

function renderCustomVisual(slideSpec: SlideSpec): string {
  const customVisual = isRecord(slideSpec.customVisual)
    ? slideSpec.customVisual
    : null;
  if (!customVisual || !isSafeInlineCustomVisualContent(customVisual.content)) {
    return "";
  }

  const description = customVisual.description || customVisual.title || "";
  const caption = description
    ? `<figcaption class="dom-caption"><span class="source">${escapeHtml(description)}</span></figcaption>`
    : "";

  return `
    <figure class="dom-slide__media dom-slide__custom-visual" aria-label="${escapeHtml(customVisual.title || "Custom visual")}">
      <div class="dom-slide__custom-visual-frame">
        ${String(customVisual.content)}
      </div>
      ${caption}
    </figure>
  `;
}

function renderCompactCard(card: CardItem, index: number, basePath: string): string {
  const path = basePath ? `${basePath}.${index}` : `cards.${index}`;
  return `
    <article class="dom-card">
      <h3${editAttrs(`${path}.title`, "Card title")}>${escapeHtml(card.title || "")}</h3>
      <p${editAttrs(`${path}.body`, "Card body")}>${escapeHtml(card.body || "")}</p>
    </article>
  `;
}

function renderCoverSlotBody(slot: string, slideSpec: SlideSpec, cards: CardItem[], logo: string): string {
  switch (slot) {
    case "title":
      return `
        ${logo}
        <div class="dom-slide__cover-rule"></div>
        <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h1 class="dom-slide__cover-title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
      `;
    case "summary":
      return `<p class="dom-slide__cover-summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>`;
    case "note":
      return `<p class="dom-slide__cover-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>`;
    case "cards":
      return `
        <section class="dom-slide__cover-cards">
          ${cards.map((card: CardItem, index: number) => renderCompactCard(card, index, "cards")).join("")}
        </section>
      `;
    default:
      return "";
  }
}

function renderCover(slideSpec: SlideSpec): string {
  const cards = toItems(slideSpec.cards);
  const logo = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec) || (slideSpec.logo === "slideotter" ? renderSlideotterLogo() : "");
  const customLayoutDefinition = getSlotRegionLayoutDefinition(slideSpec);
  if (customLayoutDefinition) {
    const regions = customLayoutDefinition.regions.map((region: SlotRegion) => {
      const slot = region && region.slot ? String(region.slot) : "";
      return renderSlotRegion(region, customLayoutDefinition, renderCoverSlotBody(slot, slideSpec, cards, logo));
    }).join("");

    return `
      <div class="dom-slide__custom-layout-grid dom-slide__custom-layout-grid--cover">
        ${regions}
      </div>
    `;
  }

  return `
    <div class="dom-slide__cover-grid">
      <section class="dom-slide__cover-copy">
        ${logo}
        <div class="dom-slide__cover-rule"></div>
        <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h1 class="dom-slide__cover-title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
        <p class="dom-slide__cover-summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
        <p class="dom-slide__cover-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>
      </section>
      <section class="dom-slide__cover-cards">
        ${cards.map((card: CardItem, index: number) => renderCompactCard(card, index, "cards")).join("")}
      </section>
    </div>
  `;
}

function renderDivider(slideSpec: SlideSpec): string {
  return `
    <section class="dom-slide__divider-title">
      <h1 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
    </section>
  `;
}

function renderQuote(slideSpec: SlideSpec): string {
  const attribution = slideSpec.attribution
    ? `<p class="dom-slide__quote-attribution"${editAttrs("attribution", "Attribution")}>${escapeHtml(slideSpec.attribution)}</p>`
    : "";
  const source = slideSpec.source
    ? `<p class="dom-slide__quote-source"${editAttrs("source", "Source")}>${escapeHtml(slideSpec.source)}</p>`
    : "";
  const context = slideSpec.context
    ? `<p class="dom-slide__quote-context"${editAttrs("context", "Context")}>${escapeHtml(slideSpec.context)}</p>`
    : "";

  return `
    <section class="dom-slide__quote-wrap">
      <p class="dom-slide__eyebrow"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</p>
      <blockquote class="dom-slide__quote"${editAttrs("quote", "Quote")}>${escapeHtml(slideSpec.quote || "")}</blockquote>
      <footer class="dom-slide__quote-footer">
        ${attribution}
        ${source}
        ${context}
      </footer>
    </section>
  `;
}

function renderPhoto(slideSpec: SlideSpec): string {
  const media = isRecord(slideSpec.media)
    ? slideSpec.media
    : null;
  const caption = slideSpec.caption || (media && media.caption) || "";
  const mediaMarkup = media && media.src && media.alt
    ? `
      <figure class="dom-slide__media dom-media">
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" style="${escapeHtml(mediaImageStyle(media, "cover"))}">
        ${caption ? `<figcaption class="dom-caption"${editAttrs("caption", "Caption")}><span class="source">${escapeHtml(caption)}</span></figcaption>` : ""}
      </figure>
    `
    : "";

  return `
    <section class="dom-slide__photo-wrap">
      <header class="dom-slide__photo-header">
        <h1 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
      </header>
      ${mediaMarkup}
    </section>
  `;
}

function renderPhotoGrid(slideSpec: SlideSpec): string {
  const mediaItems = toMediaItems(slideSpec.mediaItems).slice(0, 4);
  const count = Math.max(2, Math.min(4, mediaItems.length));
  const caption = slideSpec.caption || slideSpec.summary || "";
  const itemsMarkup = mediaItems.map((media: MediaItem) => {
    const itemCaption = media.caption || media.source || "";
    return `
      <figure class="dom-slide__photo-grid-item dom-slide__media dom-media">
        <img src="${escapeHtml(media.src || "")}" alt="${escapeHtml(media.alt || "")}" style="${escapeHtml(mediaImageStyle(media, "cover"))}">
        ${itemCaption ? `<figcaption class="dom-caption"><span class="source">${escapeHtml(itemCaption)}</span></figcaption>` : ""}
      </figure>
    `;
  }).join("");

  return `
    <section class="dom-slide__photo-grid-wrap dom-slide__photo-grid-wrap--${count}">
      <header class="dom-slide__photo-grid-header">
        <h1 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
        ${caption ? `<p class="dom-slide__summary"${editAttrs(slideSpec.caption ? "caption" : "summary", "Caption")}>${escapeHtml(caption)}</p>` : ""}
      </header>
      <div class="dom-slide__photo-grid">
        ${itemsMarkup}
      </div>
    </section>
  `;
}

function renderToc(slideSpec: SlideSpec): string {
  const cards = toItems(slideSpec.cards);
  const media = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec);
  return `
    ${renderSectionHeader(slideSpec)}
    <section class="dom-slide__toc-body${media ? " dom-slide__toc-body--with-media" : ""}">
      <div class="dom-slide__toc-copy">
        <div class="dom-slide__toc-cards">
          ${cards.map((card: CardItem, index: number) => renderCompactCard(card, index, "cards")).join("")}
        </div>
        <p class="dom-slide__toc-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>
      </div>
      ${media}
    </section>
  `;
}

function renderContentSlotBody({
  guardrailsMarkup,
  signalsMarkup,
  slideSpec,
  slot
}: {
  guardrailsMarkup: string;
  signalsMarkup: string;
  slideSpec: SlideSpec;
  slot: string;
}): string {
  switch (slot) {
    case "title":
      return `
        <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
      `;
    case "summary":
      return `<p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>`;
    case "signals":
      return `
        <article class="dom-panel dom-panel--signals">
          <h3${editAttrs("signalsTitle", "Signals title")}>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
          ${signalsMarkup}
        </article>
      `;
    case "guardrails":
      return `
        <article class="dom-panel dom-panel--guardrails">
          <h3${editAttrs("guardrailsTitle", "Guardrails title")}>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
          ${guardrailsMarkup}
        </article>
      `;
    default:
      return "";
  }
}

function renderContent(slideSpec: SlideSpec): string {
  const signals = toItems(slideSpec.signals);
  const guardrails = toItems(slideSpec.guardrails);
  const renderSignalCards = signals.some((item: CardItem) => Boolean(item && (item.title || item.body)));
  const renderGuardrailCards = guardrails.some((item: CardItem) => Boolean(item && (item.title || item.body)));
  const media = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec);
  const customLayoutDefinition = !media ? getSlotRegionLayoutDefinition(slideSpec) : null;
  const signalsMarkup = renderSignalCards ? `
    <div class="dom-evidence-list">
      ${signals.map((item: CardItem, index: number) => renderEvidenceItem(item, index, "signals", "Signal")).join("")}
    </div>
  ` : `
    <div class="dom-signal-list">
      ${signals.map((item: CardItem, index: number) => {
        const value = Math.max(0, Math.min(100, Math.round(Number(item.value || 0) * 100)));
        return `
          <div class="dom-signal">
            <div class="dom-signal__meta">
              <span${editAttrs(`signals.${index}.label`, "Signal label")}>${escapeHtml(item.label || "")}</span>
              <strong>${value}%</strong>
            </div>
            <div class="dom-signal__track">
              <div class="dom-signal__fill" style="width:${value}%;"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
  const guardrailsMarkup = renderGuardrailCards ? `
    <div class="dom-evidence-list">
      ${guardrails.map((item: CardItem, index: number) => renderEvidenceItem(item, index, "guardrails", "Guardrail")).join("")}
    </div>
  ` : `
    <div class="dom-guardrail-list">
      ${guardrails.map((item: CardItem, index: number) => `
        <div class="dom-guardrail${index < guardrails.length - 1 ? " dom-guardrail--divided" : ""}">
          <strong${editAttrs(`guardrails.${index}.value`, "Guardrail value")}>${escapeHtml(item.value || "")}</strong>
          <span${editAttrs(`guardrails.${index}.label`, "Guardrail label")}>${escapeHtml(item.label || "")}</span>
        </div>
      `).join("")}
    </div>
  `;
  if (customLayoutDefinition) {
    const regions = customLayoutDefinition.regions.map((region: SlotRegion) => {
      const slot = region && region.slot ? String(region.slot) : "";
      return renderSlotRegion(region, customLayoutDefinition, renderContentSlotBody({
        guardrailsMarkup,
        signalsMarkup,
        slideSpec,
        slot
      }));
    }).join("");

    return `
      <div class="dom-slide__custom-layout-grid">
        ${regions}
      </div>
    `;
  }
  const columnsMarkup = `
      <div class="dom-slide__content-columns${media ? " dom-slide__content-columns--stacked" : ""}">
        <article class="dom-panel dom-panel--signals">
          <h3${editAttrs("signalsTitle", "Signals title")}>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
          ${signalsMarkup}
        </article>
        <article class="dom-panel dom-panel--guardrails">
          <h3${editAttrs("guardrailsTitle", "Guardrails title")}>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
          ${guardrailsMarkup}
        </article>
      </div>
  `;

  return `
    ${renderSectionHeader(slideSpec)}
    ${media ? `
    <section class="dom-slide__content-with-media">
      ${columnsMarkup}
      ${media}
    </section>
    ` : columnsMarkup}
  `;
}

function renderEvidenceItem(item: CardItem, index: number, basePath: string, labelPrefix: string): string {
  const title = item.title || item.label || "";
  const body = item.body || item.value || "";

  return `
    <article class="dom-evidence">
      <h4${editAttrs(`${basePath}.${index}.title`, `${labelPrefix} title`)}>${escapeHtml(title)}</h4>
      <p${editAttrs(`${basePath}.${index}.body`, `${labelPrefix} body`)}>${escapeHtml(body)}</p>
    </article>
  `;
}

function renderSummary(slideSpec: SlideSpec): string {
  const bullets = toItems(slideSpec.bullets);
  const resources = toItems(slideSpec.resources);
  const media = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec);
  const columnsMarkup = `
    <div class="dom-slide__summary-columns${media ? " dom-slide__summary-columns--stacked" : ""}">
      <div class="dom-bullet-list">
        ${bullets.map((item: CardItem, index: number) => `
          <article class="dom-bullet">
            <span class="dom-bullet__dot"></span>
            <div class="dom-bullet__copy">
              <h3${editAttrs(`bullets.${index}.title`, "Bullet title")}>${escapeHtml(item.title || "")}</h3>
              <p${editAttrs(`bullets.${index}.body`, "Bullet body")}>${escapeHtml(item.body || "")}</p>
            </div>
          </article>
        `).join("")}
      </div>
      <aside class="dom-panel dom-panel--resources">
        <p class="dom-panel__eyebrow"${editAttrs("resourcesTitle", "Resources title")}>${escapeHtml(slideSpec.resourcesTitle || "")}</p>
        <div class="dom-resource-list">
          ${resources.map((resource: CardItem, index: number) => renderCompactCard(resource, index, "resources")).join("")}
        </div>
      </aside>
    </div>
  `;

  return `
    ${renderSectionHeader(slideSpec)}
    ${media ? `
    <section class="dom-slide__summary-with-media">
      ${columnsMarkup}
      ${media}
    </section>
    ` : columnsMarkup}
  `;
}

function renderUnsupported(slideSpec: SlideSpec): string {
  return `
    <div class="dom-slide__unsupported">
      <p class="dom-slide__eyebrow">Unsupported</p>
      <h2 class="dom-slide__title">${escapeHtml(slideSpec && slideSpec.title ? slideSpec.title : "Slide preview unavailable")}</h2>
      <p class="dom-slide__summary">This slide type is not yet part of the DOM renderer.</p>
    </div>
  `;
}

function renderSlideBody(slideSpec: SlideSpec): string {
  switch (slideSpec && slideSpec.type) {
    case "divider":
      return renderDivider(slideSpec);
    case "quote":
      return renderQuote(slideSpec);
    case "photo":
      return renderPhoto(slideSpec);
    case "photoGrid":
      return renderPhotoGrid(slideSpec);
    case "cover":
      return renderCover(slideSpec);
    case "toc":
      return renderToc(slideSpec);
    case "content":
      return renderContent(slideSpec);
    case "summary":
      return renderSummary(slideSpec);
    default:
      return renderUnsupported(slideSpec);
  }
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
