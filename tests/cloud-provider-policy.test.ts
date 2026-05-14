import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedProviderWorkflow,
  normalizeCloudProvider,
  normalizeOptionalCloudIds,
  normalizeProviderDataClasses,
  normalizeProviderWorkflows
} from "../cloud/worker-provider-policy.ts";

type BadRequestPayload = {
  code?: unknown;
  error?: unknown;
};

async function assertBadRequestResponse(value: unknown, expectedErrorPart: string): Promise<void> {
  assert.ok(value instanceof Response);
  assert.equal(value.status, 400);

  const payload = await value.json() as BadRequestPayload;
  const error = payload.error;
  assert.equal(payload.code, "bad-request");
  if (typeof error !== "string") {
    assert.fail("Expected bad request response error to be a string.");
  }
  assert.match(error, new RegExp(expectedErrorPart));
}

test("provider policy normalizes default cloud provider settings", () => {
  assert.equal(normalizeCloudProvider(undefined), "workers-ai");
  assert.deepEqual(normalizeProviderDataClasses(undefined), ["deck-context", "selected-source-snippets"]);
  assert.deepEqual(normalizeProviderWorkflows(undefined), ["deck-outline", "slide-draft", "variant", "theme"]);
});

test("provider policy accepts all supported data classes and workflows", () => {
  assert.deepEqual(normalizeProviderDataClasses([
    "deck-context",
    "selected-source-snippets",
    "materials-metadata",
    "model-visible-media",
    "materials-metadata"
  ]), [
    "deck-context",
    "selected-source-snippets",
    "materials-metadata",
    "model-visible-media"
  ]);

  assert.deepEqual(normalizeProviderWorkflows([
    "deck-outline",
    "slide-draft",
    "theme",
    "variant",
    "theme"
  ]), [
    "deck-outline",
    "slide-draft",
    "theme",
    "variant"
  ]);
});

test("provider policy trims and filters list inputs", () => {
  assert.deepEqual(normalizeProviderDataClasses([
    " deck-context ",
    "",
    null,
    "selected-source-snippets"
  ]), [
    "deck-context",
    "selected-source-snippets"
  ]);

  assert.deepEqual(normalizeProviderWorkflows([
    " theme ",
    "",
    null,
    "variant",
    "theme"
  ]), [
    "theme",
    "variant"
  ]);
});

test("provider policy reports unsupported data classes and workflows", async () => {
  await assertBadRequestResponse(
    normalizeProviderDataClasses(["deck-context", "full-source-documents"]),
    "unsupported data class: full-source-documents"
  );
  await assertBadRequestResponse(
    normalizeProviderWorkflows(["theme", "deck-export"]),
    "unsupported workflow: deck-export"
  );
});

test("provider policy normalizes and validates cloud provider values", async () => {
  assert.equal(normalizeCloudProvider(" workers-ai "), "workers-ai");

  await assertBadRequestResponse(
    normalizeCloudProvider("openai"),
    "provider must be workers-ai"
  );
});

test("provider policy normalizes optional cloud ids", async () => {
  assert.deepEqual(normalizeOptionalCloudIds([
    " team-alpha ",
    "",
    null,
    "team-alpha",
    "deck-01"
  ], "workspace id"), [
    "team-alpha",
    "deck-01"
  ]);

  await assertBadRequestResponse(
    normalizeOptionalCloudIds(["team-alpha!"], "workspace id"),
    "workspace id must start"
  );
  await assertBadRequestResponse(
    normalizeOptionalCloudIds(["!team-alpha"], "workspace id"),
    "workspace id must start"
  );
});

test("provider policy workflow support checks exact supported workflow values", () => {
  assert.equal(isSupportedProviderWorkflow("theme"), true);
  assert.equal(isSupportedProviderWorkflow(" theme "), false);
  assert.equal(isSupportedProviderWorkflow(null), false);
});
