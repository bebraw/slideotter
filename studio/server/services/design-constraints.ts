import { readActiveDeckContext } from "./active-deck-context.ts";

const defaultDesignConstraints = Object.freeze({
  maxWordsPerSlide: 80,
  minCaptionGapIn: 0.1,
  minContentGapIn: 0.18,
  minFontSizePt: 10,
  minPanelPaddingIn: 0.08
});

type DesignConstraints = {
  maxWordsPerSlide: number;
  minCaptionGapIn: number;
  minContentGapIn: number;
  minFontSizePt: number;
  minPanelPaddingIn: number;
};

type ClampOptions = {
  max?: number;
  min?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function clampNumber(value: unknown, fallback: number, options: ClampOptions = {}): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const minimum = typeof options.min === "number" && Number.isFinite(options.min) ? options.min : parsed;
  const maximum = typeof options.max === "number" && Number.isFinite(options.max) ? options.max : parsed;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function normalizeDesignConstraints(input: unknown = {}): DesignConstraints {
  const source = asRecord(input);
  return {
    maxWordsPerSlide: clampNumber(
      source.maxWordsPerSlide,
      defaultDesignConstraints.maxWordsPerSlide,
      { min: 10, max: 250 }
    ),
    minCaptionGapIn: clampNumber(
      source.minCaptionGapIn,
      defaultDesignConstraints.minCaptionGapIn,
      { min: 0.02, max: 1 }
    ),
    minContentGapIn: clampNumber(
      source.minContentGapIn,
      defaultDesignConstraints.minContentGapIn,
      { min: 0.02, max: 1.5 }
    ),
    minFontSizePt: clampNumber(
      source.minFontSizePt,
      defaultDesignConstraints.minFontSizePt,
      { min: 6, max: 30 }
    ),
    minPanelPaddingIn: clampNumber(
      source.minPanelPaddingIn,
      defaultDesignConstraints.minPanelPaddingIn,
      { min: 0.02, max: 0.5 }
    )
  };
}

function readDesignConstraints() {
  const raw = readActiveDeckContext(null);
  const context = asRecord(raw);
  const deck = asRecord(context.deck);
  return normalizeDesignConstraints(deck.designConstraints);
}

function describeDesignConstraints(input: unknown = {}) {
  const constraints = normalizeDesignConstraints(input);

  return [
    `keep visible text at or above ${constraints.minFontSizePt}pt`,
    `keep each slide at or under ${constraints.maxWordsPerSlide} words`,
    `keep main content groups at least ${constraints.minContentGapIn}in apart`,
    `keep captions at least ${constraints.minCaptionGapIn}in from visuals`,
    `keep panel text inset at least ${constraints.minPanelPaddingIn}in`
  ];
}

function getValidationConstraintOptions(input: unknown = {}) {
  const constraints = normalizeDesignConstraints(input);

  return {
    captionSpacing: {
      minGap: constraints.minCaptionGapIn
    },
    contentSpacing: {
      minGap: constraints.minContentGapIn
    },
    minimumFontSize: {
      minFontSizePt: constraints.minFontSizePt
    },
    slideWordCount: {
      maxWordsPerSlide: constraints.maxWordsPerSlide
    },
    textPadding: {
      minBottom: Math.max(0.05, Number((constraints.minPanelPaddingIn * 0.625).toFixed(3))),
      minHorizontal: constraints.minPanelPaddingIn,
      minTop: constraints.minPanelPaddingIn
    },
    verticalBalance: {
      minGap: constraints.minContentGapIn
    }
  };
}

export {
  defaultDesignConstraints,
  describeDesignConstraints,
  getValidationConstraintOptions,
  normalizeDesignConstraints,
  readDesignConstraints
};