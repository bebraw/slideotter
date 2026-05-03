import { editAttrs, escapeHtml, isRecord } from "./html.ts";
import { renderSlideotterLogo } from "./logo.ts";
import { mediaImageStyle, renderCustomVisual, renderSlideMedia } from "./media.ts";
import { getSlotRegionLayoutDefinition, renderSlotRegion } from "./slot-region-layout.ts";
import {
  toItems,
  toMediaItems,
  type CardItem,
  type MediaItem,
  type SlideSpec,
  type SlotRegion
} from "./slide-data.ts";

function renderSectionHeader(slideSpec: SlideSpec): string {
  return `
    <header class="dom-slide__section-header">
      <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
      <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
      <p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
    </header>
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

export function renderSlideBody(slideSpec: SlideSpec): string {
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
