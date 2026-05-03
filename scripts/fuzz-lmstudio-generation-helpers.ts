export type FuzzScenario = {
  name: string;
};

type FuzzEnvironment = {
  FUZZ_SCENARIO?: string | undefined;
  FUZZ_SCENARIOS?: string | undefined;
};

export function selectedScenarioNames(env: FuzzEnvironment = process.env): string[] {
  return String(env.FUZZ_SCENARIO || env.FUZZ_SCENARIOS || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function selectScenarios<TScenario extends FuzzScenario>(scenarios: TScenario[], selectedNames: string[]): TScenario[] {
  if (!selectedNames.length) {
    return scenarios;
  }

  const selectedScenarios = scenarios.filter((scenario) => selectedNames.includes(scenario.name));
  if (selectedScenarios.length !== selectedNames.length) {
    const knownNames = scenarios.map((scenario) => scenario.name).join(", ");
    const missingNames = selectedNames.filter((name) => !scenarios.some((scenario) => scenario.name === name)).join(", ");
    throw new Error(`Unknown FUZZ_SCENARIO value${missingNames.includes(",") ? "s" : ""}: ${missingNames}. Known scenarios: ${knownNames}`);
  }

  return selectedScenarios;
}

export function formatFuzzHelp(scenarios: FuzzScenario[]): string {
  const scenarioList = scenarios.map((scenario) => `  - ${scenario.name}`).join("\n");
  return [
    "Usage: npm run fuzz:lmstudio",
    "",
    "Environment:",
    "  FUZZ_SCENARIO=name       Run one scenario.",
    "  FUZZ_SCENARIOS=a,b       Run a comma-separated scenario list.",
    "  LMSTUDIO_BASE_URL=url    Override the LM Studio OpenAI-compatible base URL.",
    "  LMSTUDIO_MODEL=model     Use a specific loaded model instead of /models discovery.",
    "",
    "Scenarios:",
    scenarioList
  ].join("\n");
}
