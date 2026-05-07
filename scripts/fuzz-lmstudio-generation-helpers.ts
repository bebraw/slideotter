export type FuzzScenario = {
  name: string;
};

export const promptLeakFakeProvider = "prompt-leak";
export const fakeProviderModes = [promptLeakFakeProvider] as const;
type KnownFakeProviderMode = typeof fakeProviderModes[number];
const knownFakeProviders = fakeProviderModes.join(", ");

type FuzzEnvironment = {
  FUZZ_FAKE_PROVIDER?: string | undefined;
  FUZZ_SCENARIO?: string | undefined;
  FUZZ_SCENARIOS?: string | undefined;
};

export type FakeProviderMode = "" | KnownFakeProviderMode;

export function selectedScenarioNames(env: FuzzEnvironment = process.env): string[] {
  return String(env.FUZZ_SCENARIO || env.FUZZ_SCENARIOS || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function isKnownFakeProviderMode(provider: string): provider is KnownFakeProviderMode {
  return fakeProviderModes.some((mode) => mode === provider);
}

export function selectedFakeProvider(env: FuzzEnvironment = process.env): FakeProviderMode {
  const provider = String(env.FUZZ_FAKE_PROVIDER || "").trim();
  if (!provider) {
    return "";
  }

  if (isKnownFakeProviderMode(provider)) {
    return provider;
  }

  throw new Error(`Unknown FUZZ_FAKE_PROVIDER value: ${provider}. Known fake providers: ${knownFakeProviders}`);
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
    `  FUZZ_FAKE_PROVIDER=${promptLeakFakeProvider}`,
    "                          Run the prompt leak containment scenario without LM Studio.",
    "",
    "Scenarios:",
    scenarioList
  ].join("\n");
}
