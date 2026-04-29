const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");

assert(
  /function requiredElement\(id\) \{[\s\S]*?document\.getElementById\(id\)/.test(appSource),
  "requiredElement should be the single fail-fast DOM id lookup helper"
);
assert(
  /function optionalElement\(id\) \{[\s\S]*?document\.getElementById\(id\)/.test(appSource),
  "optionalElement should be the nullable DOM id lookup helper"
);
assert(
  !/:\s*document\.getElementById\("/.test(appSource),
  "Central element registry should use requiredElement or optionalElement"
);

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
assert(
  /slideLoadAbortController/.test(appSource)
    && /request\(`\/api\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(appSource),
  "loadSlide should abort superseded slide requests"
);
assert(
  /slideWorkflowAbortController/.test(appSource)
    && /slideWorkflowRequestSeq/.test(appSource)
    && /signal: abortController\.signal/.test(appSource),
  "Slide candidate workflows should combine abort controllers with sequence guards"
);
assert(/function isAbortError\(error\)/.test(appSource), "Expected shared abort error helper");

assert(/const drawerConfigs = \{/.test(appSource), "Expected drawer registry configuration");
["assistant", "context", "debug", "layout", "structuredDraft", "theme"].forEach((drawerKey) => {
  assert(
    new RegExp(`\\n  ${drawerKey}: \\{`).test(appSource),
    `Drawer registry should define ${drawerKey}`
  );
});
assert(
  /function setDrawerOpen\(key, open\)/.test(appSource) && /function renderDrawer\(key\)/.test(appSource),
  "Drawer behavior should flow through shared render and setter helpers"
);
assert(
  /function closePeerDrawers\(openKey\)/.test(appSource) && /persistDrawerPreference\(key\)/.test(appSource),
  "Drawer registry should centralize mutual exclusion and preference persistence"
);
[
  "mountStudioCommandControls",
  "mountPresentationCreateInputs",
  "mountThemeInputs",
  "mountGlobalEvents"
].forEach((functionName) => {
  assert(
    new RegExp(`function ${functionName}\\(\\)`).test(appSource) && new RegExp(`${functionName}\\(\\);`).test(appSource),
    `${functionName} should own one event-binding group and be mounted explicitly`
  );
});

console.log("Client fixture validation passed.");
