import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { _test } = require("../studio/server/services/dom-validate.ts");

test("DOM geometry validation blocks text overflowing generated cards", () => {
  const issues = _test.collectGeometryIssues({
    index: 4
  }, {
    captionItems: [],
    contentRects: [],
    mediaItems: [],
    panelBoxes: [{
      className: "dom-evidence",
      rect: {
        bottom: 200,
        left: 100,
        right: 260,
        top: 100
      },
      textRects: [{
        bottom: 216,
        left: 112,
        right: 248,
        top: 132
      }]
    }],
    progressRect: null,
    sectionHeaderRect: null,
    slideRect: {
      bottom: 540,
      left: 0,
      right: 960,
      top: 0
    },
    textItems: [],
    wordCount: 0
  }, {}, {});

  const overflowIssue = issues.find((issue: { rule: string }) => issue.rule === "panel-content-overflow");
  assert.equal(overflowIssue?.level, "error");
  assert.equal(overflowIssue?.slide, 4);
});

test("editorial validation reports weak focal dominance for focal archetypes", () => {
  const issues = _test.collectEditorialIssues({
    index: 2,
    slideSpec: {
      compositionIntent: {
        archetype: "statement",
        focalPoint: "claim",
        rationale: "The slide should land one dominant claim."
      },
      type: "content"
    }
  }, {
    captionItems: [],
    contentRects: [],
    mediaItems: [],
    panelBoxes: [],
    progressRect: null,
    sectionHeaderRect: null,
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
        backgroundColor: "rgb(255, 255, 255)",
        className: "claim",
        clientHeight: 40,
        clientWidth: 500,
        color: "rgb(0, 0, 0)",
        fontSizePx: 28,
        parentClassName: "content",
        rect: { bottom: 100, height: 40, left: 80, right: 580, top: 60, width: 500 },
        scrollHeight: 40,
        scrollWidth: 500,
        text: "One clear claim"
      },
      {
        backgroundColor: "rgb(255, 255, 255)",
        className: "support",
        clientHeight: 40,
        clientWidth: 490,
        color: "rgb(0, 0, 0)",
        fontSizePx: 27,
        parentClassName: "content",
        rect: { bottom: 160, height: 40, left: 80, right: 570, top: 120, width: 490 },
        scrollHeight: 40,
        scrollWidth: 490,
        text: "Nearly equal support"
      }
    ],
    wordCount: 6
  }, {});

  assert.equal(issues.find((issue: { rule: string }) => issue.rule === "editorial-focal-dominance")?.level, "warn");
});

test("editorial validation reports repeated adjacent composition rhythm", () => {
  const issues = _test.collectEditorialRhythmIssues([
    { index: 1, slideSpec: { compositionIntent: { archetype: "bullets", focalPoint: "list", rationale: "List one." } } },
    { index: 2, slideSpec: { compositionIntent: { archetype: "bullets", focalPoint: "list", rationale: "List two." } } },
    { index: 3, slideSpec: { compositionIntent: { archetype: "bullets", focalPoint: "list", rationale: "List three." } } }
  ], {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.rule, "editorial-rhythm");
  assert.equal(issues[0]?.slide, 3);
});
