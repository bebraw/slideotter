const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");

const deckStructureFunction = appSource.match(/async function ideateDeckStructure\(\) \{[\s\S]*?\n\}/);
assert(deckStructureFunction, "Expected ideateDeckStructure function in studio client");
assert(
  /candidateCount:\s*getRequestedCandidateCount\(\)/.test(deckStructureFunction[0]),
  "Deck-structure generation should send the requested candidate count"
);

["ideateSlide", "ideateTheme", "ideateStructure", "redoLayout"].forEach((functionName) => {
  const pattern = new RegExp(`async function ${functionName}\\(\\) \\{[\\s\\S]*?runSlideCandidateWorkflow\\(`);
  assert(
    pattern.test(appSource),
    `${functionName} should use the shared slide candidate workflow runner`
  );
});

assert(
  /function applySlideWorkflowPayload\(payload, slideId\)/.test(appSource),
  "Expected shared slide workflow payload helper"
);
assert(
  /slideLoadRequestSeq/.test(appSource) && /requestSeq !== state\.slideLoadRequestSeq/.test(appSource),
  "loadSlide should guard against stale slide responses"
);

console.log("Client fixture validation passed.");
