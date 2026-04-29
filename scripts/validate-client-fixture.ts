const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const apiExplorerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api-explorer.ts"), "utf8");
const appThemeSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-theme.ts"), "utf8");
const contentRunActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/content-run-actions.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core.ts"), "utf8");
const drawerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/drawers.ts"), "utf8");
const elementsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/elements.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const llmStatusSource = fs.readFileSync(path.join(process.cwd(), "studio/client/llm-status.ts"), "utf8");
const preferencesSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preferences.ts"), "utf8");
const slidePreviewSource = fs.readFileSync(path.join(process.cwd(), "studio/client/slide-preview.ts"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/state.ts"), "utf8");
const validationReportSource = fs.readFileSync(path.join(process.cwd(), "studio/client/validation-report.ts"), "utf8");
const workflowSource = fs.readFileSync(path.join(process.cwd(), "studio/client/workflows.ts"), "utf8");

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
  /namespace StudioClientPreferences/.test(preferencesSource)
    && /function loadDrawerOpen\(key\)/.test(preferencesSource)
    && /function loadAppTheme\(\)/.test(preferencesSource)
    && /<script src="\/preferences\.js"><\/script>/.test(indexSource)
    && /StudioClientPreferences\.loadCurrentPage\(\)/.test(appSource),
  "Local preference helpers should live in a separate script loaded before app.js"
);
assert(
  /namespace StudioClientApiExplorer/.test(apiExplorerSource)
    && /function createApiExplorer/.test(apiExplorerSource)
    && /function mount\(\)/.test(apiExplorerSource)
    && /<script src="\/api-explorer\.js"><\/script>/.test(indexSource)
    && /const apiExplorer = StudioClientApiExplorer\.createApiExplorer/.test(appSource)
    && /apiExplorer\.mount\(\);/.test(appSource),
  "API Explorer behavior should live in a feature script with its own mount"
);
assert(
  /namespace StudioClientAppTheme/.test(appThemeSource)
    && /function createAppTheme/.test(appThemeSource)
    && /function mount\(\)/.test(appThemeSource)
    && /<script src="\/app-theme\.js"><\/script>/.test(indexSource)
    && /const appTheme = StudioClientAppTheme\.createAppTheme/.test(appSource)
    && /appTheme\.mount\(\);/.test(appSource),
  "App theme behavior should live in a feature script with its own mount"
);
assert(
  /namespace StudioClientContentRunActions/.test(contentRunActionsSource)
    && /function mountContentRunControls/.test(contentRunActionsSource)
    && /data-content-run-retry-slide/.test(contentRunActionsSource)
    && /data-studio-content-run-retry/.test(contentRunActionsSource)
    && /<script src="\/content-run-actions\.js"><\/script>/.test(indexSource)
    && /StudioClientContentRunActions\.mountContentRunControls/.test(appSource),
  "Live content-run action handling should live in a feature script with one mount"
);
assert(
  /namespace StudioClientLlmStatus/.test(llmStatusSource)
    && /function createLlmStatus/.test(llmStatusSource)
    && /function getConnectionView/.test(llmStatusSource)
    && /function togglePopover/.test(llmStatusSource)
    && /<script src="\/llm-status\.js"><\/script>/.test(indexSource)
    && /const llmStatus = StudioClientLlmStatus\.createLlmStatus/.test(appSource)
    && /llmStatus\.getConnectionView\(llm\)/.test(appSource),
  "LLM status view and popover state should live in a feature script"
);
assert(
  /namespace StudioClientValidationReport/.test(validationReportSource)
    && /function renderValidationReport/.test(validationReportSource)
    && /validation-summary-card/.test(validationReportSource)
    && /<script src="\/validation-report\.js"><\/script>/.test(indexSource)
    && /StudioClientValidationReport\.renderValidationReport/.test(appSource),
  "Validation report rendering should live in a feature script"
);
assert(
  /namespace StudioClientSlidePreview/.test(slidePreviewSource)
    && /function createSlidePreview/.test(slidePreviewSource)
    && /function renderDomSlide/.test(slidePreviewSource)
    && /function renderImagePreview/.test(slidePreviewSource)
    && /<script src="\/slide-preview\.js"><\/script>/.test(indexSource)
    && /const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(appSource),
  "Shared slide preview rendering should live in a feature script"
);
assert(
  /request\("\/api\/themes\/generate"/.test(appSource)
    && !/function generateThemeFromBriefText/.test(appSource)
    && !/function hashTextToIndex/.test(appSource),
  "Theme brief generation should rely on the server endpoint instead of browser-side fallback tokens"
);
assert(
  /namespace StudioClientWorkflows/.test(workflowSource)
    && /function createWorkflowRunners/.test(workflowSource)
    && /function runSlideCandidate/.test(workflowSource)
    && /function runDeckStructure/.test(workflowSource)
    && /<script src="\/workflows\.js"><\/script>/.test(indexSource)
    && /const workflowRunners = StudioClientWorkflows\.createWorkflowRunners/.test(appSource),
  "Shared candidate workflow runners should live in a separate script"
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
  /function highlightJsonSource\(source\)/.test(coreSource)
    && /function formatSourceCode\(source, format = "plain"\)/.test(coreSource)
    && !/function highlightJsonSource\(source\)/.test(appSource),
  "Shared source formatting helpers should live in the core module"
);
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
const deckStructureWorkflowFunction = workflowSource.match(/async function runDeckStructure\(\{ button, endpoint \}\) \{[\s\S]*?\n    \}/);
assert(deckStructureWorkflowFunction, "Expected shared deck-structure workflow runner");
assert(
  /candidateCount:\s*getRequestedCandidateCount\(\)/.test(deckStructureWorkflowFunction[0]),
  "Deck-structure workflow should send the requested candidate count"
);
assert(
  /deckStructureAbortController/.test(workflowSource)
    && /deckStructureRequestSeq/.test(workflowSource)
    && /signal: abortController\.signal/.test(deckStructureWorkflowFunction[0]),
  "Deck-structure workflow should combine abort controllers with sequence guards"
);
assert(
  /function applyDeckStructureWorkflowPayload\(payload\)/.test(appSource),
  "Expected shared deck-structure workflow payload helper"
);
assert(
  /function runDeckStructure/.test(workflowSource)
    && /function runSlideCandidate/.test(workflowSource)
    && /postJson\(endpoint/.test(workflowSource),
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
  /slideWorkflowAbortController/.test(workflowSource)
    && /slideWorkflowRequestSeq/.test(workflowSource)
    && /signal: abortController\.signal/.test(workflowSource),
  "Slide candidate workflows should combine abort controllers with sequence guards"
);
assert(/isAbortError/.test(coreSource) && /isAbortError/.test(appSource), "Expected shared abort error helper");
assert(
  /function beginAbortableRequest\(state, controllerKey, requestSeqKey\)/.test(stateSource)
    && /function isCurrentAbortableRequest\(state, controllerKey, requestSeqKey, requestSeq, abortController\)/.test(stateSource)
    && /function clearAbortableRequest\(state, controllerKey, abortController\)/.test(stateSource)
    && /beginAbortableRequest\(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq"\)/.test(workflowSource),
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
  "mountContentRunControls",
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
