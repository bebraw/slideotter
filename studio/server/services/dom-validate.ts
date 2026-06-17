import { getValidationConstraintOptions, readDesignConstraints } from "./design-constraints.ts";
import { createStandaloneSlideHtml, withBrowser } from "./dom-export.ts";
import {
  normalizeRect,
  unionRects,
  type NormalizedRect,
  type RectLike
} from "./dom-geometry.ts";
import { getDomPreviewState } from "./dom-preview-state.ts";
import { collectMediaIssues } from "./dom-media-issues.ts";
import { collectTextIssues } from "./dom-text-issues.ts";
import { readValidationSettings, resolveValidationLevel } from "./validation-settings.ts";

const PX_PER_INCH = 96;
const PANEL_OVERFLOW_TOLERANCE_PX = 6;

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

type SlideSpecRecord = Record<string, unknown>;

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

type BrowserGroupChild = {
  className: string;
  rect: EdgeRect;
};

function browserCountWords(value: unknown): number {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function browserIsPresent<T>(value: T | null): value is T {
  return value !== null;
}

function browserGetClassName(element: Element | null): string {
  if (!element || !element.className) {
    return "";
  }

  if (typeof element.className === "string") {
    return element.className;
  }

  return String(element.getAttribute("class") || "");
}

function browserGetSerializableRect(element: Element): NormalizedRect {
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

function browserGetEdgeRect(selector: string): RectLike | null {
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

function browserIsVisibleBackground(value: string): boolean {
  return Boolean(value && value !== "transparent" && !/^rgba\(0,\s*0,\s*0,\s*0\)$/.test(value));
}

function browserFindEffectiveBackground(element: Element, fallbackBackgroundColor: string): string {
  let current: Element | null = element;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (browserIsVisibleBackground(style.backgroundColor)) {
      return style.backgroundColor;
    }
    current = current.parentElement;
  }

  return fallbackBackgroundColor;
}

function browserEmptyDomValidationData(): DomValidationData {
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

function browserCollectTextItems(fallbackBackgroundColor: string): TextItem[] {
  const textSelector = ".dom-slide h1, .dom-slide h2, .dom-slide h3, .dom-slide p, .dom-slide span, .dom-slide strong";
  return Array.from(document.querySelectorAll(textSelector))
    .map((element) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: browserFindEffectiveBackground(element, fallbackBackgroundColor),
        className: browserGetClassName(element) || element.tagName.toLowerCase(),
        clientHeight: element.clientHeight || rect.height,
        clientWidth: element.clientWidth || rect.width,
        color: style.color,
        fontSizePx: Number.parseFloat(style.fontSize) || 0,
        parentClassName: element.parentElement && element.parentElement.className
          ? String(element.parentElement.className)
          : "",
        rect: browserGetSerializableRect(element),
        scrollHeight: element.scrollHeight || rect.height,
        scrollWidth: element.scrollWidth || rect.width,
        text
      };
    })
    .filter(browserIsPresent);
}

function browserIsDecorativeMedia(element: Element): boolean {
  const className = browserGetClassName(element);
  const role = String(element.getAttribute("role") || "").toLowerCase();
  const dataMedia = String(element.getAttribute("data-media") || "").toLowerCase();

  return element.getAttribute("aria-hidden") === "true" ||
    role === "presentation" ||
    role === "none" ||
    dataMedia === "decorative" ||
    /\b(icon|badge|decorative)\b/.test(className);
}

function browserCollectMediaItems(): MediaItem[] {
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

  return Array.from(new Set(Array.from(document.querySelectorAll(mediaSelector))))
    .filter((element) => !browserIsDecorativeMedia(element))
    .map(browserCreateMediaItem)
    .filter((item) => item.rect.width > 1 && item.rect.height > 1);
}

function browserCreateMediaItem(element: Element): MediaItem {
  const tagName = element.tagName.toLowerCase();
  const accessibleLabel = element.getAttribute("aria-label") ||
    element.getAttribute("alt") ||
    element.getAttribute("data-label") ||
    "";
  const label = accessibleLabel ||
    element.getAttribute("data-media") ||
    browserGetClassName(element) ||
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
    className: browserGetClassName(element),
    complete,
    label,
    naturalHeight: Number(naturalHeight || 0),
    naturalWidth: Number(naturalWidth || 0),
    objectFit: style.objectFit || "",
    objectPosition: style.objectPosition || "",
    rect: browserGetSerializableRect(element),
    tagName
  };
}

function browserCollectCaptionItems(): CaptionItem[] {
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

  return Array.from(document.querySelectorAll(captionSelector))
    .map((element) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) {
        return null;
      }

      return {
        className: browserGetClassName(element) || element.tagName.toLowerCase(),
        rect: browserGetSerializableRect(element),
        tagName: element.tagName.toLowerCase(),
        text
      };
    })
    .filter(browserIsPresent);
}

function browserCollectPanelBoxes(): PanelBox[] {
  return Array.from(document.querySelectorAll(".dom-card, .dom-evidence, .dom-panel"))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        className: browserGetClassName(element) || "panel",
        rect: {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top
        },
        textRects: browserCollectPanelTextRects(element)
      };
    });
}

function browserCollectPanelTextRects(element: Element): EdgeRect[] {
  return Array.from(element.querySelectorAll("h1, h2, h3, p, span, strong, :scope > .dom-evidence-list > .dom-evidence"))
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
    .filter(browserIsPresent);
}

function browserCollectGroupChildren(container: Element, childSelector: string): BrowserGroupChild[] {
  return Array.from(container.querySelectorAll(`:scope > ${childSelector}`))
    .map((child) => {
      const rect = child.getBoundingClientRect();
      return {
        className: browserGetClassName(child) || child.tagName.toLowerCase(),
        rect: {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top
        }
      };
    });
}

function browserCollectGroupGaps(selector: string, childSelector: string): ContentGroupGap[] {
  return Array.from(document.querySelectorAll(selector))
    .map((container) => {
      const children = browserCollectGroupChildren(container, childSelector);
      const gaps = [];

      for (let index = 1; index < children.length; index += 1) {
        const previousChild = children[index - 1];
        const currentChild = children[index];
        if (!previousChild || !currentChild) {
          continue;
        }
        const horizontalGap = currentChild.rect.left - previousChild.rect.right;
        const verticalGap = currentChild.rect.top - previousChild.rect.bottom;
        gaps.push({
          currentClassName: currentChild.className,
          gap: horizontalGap >= -1 ? horizontalGap : verticalGap,
          previousClassName: previousChild.className
        });
      }

      return {
        className: browserGetClassName(container) || selector,
        gaps
      };
    })
    .filter((entry) => entry.gaps.length);
}

function browserCollectContentRects(): RectLike[] {
  return [
    ".dom-slide__toc-body",
    ".dom-slide__content-columns",
    ".dom-slide__content-statement",
    ".dom-slide__content-spotlight",
    ".dom-slide__content-image-split",
    ".dom-slide__summary-columns"
  ]
    .map(browserGetEdgeRect)
    .filter(browserIsPresent);
}

function browserCollectContentGroupGaps(): ContentGroupGap[] {
  return [
    ...browserCollectGroupGaps(".dom-slide__cover-cards", ".dom-card"),
    ...browserCollectGroupGaps(".dom-slide__toc-cards", ".dom-card"),
    ...browserCollectGroupGaps(".dom-slide__content-columns", ".dom-panel"),
    ...browserCollectGroupGaps(".dom-slide__summary-columns", ".dom-bullet-list, .dom-panel"),
    ...browserCollectGroupGaps(".dom-resource-list", ".dom-card")
  ];
}

function browserCollectDomValidationData(): DomValidationData {
  const slide = document.querySelector(".dom-slide");
  if (!slide) {
    return browserEmptyDomValidationData();
  }

  const slideRect = slide.getBoundingClientRect();
  const slideStyle = window.getComputedStyle(slide);
  return {
    captionItems: browserCollectCaptionItems(),
    contentRects: browserCollectContentRects(),
    contentGroupGaps: browserCollectContentGroupGaps(),
    mediaItems: browserCollectMediaItems(),
    panelBoxes: browserCollectPanelBoxes(),
    progressRect: browserGetEdgeRect(".dom-slide__badge"),
    sectionHeaderRect: browserGetEdgeRect(".dom-slide__section-header"),
    slideRect: {
      bottom: slideRect.bottom,
      left: slideRect.left,
      right: slideRect.right,
      top: slideRect.top
    },
    textItems: browserCollectTextItems(slideStyle.backgroundColor),
    wordCount: browserCountWords(slide.textContent || "")
  };
}

function createBrowserDomValidationScript(): string {
  return [
    browserCountWords,
    browserIsPresent,
    browserGetClassName,
    browserGetSerializableRect,
    browserGetEdgeRect,
    browserIsVisibleBackground,
    browserFindEffectiveBackground,
    browserEmptyDomValidationData,
    browserCollectTextItems,
    browserIsDecorativeMedia,
    browserCollectMediaItems,
    browserCreateMediaItem,
    browserCollectCaptionItems,
    browserCollectPanelBoxes,
    browserCollectPanelTextRects,
    browserCollectGroupChildren,
    browserCollectGroupGaps,
    browserCollectContentRects,
    browserCollectContentGroupGaps,
    browserCollectDomValidationData,
    "window.__slideotterCollectDomValidationData = browserCollectDomValidationData;"
  ].map((entry) => String(entry)).join("\n");
}

function evaluateSlideInDom(slideEntry: SlideEntry, previewState: PreviewState) {
  const html = createStandaloneSlideHtml(previewState, slideEntry);

  return async (page: Page): Promise<DomValidationData> => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.setContent(html, { waitUntil: "load" });
    await page.addScriptTag({ content: createBrowserDomValidationScript() });

    return page.evaluate((): DomValidationData => {
      const browserWindow = window as unknown as {
        __slideotterCollectDomValidationData: () => DomValidationData;
      };
      return browserWindow.__slideotterCollectDomValidationData();
    });
  };
}

function collectTextBoundsIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  slideRect: NormalizedRect,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

  return issues;
}

function collectPanelInsetIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  validationOptions: ValidationOptions,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

    if (
      leftInset < -PANEL_OVERFLOW_TOLERANCE_PX ||
      rightInset < -PANEL_OVERFLOW_TOLERANCE_PX ||
      topInset < -PANEL_OVERFLOW_TOLERANCE_PX ||
      bottomInset < -PANEL_OVERFLOW_TOLERANCE_PX
    ) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "error",
        "panel-content-overflow",
        `Panel "${panel.className}" has text outside its bounds (${(leftInset / PX_PER_INCH).toFixed(2)}/${(topInset / PX_PER_INCH).toFixed(2)}/${(rightInset / PX_PER_INCH).toFixed(2)}/${(bottomInset / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }

    if (!/\bdom-evidence\b/.test(panel.className) && (leftInset < minHorizontal || rightInset < minHorizontal || topInset < minTop || bottomInset < minBottom)) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "text-padding",
        `Panel "${panel.className}" has tight text insets (${(leftInset / PX_PER_INCH).toFixed(2)}/${(topInset / PX_PER_INCH).toFixed(2)}/${(rightInset / PX_PER_INCH).toFixed(2)}/${(bottomInset / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }
  });

  return issues;
}

function collectContentGapIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  minContentGapIn: number,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const minContentGapPx = minContentGapIn * PX_PER_INCH;
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

  return issues;
}

function collectVerticalBalanceIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  minContentGapPx: number,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

function collectGeometryIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  validationOptions: ValidationOptions,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const slideRect = domData.slideRect ? normalizeRect(domData.slideRect) : null;
  if (!slideRect) {
    return [];
  }

  const minContentGapIn = validationOptions.contentSpacing && validationOptions.contentSpacing.minGap
    ? validationOptions.contentSpacing.minGap
    : 0.18;
  const minContentGapPx = minContentGapIn * PX_PER_INCH;

  return [
    ...collectTextBoundsIssues(slideEntry, domData, slideRect, validationSettings),
    ...collectPanelInsetIssues(slideEntry, domData, validationOptions, validationSettings),
    ...collectContentGapIssues(slideEntry, domData, minContentGapIn, validationSettings),
    ...collectVerticalBalanceIssues(slideEntry, domData, minContentGapPx, validationSettings)
  ];
}

function asSlideSpecRecord(value: unknown): SlideSpecRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as SlideSpecRecord
    : {};
}

function compositionArchetype(slideEntry: SlideEntry): string {
  const slideSpec = asSlideSpecRecord(slideEntry.slideSpec);
  const intent = asSlideSpecRecord(slideSpec.compositionIntent);
  return String(intent.archetype || slideSpec.layout || slideSpec.type || "").trim().toLowerCase();
}

function collectEditorialIssues(
  slideEntry: SlideEntry,
  domData: DomValidationData,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const slideSpec = asSlideSpecRecord(slideEntry.slideSpec);
  const intent = asSlideSpecRecord(slideSpec.compositionIntent);
  const archetype = String(intent.archetype || "").trim().toLowerCase();

  if (!archetype) {
    return issues;
  }

  const meaningfulText = domData.textItems
    .filter((item) => item.text.split(/\s+/).length >= 2 && item.rect.width > 12 && item.rect.height > 8);
  const rankedText = meaningfulText
    .slice()
    .sort((left, right) => (right.fontSizePx * right.rect.width) - (left.fontSizePx * left.rect.width));
  const largestText = rankedText[0];
  const secondLargestText = rankedText[1];

  if (["statement", "spotlight", "image-split", "quote-pull", "proof"].includes(archetype) && largestText && secondLargestText) {
    const largestScore = largestText.fontSizePx * largestText.rect.width;
    const secondScore = Math.max(1, secondLargestText.fontSizePx * secondLargestText.rect.width);
    if (largestScore / secondScore < 1.18) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "editorial-focal-dominance",
        `Composition "${archetype}" has a weak focal point; largest text "${largestText.className}" is not visually dominant enough.`,
        validationSettings
      ));
    }
  }

  meaningfulText.forEach((item) => {
    const words = item.text.split(/\s+/).filter(Boolean);
    if (words.length < 9 || item.fontSizePx <= 0) {
      return;
    }

    const averageWordChars = Math.max(4.5, item.text.length / Math.max(1, words.length));
    const averageCharWidth = item.fontSizePx * 0.52;
    const estimatedCharsPerLine = item.rect.width / Math.max(1, averageCharWidth);
    const estimatedWordsPerLine = estimatedCharsPerLine / averageWordChars;
    if (estimatedWordsPerLine > 13) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "editorial-line-length",
        `Text block "${item.className}" has a long estimated line length (${estimatedWordsPerLine.toFixed(1)} words per line).`,
        validationSettings
      ));
    }
  });

  return issues;
}

function collectEditorialRhythmIssues(
  slideEntries: SlideEntry[],
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let index = 2; index < slideEntries.length; index += 1) {
    const current = slideEntries[index];
    const archetypes = slideEntries.slice(index - 2, index + 1).map(compositionArchetype).filter(Boolean);
    if (current && archetypes.length === 3 && new Set(archetypes).size === 1) {
      issues.push(createConfiguredIssue(
        current.index,
        "warn",
        "editorial-rhythm",
        `Three adjacent slides use the same composition "${archetypes[0]}".`,
        validationSettings
      ));
    }
  }

  return issues;
}

async function validateDeckInDom() {
  const previewState = getDomPreviewState() as PreviewState;
  const validationOptions = getValidationConstraintOptions(readDesignConstraints());
  const validationSettings = readValidationSettings();
  const geometryIssues: ValidationIssue[] = [];
  const editorialIssues: ValidationIssue[] = collectEditorialRhythmIssues(previewState.slides, validationSettings);
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
      editorialIssues.push(...collectEditorialIssues(slideEntry, domData, validationSettings));
      mediaIssues.push(...collectMediaIssues(slideEntry, domData, validationOptions, validationSettings));
      textIssues.push(...collectTextIssues(slideEntry, domData, validationOptions, validationSettings));
    }

    await page.close();
  });

  return {
    geometry: summarizeIssues(geometryIssues.concat(mediaIssues, editorialIssues)),
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
    geometryIssues.push(...collectEditorialIssues(slideEntry, domData, validationSettings));
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
  collectEditorialIssues,
  collectEditorialRhythmIssues,
  collectGeometryIssues,
  collectMediaIssues
};

export {
  _test,
  validateDeckInDom,
  validateSlideSpecInDom
};
