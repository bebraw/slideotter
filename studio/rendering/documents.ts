import { asRecord, escapeHtml, toFiniteNumber, toFiniteNumberOr } from "./html.ts";
import { renderPresentationScript } from "./presentation-script.ts";
import {
  toDocumentPayload,
  toSlideEntries,
  toSlideSpec,
  type DocumentMetadata,
  type DocumentPayload,
  type SlideEntry
} from "./slide-data.ts";
import { renderSlideMarkup } from "./slide-dom.ts";

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
