import {
  getRectIntersection,
  normalizeRect,
  shortestDistanceBetweenRects,
  type NormalizedRect,
  type RectLike
} from "./dom-geometry.ts";
import { resolveValidationLevel } from "./validation-settings.ts";

const PX_PER_INCH = 96;

type ValidationLevel = "error" | "warn";

type ValidationSettings = {
  mediaValidationMode?: "complete" | "fast";
};

type ValidationOptions = {
  captionSpacing?: {
    minGap?: number;
  };
  contentSpacing?: {
    minGap?: number;
  };
};

type SlideEntry = {
  index: number | string;
};

type ValidationIssue = {
  level: ValidationLevel;
  message: string;
  rule: string;
  slide: number | string;
};

type TextItem = {
  className: string;
  parentClassName: string;
  rect: NormalizedRect;
  text: string;
};

type MediaItem = {
  accessibleLabel: string;
  alt: string;
  className: string;
  complete: boolean;
  label: string;
  naturalHeight: number;
  naturalWidth: number;
  objectFit: string;
  rect: NormalizedRect;
  tagName: string;
};

type CaptionItem = {
  className: string;
  rect: NormalizedRect;
  tagName: string;
  text: string;
};

type DomMediaValidationData = {
  captionItems: CaptionItem[];
  mediaItems: MediaItem[];
  progressRect: RectLike | null;
  slideRect: RectLike | null;
  textItems: TextItem[];
};

type NearestMedia = {
  absoluteDistance: number;
  distance: number;
  media: MediaItem;
};

function createIssue(
  slide: number | string,
  level: ValidationLevel,
  rule: string,
  message: string
): ValidationIssue {
  return {
    level,
    message,
    rule,
    slide
  };
}

function createConfiguredIssue(
  slide: number | string,
  fallbackLevel: ValidationLevel,
  rule: string,
  message: string,
  validationSettings: ValidationSettings
): ValidationIssue {
  return createIssue(
    slide,
    resolveValidationLevel(rule, fallbackLevel, validationSettings),
    rule,
    message
  );
}

function describeDomNode(item: Partial<CaptionItem & MediaItem>, fallback = "media"): string {
  const label = String(
    item.label ||
    item.alt ||
    item.className ||
    item.tagName ||
    fallback
  ).replace(/\s+/g, " ").trim();

  return label || fallback;
}

function findNearestMedia(caption: CaptionItem, mediaItems: MediaItem[]): NearestMedia | null {
  let nearest: NearestMedia | null = null;

  mediaItems.forEach((media) => {
    const distance = shortestDistanceBetweenRects(media.rect, caption.rect);
    const absoluteDistance = Math.abs(distance);

    if (!nearest || absoluteDistance < nearest.absoluteDistance) {
      nearest = {
        absoluteDistance,
        distance,
        media
      };
    }
  });

  return nearest;
}

export function collectMediaIssues(
  slideEntry: SlideEntry,
  domData: DomMediaValidationData,
  validationOptions: ValidationOptions,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const mode = validationSettings && validationSettings.mediaValidationMode === "complete"
    ? "complete"
    : "fast";

  if (mode === "fast") {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const mediaItems = Array.isArray(domData.mediaItems) ? domData.mediaItems : [];
  const captionItems = Array.isArray(domData.captionItems) ? domData.captionItems : [];
  const captionTexts = new Set(captionItems.map((caption) => String(caption.text || "").replace(/\s+/g, " ").trim()).filter(Boolean));
  const textItems = Array.isArray(domData.textItems) ? domData.textItems : [];
  const minCaptionGapIn = validationOptions.captionSpacing && validationOptions.captionSpacing.minGap
    ? validationOptions.captionSpacing.minGap
    : 0.1;
  const minCaptionGapPx = minCaptionGapIn * PX_PER_INCH;
  const minProgressGapIn = validationOptions.contentSpacing && validationOptions.contentSpacing.minGap
    ? validationOptions.contentSpacing.minGap
    : 0.18;
  const minProgressGapPx = minProgressGapIn * PX_PER_INCH;
  const maxCaptionGapIn = Math.max(0.5, minCaptionGapIn * 6);
  const maxCaptionGapPx = maxCaptionGapIn * PX_PER_INCH;
  const progressRect = domData.progressRect ? normalizeRect(domData.progressRect) : null;
  const slideRect = domData.slideRect ? normalizeRect(domData.slideRect) : null;

  mediaItems.forEach((item) => {
    const rect = normalizeRect(item.rect);
    const descriptor = describeDomNode(item);
    const shortEdge = Math.min(rect.width, rect.height);
    const area = rect.width * rect.height;
    const isRaster = item.tagName === "img" || item.tagName === "video";

    if (shortEdge < 96 || area < 180 * 120) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" renders small enough to risk legibility (${(rect.width / PX_PER_INCH).toFixed(2)}in x ${(rect.height / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }

    if (slideRect) {
      const outside = (
        rect.left < slideRect.left - 1 ||
        rect.top < slideRect.top - 1 ||
        rect.right > slideRect.right + 1 ||
        rect.bottom > slideRect.bottom + 1
      );

      if (outside) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "error",
          "bounds",
          `Media "${descriptor}" exceeds the slide viewport`,
          validationSettings
        ));
      }
    }

    if (isRaster && item.complete === false) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" did not finish loading before validation`,
        validationSettings
      ));
    }

    if (item.tagName === "img" && (!item.naturalWidth || !item.naturalHeight)) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Image "${descriptor}" has no readable native dimensions`,
        validationSettings
      ));
    }

    if (isRaster && item.naturalWidth && item.naturalHeight) {
      const widthScale = rect.width / item.naturalWidth;
      const heightScale = rect.height / item.naturalHeight;
      const maxScale = Math.max(widthScale, heightScale);
      const naturalRatio = item.naturalWidth / item.naturalHeight;
      const renderedRatio = rect.width / rect.height;
      const ratioDelta = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
      const objectFit = String(item.objectFit || "").toLowerCase();

      if (maxScale > 1.15) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "media-legibility",
          `Media "${descriptor}" is scaled above native resolution (${maxScale.toFixed(2)}x)`,
          validationSettings
        ));
      }

      if (ratioDelta > 0.08 && objectFit === "cover") {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "media-legibility",
          `Media "${descriptor}" may crop because it fills a region with a different aspect ratio (${naturalRatio.toFixed(2)} native vs ${renderedRatio.toFixed(2)} region)`,
          validationSettings
        ));
      } else if (ratioDelta > 0.08 && objectFit !== "contain") {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "media-legibility",
          `Media "${descriptor}" distorts its native aspect ratio (${naturalRatio.toFixed(2)} native vs ${renderedRatio.toFixed(2)} rendered)`,
          validationSettings
        ));
      }
    }

    const needsReadableLabel = item.tagName === "img" ||
      item.tagName === "svg" ||
      /\b(dom-screenshot|dom-diagram|dom-media)\b/.test(String(item.className || ""));
    if (needsReadableLabel && !String(item.accessibleLabel || "").trim()) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" is missing a readable alt or aria label`,
        validationSettings
      ));
    }

    if (progressRect) {
      const progressDistance = shortestDistanceBetweenRects(rect, progressRect);
      if (progressDistance < minProgressGapPx) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "media-legibility",
          `Media "${descriptor}" is closer than ${minProgressGapIn.toFixed(2)}in to the progress area (${(progressDistance / PX_PER_INCH).toFixed(2)}in)`,
          validationSettings
        ));
      }
    }

    textItems.forEach((textItem) => {
      const text = String(textItem.text || "").replace(/\s+/g, " ").trim();
      const className = String(textItem.className || "");
      const parentClassName = String(textItem.parentClassName || "");
      if (!text || captionTexts.has(text) || /badge|eyebrow/.test(className) || /badge|eyebrow/.test(parentClassName)) {
        return;
      }

      const intersection = getRectIntersection(rect, textItem.rect);
      if (intersection.area < 16 || intersection.width < 4 || intersection.height < 4) {
        return;
      }

      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" overlaps text "${text.slice(0, 48)}"`,
        validationSettings
      ));
    });
  });

  if (!mediaItems.length) {
    captionItems.forEach((caption) => {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "caption-source-spacing",
        `Caption/source "${describeDomNode(caption, "caption")}" has no rendered media to attach to`,
        validationSettings
      ));
    });

    return issues;
  }

  captionItems.forEach((caption) => {
    const nearest = findNearestMedia(caption, mediaItems);
    if (!nearest) {
      return;
    }

    const captionRect = normalizeRect(caption.rect);
    const mediaRect = normalizeRect(nearest.media.rect);

    if (nearest.distance < minCaptionGapPx) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "caption-source-spacing",
        `Caption/source "${describeDomNode(caption, "caption")}" is closer than ${minCaptionGapIn.toFixed(2)}in to media "${describeDomNode(nearest.media)}" (${(nearest.distance / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    } else if (nearest.distance > maxCaptionGapPx) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "caption-source-spacing",
        `Caption/source "${describeDomNode(caption, "caption")}" is detached from nearest media "${describeDomNode(nearest.media)}" (${(nearest.distance / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }

    if (captionRect.bottom <= mediaRect.top - 1) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "caption-source-spacing",
        `Caption/source "${describeDomNode(caption, "caption")}" sits above nearest media "${describeDomNode(nearest.media)}"; attach captions below the visual when possible`,
        validationSettings
      ));
    }

    if (progressRect) {
      const progressDistance = shortestDistanceBetweenRects(captionRect, progressRect);
      if (progressDistance < minProgressGapPx) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "caption-source-spacing",
          `Caption/source "${describeDomNode(caption, "caption")}" is closer than ${minProgressGapIn.toFixed(2)}in to the progress area (${(progressDistance / PX_PER_INCH).toFixed(2)}in)`,
          validationSettings
        ));
      }
    }

    const horizontalOverlap = Math.max(
      0,
      Math.min(captionRect.right, mediaRect.right) - Math.max(captionRect.left, mediaRect.left)
    );
    const minUsefulOverlap = Math.min(captionRect.width, mediaRect.width) * 0.25;
    if (captionRect.top >= mediaRect.bottom - 1 && horizontalOverlap < minUsefulOverlap) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "caption-source-spacing",
        `Caption/source "${describeDomNode(caption, "caption")}" does not horizontally align with nearest media "${describeDomNode(nearest.media)}"`,
        validationSettings
      ));
    }
  });

  return issues;
}
