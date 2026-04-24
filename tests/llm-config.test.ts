const assert = require("node:assert/strict");
const test = require("node:test");

const { getLlmStatus } = require("../studio/server/services/llm/client.ts");

const trackedEnvKeys = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MODEL",
  "STUDIO_LLM_BASE_URL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalEnv = Object.fromEntries(trackedEnvKeys.map((key) => [key, process.env[key]]));

function restoreEnv() {
  trackedEnvKeys.forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  });
}

test.after(() => {
  restoreEnv();
});

test("OpenRouter provider reports configuration from environment", () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_MODEL = "openai/gpt-4o";

  const status = getLlmStatus();

  assert.equal(status.available, true);
  assert.equal(status.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(status.model, "openai/gpt-4o");
  assert.equal(status.provider, "openrouter");
});

test("OpenRouter provider normalizes public base URL variants", () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_MODEL = "openai/gpt-4o";
  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai";

  assert.equal(getLlmStatus().baseUrl, "https://openrouter.ai/api/v1");

  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api";

  assert.equal(getLlmStatus().baseUrl, "https://openrouter.ai/api/v1");
});

test("OpenRouter provider requires both API key and model", () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  delete process.env.OPENROUTER_MODEL;
  delete process.env.STUDIO_LLM_MODEL;

  const status = getLlmStatus();

  assert.equal(status.available, false);
  assert.match(status.configuredReason, /OPENROUTER_API_KEY and OPENROUTER_MODEL/);
});
