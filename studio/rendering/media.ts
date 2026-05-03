import { isSafeInlineCustomVisualContent } from "./custom-visuals.ts";
import { escapeHtml, isRecord, type JsonRecord } from "./html.ts";
import { type SlideSpec } from "./slide-data.ts";

export function mediaImageStyle(media: JsonRecord, fallbackFit = "contain"): string {
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

export function renderSlideMedia(slideSpec: SlideSpec): string {
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

export function renderCustomVisual(slideSpec: SlideSpec): string {
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
