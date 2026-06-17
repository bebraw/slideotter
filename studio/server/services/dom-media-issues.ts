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

type MediaIssueContext = {
  captionTexts: Set<string>;
  minCaptionGapIn: number;
  minCaptionGapPx: number;
  minProgressGapIn: number;
  minProgressGapPx: number;
  maxCaptionGapPx: number;
  progressRect: NormalizedRect | null;
  slideIndex: number | string;
  slideRect: NormalizedRect | null;
  textItems: TextItem[];
  validationSettings: ValidationSettings;
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

function collectSingleMediaIssues(item: MediaItem, context: MediaIssueContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rect = normalizeRect(item.rect);
  const descriptor = describeDomNode(item);
  const shortEdge = Math.min(rect.width, rect.height);
  const area = rect.width * rect.height;
  const isRaster = item.tagName === "img" || item.tagName === "video";

  if (shortEdge < 96 || area < 180 * 120) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "media-legibility",
      `Media "${descriptor}" renders small enough to risk legibility (${(rect.width / PX_PER_INCH).toFixed(2)}in x ${(rect.height / PX_PER_INCH).toFixed(2)}in)`,
      context.validationSettings
    ));
  }

  if (context.slideRect) {
    const outside = (
      rect.left < context.slideRect.left - 1 ||
      rect.top < context.slideRect.top - 1 ||
      rect.right > context.slideRect.right + 1 ||
      rect.bottom > context.slideRect.bottom + 1
    );

    if (outside) {
      issues.push(createConfiguredIssue(
        context.slideIndex,
        "error",
        "bounds",
        `Media "${descriptor}" exceeds the slide viewport`,
        context.validationSettings
      ));
    }
  }

  if (isRaster && item.complete === false) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "media-legibility",
      `Media "${descriptor}" did not finish loading before validation`,
      context.validationSettings
    ));
  }

  if (item.tagName === "img" && (!item.naturalWidth || !item.naturalHeight)) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "media-legibility",
      `Image "${descriptor}" has no readable native dimensions`,
      context.validationSettings
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
        context.slideIndex,
        "warn",
        "media-legibility",
        `Media "${descriptor}" is scaled above native resolution (${maxScale.toFixed(2)}x)`,
        context.validationSettings
      ));
    }

    if (ratioDelta > 0.08 && objectFit === "cover") {
      issues.push(createConfiguredIssue(
        context.slideIndex,
        "warn",
        "media-legibility",
        `Media "${descriptor}" may crop because it fills a region with a different aspect ratio (${naturalRatio.toFixed(2)} native vs ${renderedRatio.toFixed(2)} region)`,
        context.validationSettings
      ));
    } else if (ratioDelta > 0.08 && objectFit !== "contain") {
      issues.push(createConfiguredIssue(
        context.slideIndex,
        "warn",
        "media-legibility",
        `Media "${descriptor}" distorts its native aspect ratio (${naturalRatio.toFixed(2)} native vs ${renderedRatio.toFixed(2)} rendered)`,
        context.validationSettings
      ));
    }
  }

  const needsReadableLabel = item.tagName === "img" ||
    item.tagName === "svg" ||
    /\b(dom-screenshot|dom-diagram|dom-media)\b/.test(String(item.className || ""));
  if (needsReadableLabel && !String(item.accessibleLabel || "").trim()) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "media-legibility",
      `Media "${descriptor}" is missing a readable alt or aria label`,
      context.validationSettings
    ));
  }

  if (context.progressRect) {
    const progressDistance = shortestDistanceBetweenRects(rect, context.progressRect);
    if (progressDistance < context.minProgressGapPx) {
      issues.push(createConfiguredIssue(
        context.slideIndex,
        "warn",
        "media-legibility",
        `Media "${descriptor}" is closer than ${context.minProgressGapIn.toFixed(2)}in to the progress area (${(progressDistance / PX_PER_INCH).toFixed(2)}in)`,
        context.validationSettings
      ));
    }
  }

  context.textItems.forEach((textItem) => {
    const text = String(textItem.text || "").replace(/\s+/g, " ").trim();
    const className = String(textItem.className || "");
    const parentClassName = String(textItem.parentClassName || "");
    if (!text || context.captionTexts.has(text) || /badge|eyebrow/.test(className) || /badge|eyebrow/.test(parentClassName)) {
      return;
    }

    const intersection = getRectIntersection(rect, textItem.rect);
    if (intersection.area < 16 || intersection.width < 4 || intersection.height < 4) {
      return;
    }

    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "media-legibility",
      `Media "${descriptor}" overlaps text "${text.slice(0, 48)}"`,
      context.validationSettings
    ));
  });

  return issues;
}

function collectCaptionIssues(caption: CaptionItem, mediaItems: MediaItem[], context: MediaIssueContext): ValidationIssue[] {
  const nearest = findNearestMedia(caption, mediaItems);
  if (!nearest) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const captionRect = normalizeRect(caption.rect);
  const mediaRect = normalizeRect(nearest.media.rect);
  const captionLabel = describeDomNode(caption, "caption");
  const mediaLabel = describeDomNode(nearest.media);

  if (nearest.distance < context.minCaptionGapPx) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "caption-source-spacing",
      `Caption/source "${captionLabel}" is closer than ${context.minCaptionGapIn.toFixed(2)}in to media "${mediaLabel}" (${(nearest.distance / PX_PER_INCH).toFixed(2)}in)`,
      context.validationSettings
    ));
  } else if (nearest.distance > context.maxCaptionGapPx) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "caption-source-spacing",
      `Caption/source "${captionLabel}" is detached from nearest media "${mediaLabel}" (${(nearest.distance / PX_PER_INCH).toFixed(2)}in)`,
      context.validationSettings
    ));
  }

  if (captionRect.bottom <= mediaRect.top - 1) {
    issues.push(createConfiguredIssue(
      context.slideIndex,
      "warn",
      "caption-source-spacing",
      `Caption/source "${captionLabel}" sits above nearest media "${mediaLabel}"; attach captions below the visual when possible`,
      context.validationSettings
    ));
  }

  if (context.progressRect) {
    const progressDistance = shortestDistanceBetweenRects(captionRect, context.progressRect);
    if (progressDistance < context.minProgressGapPx) {
      issues.push(createConfiguredIssue(
        context.slideIndex,
        "warn",
        "caption-source-spacing",
        `Caption/source "${captionLabel}" is closer than ${context.minProgressGapIn.toFixed(2)}in to the progress area (${(progressDistance / PX_PER_INCH).toFixed(2)}in)`,
        context.validationSettings
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
      context.slideIndex,
      "warn",
      "caption-source-spacing",
      `Caption/source "${captionLabel}" does not horizontally align with nearest media "${mediaLabel}"`,
      context.validationSettings
    ));
  }

  return issues;
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
  const context: MediaIssueContext = {
    captionTexts,
    maxCaptionGapPx,
    minCaptionGapIn,
    minCaptionGapPx,
    minProgressGapIn,
    minProgressGapPx,
    progressRect,
    slideIndex: slideEntry.index,
    slideRect,
    textItems,
    validationSettings
  };

  mediaItems.forEach((item) => {
    issues.push(...collectSingleMediaIssues(item, context));
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
    issues.push(...collectCaptionIssues(caption, mediaItems, context));
  });

  return issues;
}
