const fs = require("fs");
const path = require("path");

const deckContextFile = path.join(__dirname, "..", "state", "deck-context.json");

const defaultDesignConstraints = Object.freeze({
  maxWordsPerSlide: 80,
  minCaptionGapIn: 0.1,
  minContentGapIn: 0.18,
  minFontSizePt: 10,
  minPanelPaddingIn: 0.08
});

function clampNumber(value, fallback, options: any = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const minimum = Number.isFinite(options.min) ? options.min : parsed;
  const maximum = Number.isFinite(options.max) ? options.max : parsed;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function normalizeDesignConstraints(input: any = {}) {
  return {
    maxWordsPerSlide: clampNumber(
      input.maxWordsPerSlide,
      defaultDesignConstraints.maxWordsPerSlide,
      { min: 10, max: 250 }
    ),
    minCaptionGapIn: clampNumber(
      input.minCaptionGapIn,
      defaultDesignConstraints.minCaptionGapIn,
      { min: 0.02, max: 1 }
    ),
    minContentGapIn: clampNumber(
      input.minContentGapIn,
      defaultDesignConstraints.minContentGapIn,
      { min: 0.02, max: 1.5 }
    ),
    minFontSizePt: clampNumber(
      input.minFontSizePt,
      defaultDesignConstraints.minFontSizePt,
      { min: 6, max: 30 }
    ),
    minPanelPaddingIn: clampNumber(
      input.minPanelPaddingIn,
      defaultDesignConstraints.minPanelPaddingIn,
      { min: 0.02, max: 0.5 }
    )
  };
}

function readDesignConstraints() {
  try {
    const raw = JSON.parse(fs.readFileSync(deckContextFile, "utf8"));
    return normalizeDesignConstraints(raw && raw.deck && raw.deck.designConstraints);
  } catch (error) {
    return { ...defaultDesignConstraints };
  }
}

function describeDesignConstraints(input: any = {}) {
  const constraints = normalizeDesignConstraints(input);

  return [
    `keep visible text at or above ${constraints.minFontSizePt}pt`,
    `keep each slide at or under ${constraints.maxWordsPerSlide} words`,
    `keep main content groups at least ${constraints.minContentGapIn}in apart`,
    `keep captions at least ${constraints.minCaptionGapIn}in from visuals`,
    `keep panel text inset at least ${constraints.minPanelPaddingIn}in`
  ];
}

function getValidationConstraintOptions(input: any = {}) {
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

module.exports = {
  defaultDesignConstraints,
  describeDesignConstraints,
  getValidationConstraintOptions,
  normalizeDesignConstraints,
  readDesignConstraints
};
