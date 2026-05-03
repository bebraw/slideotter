import { getValidationConstraintOptions, readDesignConstraints } from "./design-constraints.ts";
import { createStandaloneSlideHtml, withBrowser } from "./dom-export.ts";
import {
  getRectIntersection,
  normalizeRect,
  shortestDistanceBetweenRects,
  unionRects,
  type NormalizedRect,
  type RectLike
} from "./dom-geometry.ts";
import { getDomPreviewState } from "./dom-preview.ts";
import { collectTextIssues } from "./dom-text-issues.ts";
import { readValidationSettings, resolveValidationLevel } from "./validation-settings.ts";

const PX_PER_INCH = 96;

type Browser = import("playwright").Browser;
type Page = import("playwright").Page;

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
  minimumFontSize?: {
    minFontSizePt?: number;
  };
  slideWordCount?: {
    maxWordsPerSlide?: number;
  };
  textPadding?: {
    minBottom?: number;
    minHorizontal?: number;
    minTop?: number;
  };
};

type SlideEntry = {
  id?: string;
  index: number | string;
  slideSpec?: unknown;
  title?: string;
};

type PreviewState = {
  lang?: string;
  metadata?: unknown;
  slides: SlideEntry[];
  theme?: unknown;
  title?: string;
};

type ValidationIssue = {
  level: ValidationLevel;
  message: string;
  rule: string;
  slide: number | string;
};

type CurrentSlideValidationState = "blocked" | "draft-unchecked" | "looks-good" | "needs-attention";

type TextItem = {
  backgroundColor: string;
  className: string;
  clientHeight: number;
  clientWidth: number;
  color: string;
  fontSizePx: number;
  parentClassName: string;
  rect: NormalizedRect;
  scrollHeight: number;
  scrollWidth: number;
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
  objectPosition: string;
  rect: NormalizedRect;
  tagName: string;
};

type CaptionItem = {
  className: string;
  rect: NormalizedRect;
  tagName: string;
  text: string;
};

type EdgeRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type PanelBox = {
  className: string;
  rect: EdgeRect;
  textRects: EdgeRect[];
};

type ContentGroupGap = {
  className: string;
  gaps: {
    currentClassName: string;
    gap: number;
    previousClassName: string;
  }[];
};

type DomValidationData = {
  captionItems: CaptionItem[];
  contentGroupGaps?: ContentGroupGap[];
  contentRects: RectLike[];
  mediaItems: MediaItem[];
  panelBoxes: PanelBox[];
  progressRect: RectLike | null;
  sectionHeaderRect: RectLike | null;
  slideRect: RectLike | null;
  textItems: TextItem[];
  wordCount: number;
  workflowRegions?: Record<string, unknown>;
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

function summarizeIssues(issues: ValidationIssue[]) {
  return {
    errors: issues.filter((issue) => issue.level === "error"),
    issues,
    ok: !issues.some((issue) => issue.level === "error")
  };
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

function evaluateSlideInDom(slideEntry: SlideEntry, previewState: PreviewState) {
  const html = createStandaloneSlideHtml(previewState, slideEntry);

  return async (page: Page): Promise<DomValidationData> => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.setContent(html, { waitUntil: "load" });

    return page.evaluate((): DomValidationData => {
      function countWords(value: unknown): number {
        return String(value || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .length;
      }

      function isPresent<T>(value: T | null): value is T {
        return value !== null;
      }

      const slide = document.querySelector(".dom-slide");
      if (!slide) {
        return {
          captionItems: [],
          contentRects: [],
          mediaItems: [],
          panelBoxes: [],
          progressRect: null,
          sectionHeaderRect: null,
          slideRect: null,
          textItems: [],
          wordCount: 0,
          workflowRegions: {}
        };
      }

      const slideRect = slide.getBoundingClientRect();
      const slideStyle = window.getComputedStyle(slide);

      function isVisibleBackground(value: string): boolean {
        return Boolean(value && value !== "transparent" && !/^rgba\(0,\s*0,\s*0,\s*0\)$/.test(value));
      }

      function findEffectiveBackground(element: Element): string {
        let current: Element | null = element;

        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          if (isVisibleBackground(style.backgroundColor)) {
            return style.backgroundColor;
          }
          current = current.parentElement;
        }

        return slideStyle.backgroundColor;
      }

      const textSelector = ".dom-slide h1, .dom-slide h2, .dom-slide h3, .dom-slide p, .dom-slide span, .dom-slide strong";
      const textItems = Array.from(document.querySelectorAll(textSelector))
        .map((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return {
            backgroundColor: findEffectiveBackground(element),
            className: getClassName(element) || element.tagName.toLowerCase(),
            clientHeight: element.clientHeight || rect.height,
            clientWidth: element.clientWidth || rect.width,
            color: style.color,
            fontSizePx: Number.parseFloat(style.fontSize) || 0,
            parentClassName: element.parentElement && element.parentElement.className
              ? element.parentElement.className
              : "",
            rect: {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width
            },
            scrollHeight: element.scrollHeight || rect.height,
            scrollWidth: element.scrollWidth || rect.width,
            text
          };
        })
        .filter(isPresent);

      function getSerializableRect(element: Element): NormalizedRect {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width
        };
      }

      function getClassName(element: Element | null): string {
        if (!element || !element.className) {
          return "";
        }

        if (typeof element.className === "string") {
          return element.className;
        }

        return String(element.getAttribute("class") || "");
      }

      function isDecorativeMedia(element: Element): boolean {
        const className = getClassName(element);
        const role = String(element.getAttribute("role") || "").toLowerCase();
        const dataMedia = String(element.getAttribute("data-media") || "").toLowerCase();

        return element.getAttribute("aria-hidden") === "true" ||
          role === "presentation" ||
          role === "none" ||
          dataMedia === "decorative" ||
          /\b(icon|badge|decorative)\b/.test(className);
      }

      const mediaSelector = [
        ".dom-slide img",
        ".dom-slide svg",
        ".dom-slide canvas",
        ".dom-slide video",
        ".dom-slide [data-media]",
        ".dom-slide .dom-media",
        ".dom-slide .dom-screenshot",
        ".dom-slide .dom-diagram"
      ].join(", ");

      const mediaItems = Array.from(new Set(Array.from(document.querySelectorAll(mediaSelector))))
        .filter((element) => !isDecorativeMedia(element))
        .map((element) => {
          const tagName = element.tagName.toLowerCase();
          const accessibleLabel = element.getAttribute("aria-label") ||
            element.getAttribute("alt") ||
            element.getAttribute("data-label") ||
            "";
          const label = accessibleLabel ||
            element.getAttribute("data-media") ||
            getClassName(element) ||
            tagName;
          const complete = element instanceof HTMLImageElement ? element.complete : true;
          const naturalHeight = element instanceof HTMLImageElement
            ? element.naturalHeight
            : (element instanceof HTMLVideoElement ? element.videoHeight : 0);
          const naturalWidth = element instanceof HTMLImageElement
            ? element.naturalWidth
            : (element instanceof HTMLVideoElement ? element.videoWidth : 0);
          const style = window.getComputedStyle(element);

          return {
            accessibleLabel,
            alt: element.getAttribute("alt") || "",
            className: getClassName(element),
            complete,
            label,
            naturalHeight: Number(naturalHeight || 0),
            naturalWidth: Number(naturalWidth || 0),
            objectFit: style.objectFit || "",
            objectPosition: style.objectPosition || "",
            rect: getSerializableRect(element),
            tagName
          };
        })
        .filter((item) => item.rect.width > 1 && item.rect.height > 1);

      const captionSelector = [
        ".dom-slide figcaption",
        ".dom-slide [data-caption]",
        ".dom-slide [data-source]",
        ".dom-slide .caption",
        ".dom-slide .source",
        ".dom-slide .credit",
        ".dom-slide .dom-caption",
        ".dom-slide .dom-source",
        ".dom-slide .dom-credit"
      ].join(", ");

      const captionItems = Array.from(document.querySelectorAll(captionSelector))
        .map((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            return null;
          }

          return {
            className: getClassName(element) || element.tagName.toLowerCase(),
            rect: getSerializableRect(element),
            tagName: element.tagName.toLowerCase(),
            text
          };
        })
        .filter(isPresent);

      const panelBoxes = Array.from(document.querySelectorAll(".dom-card, .dom-panel"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const textRects = Array.from(element.querySelectorAll("h1, h2, h3, p, span, strong"))
            .map((textElement) => {
              const text = (textElement.textContent || "").replace(/\s+/g, " ").trim();
              if (!text) {
                return null;
              }
              const textRect = textElement.getBoundingClientRect();
              return {
                bottom: textRect.bottom,
                left: textRect.left,
                right: textRect.right,
                top: textRect.top
              };
            })
            .filter(isPresent);

          return {
            className: getClassName(element) || "panel",
            rect: {
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              top: rect.top
            },
            textRects
          };
        });

      function getRect(selector: string): RectLike | null {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top
        };
      }

      function collectGroupGaps(selector: string, childSelector: string): ContentGroupGap[] {
        return Array.from(document.querySelectorAll(selector))
          .map((container) => {
            const children = Array.from(container.querySelectorAll(`:scope > ${childSelector}`))
              .map((child) => {
                const rect = child.getBoundingClientRect();
                return {
                  className: getClassName(child) || child.tagName.toLowerCase(),
                  rect: {
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top
                  }
                };
              });

            const gaps = [];

            for (let index = 1; index < children.length; index += 1) {
              const previousChild = children[index - 1];
              const currentChild = children[index];
              if (!previousChild || !currentChild) {
                continue;
              }
              const previous = previousChild.rect;
              const current = currentChild.rect;
              const horizontalGap = current.left - previous.right;
              const verticalGap = current.top - previous.bottom;
              const gap = horizontalGap >= -1 ? horizontalGap : verticalGap;

              gaps.push({
                currentClassName: currentChild.className,
                gap,
                previousClassName: previousChild.className
              });
            }

            return {
              className: getClassName(container) || selector,
              gaps
            };
          })
          .filter((entry) => entry.gaps.length);
      }

      const contentRects = [
        ".dom-slide__toc-body",
        ".dom-slide__content-columns",
        ".dom-slide__summary-columns"
      ]
        .map(getRect)
        .filter(isPresent);

      return {
        captionItems,
        contentRects,
        contentGroupGaps: [
          ...collectGroupGaps(".dom-slide__cover-cards", ".dom-card"),
          ...collectGroupGaps(".dom-slide__toc-cards", ".dom-card"),
          ...collectGroupGaps(".dom-slide__content-columns", ".dom-panel"),
          ...collectGroupGaps(".dom-slide__summary-columns", ".dom-bullet-list, .dom-panel"),
          ...collectGroupGaps(".dom-resource-list", ".dom-card")
        ],
        mediaItems,
        panelBoxes,
        progressRect: getRect(".dom-slide__badge"),
        sectionHeaderRect: getRect(".dom-slide__section-header"),
        slideRect: {
          bottom: slideRect.bottom,
          left: slideRect.left,
          right: slideRect.right,
          top: slideRect.top
        },
        textItems,
        wordCount: countWords(slide.textContent || "")
      };
    });
  };
}

function collectGeometryIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  validationOptions: ValidationOptions,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const slideRect = domData.slideRect ? normalizeRect(domData.slideRect) : null;
  if (!slideRect) {
    return issues;
  }
  const minContentGapIn = validationOptions.contentSpacing && validationOptions.contentSpacing.minGap
    ? validationOptions.contentSpacing.minGap
    : 0.18;
  const minContentGapPx = minContentGapIn * PX_PER_INCH;

  domData.textItems.forEach((item) => {
    const rect = normalizeRect(item.rect);
    const outside = (
      rect.left < slideRect.left - 1 ||
      rect.top < slideRect.top - 1 ||
      rect.right > slideRect.right + 1 ||
      rect.bottom > slideRect.bottom + 1
    );

    if (outside) {
      issues.push(createIssue(
        slideEntry.index,
        resolveValidationLevel("bounds", "error", validationSettings),
        "bounds",
        `Text block "${item.className}" exceeds the slide viewport`
      ));
    }
  });

  const minHorizontal = ((validationOptions.textPadding && validationOptions.textPadding.minHorizontal) || 0.08) * PX_PER_INCH;
  const minTop = ((validationOptions.textPadding && validationOptions.textPadding.minTop) || 0.08) * PX_PER_INCH;
  const minBottom = ((validationOptions.textPadding && validationOptions.textPadding.minBottom) || 0.05) * PX_PER_INCH;

  domData.panelBoxes.forEach((panel) => {
    if (!panel.textRects.length) {
      return;
    }

    const rect = normalizeRect(panel.rect);
    const leftInset = Math.min(...panel.textRects.map((textRect) => textRect.left - rect.left));
    const rightInset = Math.min(...panel.textRects.map((textRect) => rect.right - textRect.right));
    const topInset = Math.min(...panel.textRects.map((textRect) => textRect.top - rect.top));
    const bottomInset = Math.min(...panel.textRects.map((textRect) => rect.bottom - textRect.bottom));

    if (leftInset < minHorizontal || rightInset < minHorizontal || topInset < minTop || bottomInset < minBottom) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "text-padding",
        `Panel "${panel.className}" has tight text insets (${(leftInset / PX_PER_INCH).toFixed(2)}/${(topInset / PX_PER_INCH).toFixed(2)}/${(rightInset / PX_PER_INCH).toFixed(2)}/${(bottomInset / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }
  });

  const contentGroupGaps = Array.isArray(domData.contentGroupGaps) ? domData.contentGroupGaps : [];
  contentGroupGaps.forEach((group) => {
    group.gaps.forEach((entry) => {
      if (entry.gap < minContentGapPx - 2) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "content-gap-tight",
          `Content group "${group.className}" is tighter than the ${minContentGapIn.toFixed(2)}in minimum (${(entry.gap / PX_PER_INCH).toFixed(2)}in between "${entry.previousClassName}" and "${entry.currentClassName}")`,
          validationSettings
        ));
      }
    });
  });

  const sectionHeaderRect = domData.sectionHeaderRect ? normalizeRect(domData.sectionHeaderRect) : null;
  const progressRect = domData.progressRect ? normalizeRect(domData.progressRect) : null;
  const contentBox = Array.isArray(domData.contentRects)
    ? domData.contentRects
      .map(normalizeRect)
      .reduce<NormalizedRect | null>((current, rect) => unionRects(current, rect), null)
    : null;

  if (sectionHeaderRect && progressRect && contentBox) {
    const minGap = minContentGapPx;
    const ratioThreshold = 1.7;
    const differenceThreshold = 24;
    const topGap = contentBox.top - sectionHeaderRect.bottom;
    const bottomGap = progressRect.top - contentBox.bottom;

    if (topGap >= minGap && bottomGap >= minGap) {
      const largerGap = Math.max(topGap, bottomGap);
      const smallerGap = Math.max(Math.min(topGap, bottomGap), Number.EPSILON);
      const ratio = largerGap / smallerGap;
      const difference = Math.abs(topGap - bottomGap);

      if (ratio > ratioThreshold && difference > differenceThreshold) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "vertical-balance",
          `Content is vertically imbalanced (${(topGap / PX_PER_INCH).toFixed(2)}in below header vs ${(bottomGap / PX_PER_INCH).toFixed(2)}in above progress)`,
          validationSettings
        ));
      }
    }
  }

  return issues;
}

function collectMediaIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
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

async function validateDeckInDom() {
  const previewState = getDomPreviewState() as PreviewState;
  const validationOptions = getValidationConstraintOptions(readDesignConstraints());
  const validationSettings = readValidationSettings();
  const geometryIssues: ValidationIssue[] = [];
  const mediaIssues: ValidationIssue[] = [];
  const textIssues: ValidationIssue[] = [];

  await withBrowser(async (browser: Browser) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });

    for (const slideEntry of previewState.slides) {
      if (!slideEntry || !slideEntry.slideSpec) {
        continue;
      }

      const domData = await evaluateSlideInDom(slideEntry, previewState)(page);
      geometryIssues.push(...collectGeometryIssues(slideEntry, domData, validationOptions, validationSettings));
      mediaIssues.push(...collectMediaIssues(slideEntry, domData, validationOptions, validationSettings));
      textIssues.push(...collectTextIssues(slideEntry, domData, validationOptions, validationSettings));
    }

    await page.close();
  });

  return {
    geometry: summarizeIssues(geometryIssues.concat(mediaIssues)),
    text: summarizeIssues(textIssues)
  };
}

async function validateSlideSpecInDom(slideEntry: SlideEntry) {
  const previewState = getDomPreviewState() as PreviewState;
  const validationOptions = getValidationConstraintOptions(readDesignConstraints());
  const validationSettings = readValidationSettings();
  const geometryIssues: ValidationIssue[] = [];
  const mediaIssues: ValidationIssue[] = [];
  const textIssues: ValidationIssue[] = [];

  await withBrowser(async (browser: Browser) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });
    const domData = await evaluateSlideInDom(slideEntry, previewState)(page);
    geometryIssues.push(...collectGeometryIssues(slideEntry, domData, validationOptions, validationSettings));
    mediaIssues.push(...collectMediaIssues(slideEntry, domData, validationOptions, validationSettings));
    textIssues.push(...collectTextIssues(slideEntry, domData, validationOptions, validationSettings));
    await page.close();
  });

  const issues = [...geometryIssues, ...mediaIssues, ...textIssues];
  const errors = issues.filter((issue) => issue.level === "error");
  const state: CurrentSlideValidationState = errors.length
    ? "blocked"
    : issues.length
      ? "needs-attention"
      : "looks-good";

  return {
    errors,
    issues,
    ok: errors.length === 0,
    state
  };
}

const _test = {
  collectMediaIssues
};

export {
  _test,
  validateDeckInDom,
  validateSlideSpecInDom
};
