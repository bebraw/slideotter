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
