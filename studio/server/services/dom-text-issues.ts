import { contrastRatio, type NormalizedRect } from "./dom-geometry.ts";
import { resolveValidationLevel } from "./validation-settings.ts";

const PT_PER_PX = 72 / 96;

type ValidationLevel = "error" | "warn";

type ValidationSettings = {
  mediaValidationMode?: "complete" | "fast";
};

type ValidationOptions = {
  minimumFontSize?: {
    minFontSizePt?: number;
  };
  slideWordCount?: {
    maxWordsPerSlide?: number;
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
  backgroundColor: string;
  className: string;
  color: string;
  fontSizePx: number;
  parentClassName: string;
  rect: NormalizedRect;
  text: string;
};

type DomTextValidationData = {
  textItems: TextItem[];
  wordCount: number;
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

export function collectTextIssues(
  slideEntry: SlideEntry,
  domData: DomTextValidationData,
  validationOptions: ValidationOptions,
  validationSettings: ValidationSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const minFontSizePt = validationOptions.minimumFontSize && validationOptions.minimumFontSize.minFontSizePt
    ? validationOptions.minimumFontSize.minFontSizePt
    : 10;
  const maxWordsPerSlide = validationOptions.slideWordCount && validationOptions.slideWordCount.maxWordsPerSlide
    ? validationOptions.slideWordCount.maxWordsPerSlide
    : 80;

  domData.textItems.forEach((item) => {
    const className = String(item.className || "");
    const parentClassName = String(item.parentClassName || "");
    const isMicrocopy = (
      /eyebrow|badge-label/.test(className) ||
      /eyebrow|badge/.test(parentClassName) ||
      parentClassName.includes("dom-signal__meta")
    );

    if (isMicrocopy) {
      return;
    }

    const fontSizePt = item.fontSizePx * PT_PER_PX;
    if (fontSizePt < minFontSizePt) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "font-size-small",
        `Text block "${item.className}" uses ${fontSizePt.toFixed(1)}pt text below the ${minFontSizePt.toFixed(1)}pt minimum`,
        validationSettings
      ));
    }

    const ratio = contrastRatio(item.color, item.backgroundColor);
    if (ratio < 2.5) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "error",
        "contrast-low",
        `Text block "${item.className}" has low contrast (${ratio.toFixed(2)}:1)`,
        validationSettings
      ));
    } else if (ratio < 3) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "contrast-tight",
        `Text block "${item.className}" is close to the contrast threshold (${ratio.toFixed(2)}:1)`,
        validationSettings
      ));
    }
  });

  if (domData.wordCount > maxWordsPerSlide) {
    issues.push(createConfiguredIssue(
      slideEntry.index,
      "warn",
      "slide-word-count",
      `Slide carries ${domData.wordCount} visible words above the ${maxWordsPerSlide}-word maximum`,
      validationSettings
    ));
  }

  return issues;
}
