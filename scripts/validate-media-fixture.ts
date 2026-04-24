const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/dom-validate.ts");

const slideEntry = { index: 1 };
const validationOptions = {
  captionSpacing: {
    minGap: 0.1
  },
  contentSpacing: {
    minGap: 0.18
  }
};
const validationSettings = {
  mediaValidationMode: "complete",
  rules: {
    bounds: "warning",
    "caption-source-spacing": "warning",
    "media-legibility": "warning"
  }
};
const domData = {
  captionItems: [
    {
      className: "source",
      rect: {
        bottom: 185,
        height: 20,
        left: 100,
        right: 240,
        top: 165,
        width: 140
      },
      tagName: "p",
      text: "Source: fixture"
    }
  ],
  mediaItems: [
    {
      accessibleLabel: "cropped screenshot",
      alt: "cropped screenshot",
      className: "dom-screenshot",
      complete: true,
      label: "cropped screenshot",
      naturalHeight: 180,
      naturalWidth: 320,
      rect: {
        bottom: 110,
        height: 90,
        left: 820,
        right: 1000,
        top: 20,
        width: 180
      },
      tagName: "img"
    },
    {
      accessibleLabel: "small screenshot",
      alt: "small screenshot",
      className: "dom-screenshot",
      complete: true,
      label: "small screenshot",
      naturalHeight: 360,
      naturalWidth: 640,
      rect: {
        bottom: 160,
        height: 60,
        left: 100,
        right: 180,
        top: 100,
        width: 80
      },
      tagName: "img"
    },
    {
      accessibleLabel: "upscaled chart",
      alt: "upscaled chart",
      className: "dom-diagram",
      complete: true,
      label: "upscaled chart",
      naturalHeight: 100,
      naturalWidth: 100,
      rect: {
        bottom: 340,
        height: 140,
        left: 300,
        right: 440,
        top: 200,
        width: 140
      },
      tagName: "img"
    },
    {
      accessibleLabel: "missing image",
      alt: "missing image",
      className: "dom-media",
      complete: false,
      label: "missing image",
      naturalHeight: 0,
      naturalWidth: 0,
      rect: {
        bottom: 410,
        height: 120,
        left: 520,
        right: 720,
        top: 290,
        width: 200
      },
      tagName: "img"
    },
    {
      accessibleLabel: "distorted chart",
      alt: "distorted chart",
      className: "dom-diagram",
      complete: true,
      label: "distorted chart",
      naturalHeight: 100,
      naturalWidth: 200,
      rect: {
        bottom: 430,
        height: 160,
        left: 120,
        right: 280,
        top: 270,
        width: 160
      },
      tagName: "img"
    },
    {
      accessibleLabel: "",
      alt: "",
      className: "dom-diagram",
      complete: true,
      label: "dom-diagram",
      naturalHeight: 180,
      naturalWidth: 320,
      rect: {
        bottom: 500,
        height: 180,
        left: 620,
        right: 940,
        top: 320,
        width: 320
      },
      tagName: "img"
    }
  ],
  progressRect: {
    bottom: 522,
    height: 20,
    left: 820,
    right: 940,
    top: 502,
    width: 120
  },
  slideRect: {
    bottom: 540,
    height: 540,
    left: 0,
    right: 960,
    top: 0,
    width: 960
  },
  textItems: [
    {
      className: "dom-slide__title",
      parentClassName: "dom-slide__section-header",
      rect: {
        bottom: 132,
        height: 36,
        left: 130,
        right: 360,
        top: 96,
        width: 230
      },
      text: "Overlapped title"
    },
    {
      className: "source",
      parentClassName: "dom-caption",
      rect: {
        bottom: 185,
        height: 20,
        left: 100,
        right: 240,
        top: 165,
        width: 140
      },
      text: "Source: fixture"
    }
  ]
};

const fastIssues = _test.collectMediaIssues(slideEntry, domData, validationOptions, {
  ...validationSettings,
  mediaValidationMode: "fast"
});
assert.equal(fastIssues.length, 0, "fast mode should skip heavier media checks");

const completeIssues = _test.collectMediaIssues(slideEntry, domData, validationOptions, validationSettings);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("renders small")),
  "complete mode should flag small rendered media"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "bounds" && issue.message.includes("exceeds the slide viewport")),
  "complete mode should flag media outside the slide viewport"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("scaled above native")),
  "complete mode should flag upscaled raster media"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("did not finish loading")),
  "complete mode should flag unloaded raster media"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("no readable native dimensions")),
  "complete mode should flag dimensionless raster media"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("distorts its native aspect ratio")),
  "complete mode should flag distorted raster media"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("missing a readable alt or aria label")),
  "complete mode should flag unlabeled media"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("overlaps text")),
  "complete mode should flag media overlapping regular slide text"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "media-legibility" && issue.message.includes("progress area")),
  "complete mode should flag media too close to the progress area"
);
assert.ok(
  completeIssues.some((issue) => issue.rule === "caption-source-spacing"),
  "complete mode should flag tight caption/source spacing"
);

const orphanCaptionIssues = _test.collectMediaIssues(slideEntry, {
  captionItems: domData.captionItems,
  mediaItems: []
}, validationOptions, validationSettings);
assert.ok(
  orphanCaptionIssues.some((issue) => issue.rule === "caption-source-spacing" && issue.message.includes("has no rendered media")),
  "complete mode should flag captions or source lines with no rendered media"
);

const detachedCaptionIssues = _test.collectMediaIssues(slideEntry, {
  captionItems: [
    {
      className: "source",
      rect: {
        bottom: 520,
        height: 20,
        left: 20,
        right: 180,
        top: 500,
        width: 160
      },
      tagName: "p",
      text: "Source: detached"
    }
  ],
  mediaItems: [
    {
      accessibleLabel: "main screenshot",
      alt: "main screenshot",
      className: "dom-screenshot",
      complete: true,
      label: "main screenshot",
      naturalHeight: 360,
      naturalWidth: 640,
      rect: {
        bottom: 250,
        height: 180,
        left: 120,
        right: 440,
        top: 70,
        width: 320
      },
      tagName: "img"
    }
  ]
}, validationOptions, validationSettings);
assert.ok(
  detachedCaptionIssues.some((issue) => issue.rule === "caption-source-spacing" && issue.message.includes("is detached from nearest media")),
  "complete mode should flag detached captions or source lines"
);

const aboveCaptionIssues = _test.collectMediaIssues(slideEntry, {
  captionItems: [
    {
      className: "source",
      rect: {
        bottom: 70,
        height: 20,
        left: 130,
        right: 330,
        top: 50,
        width: 200
      },
      tagName: "p",
      text: "Source: above"
    }
  ],
  mediaItems: [
    {
      accessibleLabel: "workflow screenshot",
      alt: "workflow screenshot",
      className: "dom-screenshot",
      complete: true,
      label: "workflow screenshot",
      naturalHeight: 180,
      naturalWidth: 320,
      rect: {
        bottom: 270,
        height: 180,
        left: 120,
        right: 440,
        top: 90,
        width: 320
      },
      tagName: "img"
    }
  ]
}, validationOptions, validationSettings);
assert.ok(
  aboveCaptionIssues.some((issue) => issue.rule === "caption-source-spacing" && issue.message.includes("sits above nearest media")),
  "complete mode should flag captions or source lines above their nearest media"
);

const sideCaptionIssues = _test.collectMediaIssues(slideEntry, {
  captionItems: [
    {
      className: "source",
      rect: {
        bottom: 285,
        height: 20,
        left: 455,
        right: 620,
        top: 265,
        width: 165
      },
      tagName: "p",
      text: "Source: side"
    }
  ],
  mediaItems: [
    {
      accessibleLabel: "side aligned screenshot",
      alt: "side aligned screenshot",
      className: "dom-screenshot",
      complete: true,
      label: "side aligned screenshot",
      naturalHeight: 180,
      naturalWidth: 320,
      rect: {
        bottom: 250,
        height: 180,
        left: 120,
        right: 440,
        top: 70,
        width: 320
      },
      tagName: "img"
    }
  ]
}, validationOptions, validationSettings);
assert.ok(
  sideCaptionIssues.some((issue) => issue.rule === "caption-source-spacing" && issue.message.includes("does not horizontally align")),
  "complete mode should flag captions or source lines that sit beside their nearest media"
);
assert.ok(
  completeIssues.every((issue) => issue.level === "warn"),
  "fixture warnings should honor configured warning severities"
);

process.stdout.write("Media fixture validation passed.\n");
