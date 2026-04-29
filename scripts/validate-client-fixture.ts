const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core.ts"), "utf8");
const drawerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/drawers.ts"), "utf8");
const elementsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/elements.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/state.ts"), "utf8");

assert(
  /namespace StudioClientCore/.test(coreSource) && /<script src="\/core\.js"><\/script>/.test(indexSource),
  "Studio client core helpers should live in a separate script loaded before app.js"
);
assert(
  /namespace StudioClientState/.test(stateSource)
    && /function createInitialState\(\)/.test(stateSource)
    && /const state: any = StudioClientState\.createInitialState\(\);/.test(appSource)
    && /<script src="\/state\.js"><\/script>/.test(indexSource),
  "Initial studio state should live in a separate script loaded before app.js"
);
assert(
  /function requiredElement\(id\) \{[\s\S]*?document\.getElementById\(id\)/.test(coreSource),
  "requiredElement should be the single fail-fast DOM id lookup helper"
);
assert(
  /namespace StudioClientElements/.test(elementsSource)
    && /function createElements\(core\)/.test(elementsSource)
    && /const elements: Record<string, any> = StudioClientElements\.createElements\(StudioClientCore\);/.test(appSource)
    && /<script src="\/elements\.js"><\/script>/.test(indexSource),
  "Studio element registry should live in a separate script loaded before app.js"
);
assert(/function postJson\(url, body, options/.test(coreSource), "Expected shared JSON POST request helper");
assert(
  /function optionalElement\(id\) \{[\s\S]*?document\.getElementById\(id\)/.test(coreSource),
  "optionalElement should be the nullable DOM id lookup helper"
);
assert(
  !/:\s*document\.getElementById\("/.test(appSource)
    && !/:\s*document\.getElementById\("/.test(elementsSource),
  "Central element registry should use requiredElement or optionalElement"
);

const deckStructureFunction = appSource.match(/async function ideateDeckStructure\(\) \{[\s\S]*?\n\}/);
assert(deckStructureFunction, "Expected ideateDeckStructure function in studio client");
assert(
  /runDeckStructureWorkflow\(/.test(deckStructureFunction[0]),
  "Deck-structure generation should use the shared deck workflow runner"
);
const deckStructureWorkflowFunction = appSource.match(/async function runDeckStructureWorkflow\(\{ button, endpoint \}\) \{[\s\S]*?\n\}\n\nasync function ideateStructure/);
assert(deckStructureWorkflowFunction, "Expected shared deck-structure workflow runner");
assert(
  /candidateCount:\s*getRequestedCandidateCount\(\)/.test(deckStructureWorkflowFunction[0]),
  "Deck-structure workflow should send the requested candidate count"
);
assert(
  /deckStructureAbortController/.test(appSource)
    && /deckStructureRequestSeq/.test(appSource)
    && /signal: abortController\.signal/.test(deckStructureWorkflowFunction[0]),
  "Deck-structure workflow should combine abort controllers with sequence guards"
);
assert(
  /function applyDeckStructureWorkflowPayload\(payload\)/.test(appSource),
  "Expected shared deck-structure workflow payload helper"
);
assert(
  /async function runDeckStructureWorkflow\(\{ button, endpoint \}\) \{[\s\S]*?postJson\(endpoint/.test(appSource)
    && /async function runSlideCandidateWorkflow\(\{ button, endpoint \}\) \{[\s\S]*?postJson\(endpoint/.test(appSource),
  "Candidate workflow runners should use the shared JSON POST helper"
);
assert(
  /function setDeckStructureCandidates\(candidates\)/.test(appSource)
    && !/state\.deckStructureCandidates = payload\.deckStructureCandidates/.test(appSource),
  "Deck-structure payload application should use the candidate selection helper"
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
  /slideLoadRequestSeq/.test(appSource)
    && /isCurrentAbortableRequest\(state, "slideLoadAbortController", "slideLoadRequestSeq", requestSeq, abortController\)/.test(appSource),
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
assert(/isAbortError/.test(coreSource) && /isAbortError/.test(appSource), "Expected shared abort error helper");
assert(
  /function beginAbortableRequest\(state, controllerKey, requestSeqKey\)/.test(stateSource)
    && /function isCurrentAbortableRequest\(state, controllerKey, requestSeqKey, requestSeq, abortController\)/.test(stateSource)
    && /function clearAbortableRequest\(state, controllerKey, abortController\)/.test(stateSource)
    && /beginAbortableRequest\(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq"\)/.test(appSource),
  "Abortable workflow guards should use shared request guard helpers"
);

assert(/const drawerConfigs = \{/.test(appSource), "Expected drawer registry configuration");
assert(
  /namespace StudioClientDrawers/.test(drawerSource)
    && /createDrawerController/.test(drawerSource)
    && /<script src="\/drawers\.js"><\/script>/.test(indexSource),
  "Drawer controller behavior should live in a separate script loaded before app.js"
);
["assistant", "context", "debug", "layout", "structuredDraft", "theme"].forEach((drawerKey) => {
  assert(
    new RegExp(`\\n  ${drawerKey}: \\{`).test(appSource),
    `Drawer registry should define ${drawerKey}`
  );
});
assert(
  /drawerController\.setOpen\("assistant", open\)/.test(appSource)
    && /drawerController\.render\("assistant"\)/.test(appSource),
  "Drawer behavior should flow through shared render and setter helpers"
);
assert(
  /function closePeers\(openKey\)/.test(drawerSource) && /function persistPreference\(key\)/.test(drawerSource),
  "Drawer registry should centralize mutual exclusion and preference persistence"
);
const renderVariantsFunction = appSource.match(/function renderVariants\(\) \{[\s\S]*?\n\}\n\nfunction canSaveVariantLayout/);
assert(renderVariantsFunction, "Expected renderVariants function in studio client");
assert(/function createDomElement\(tagName/.test(coreSource), "Expected small DOM element builder helper");
assert(
  /createDomElement\("button"[\s\S]*data-action/.test(renderVariantsFunction[0])
    && !/card\.innerHTML\s*=/.test(renderVariantsFunction[0]),
  "Variant cards should use DOM builders instead of dynamic innerHTML"
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
assert(
  /function initializeStudioClient\(\)/.test(appSource) && /initializeStudioClient\(\);/.test(appSource),
  "Studio client startup should flow through an explicit initializer"
);

console.log("Client fixture validation passed.");
