import assert from "node:assert/strict";
import test from "node:test";

import { formatFuzzHelp, selectedScenarioNames, selectScenarios } from "../scripts/fuzz-lmstudio-generation-helpers.ts";

const scenarios = [
  { name: "photo-grid-outline" },
  { name: "source-grounded-finnish" }
];

test("LM Studio fuzz helpers select all scenarios by default", () => {
  assert.deepEqual(selectedScenarioNames({}), []);
  assert.deepEqual(selectScenarios(scenarios, []), scenarios);
});

test("LM Studio fuzz helpers parse one or many selected scenarios", () => {
  assert.deepEqual(selectedScenarioNames({ FUZZ_SCENARIO: "photo-grid-outline" }), ["photo-grid-outline"]);
  assert.deepEqual(
    selectedScenarioNames({ FUZZ_SCENARIOS: " photo-grid-outline, source-grounded-finnish " }),
    ["photo-grid-outline", "source-grounded-finnish"]
  );
  assert.deepEqual(
    selectScenarios(scenarios, ["source-grounded-finnish"]).map((scenario) => scenario.name),
    ["source-grounded-finnish"]
  );
});

test("LM Studio fuzz helpers report unknown scenario names", () => {
  assert.throws(
    () => selectScenarios(scenarios, ["missing"]),
    /Unknown FUZZ_SCENARIO value: missing\. Known scenarios: photo-grid-outline, source-grounded-finnish/
  );
});

test("LM Studio fuzz helpers format CLI help from scenario metadata", () => {
  const help = formatFuzzHelp(scenarios);

  assert.match(help, /Usage: npm run fuzz:lmstudio/);
  assert.match(help, /FUZZ_SCENARIOS=a,b/);
  assert.match(help, /  - photo-grid-outline/);
  assert.match(help, /  - source-grounded-finnish/);
});
