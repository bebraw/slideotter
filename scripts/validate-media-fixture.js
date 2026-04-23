const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/dom-validate");

const slideEntry = { index: 1 };
const validationOptions = {
  captionSpacing: {
    minGap: 0.1
  }
};
const validationSettings = {
  mediaValidationMode: "complete",
  rules: {
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
assert.ok(
  completeIssues.every((issue) => issue.level === "warn"),
  "fixture warnings should honor configured warning severities"
);

process.stdout.write("Media fixture validation passed.\n");
