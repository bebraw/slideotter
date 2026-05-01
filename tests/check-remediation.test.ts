const assert = require("node:assert/strict");
const test = require("node:test");

const operations = require("../studio/server/services/operations.ts");

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

test("check remediation candidates keep repairs mechanical and issue-scoped", () => {
  const slideSpec = {
    layoutDefinition: {
      regions: [
        { id: "title-region", slot: "title", spacing: "normal" },
        { id: "body-region", slot: "body", spacing: "loose" }
      ]
    },
    media: {
      alt: "Screenshot",
      fit: "cover",
      focalPoint: "top",
      src: "/presentation-materials/example/screenshot.png"
    },
    title: "Demo"
  };
  const issue = {
    message: "Media is cropped too tightly.",
    rule: "media-legibility",
    slide: 3
  };

  const candidates = operations._test.createCheckRemediationCandidates(slideSpec, issue);
  assert.equal(candidates.length, 3);

  const fitCandidate = asRecord(candidates.find((candidate: JsonRecord) => candidate.remediationStrategy === "media-fit-contain"));
  assert.equal(fitCandidate.changeScope, "slide-media");
  assert.deepEqual(asRecord(fitCandidate.slideSpec).media, {
    alt: "Screenshot",
    fit: "contain",
    focalPoint: "center",
    src: "/presentation-materials/example/screenshot.png"
  });
  assert.deepEqual(fitCandidate.sourceIssues, [issue]);

  const compactCandidate = asRecord(candidates.find((candidate: JsonRecord) => candidate.remediationStrategy === "layout-compact-spacing"));
  const compactSpec = asRecord(compactCandidate.slideSpec);
  const compactDefinition = asRecord(compactSpec.layoutDefinition);
  const compactRegions = Array.isArray(compactDefinition.regions) ? compactDefinition.regions.map(asRecord) : [];
  assert.deepEqual(compactRegions.map((region) => region.spacing), ["tight", "tight"]);
});

