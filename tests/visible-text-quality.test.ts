import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";

const require = createRequire(import.meta.url);

const {
  collectVisibleTextFields,
  collectVisibleTextIssues,
  isSemanticLengthLeak,
  assertVisibleSlideTextQuality
} = require("../studio/server/services/visible-text-quality.ts");

test("visible text quarantine reports structured issue codes and field paths", () => {
  const issues = collectVisibleTextIssues({
    guardrails: [
      {
        body: "Ensure all claims are supported by official sources.",
        title: "Source Verification"
      }
    ],
    guardrailsTitle: "Guardrails",
    summary: "Audience understands the purpose of this presentation.",
    title: "Demo"
  });

  assert.deepEqual(
    issues.map((issue: { code: string; fieldPath: string }) => `${issue.code}:${issue.fieldPath}`).sort(),
    [
      "authoring-meta:guardrails.0.body",
      "authoring-meta:guardrails.0.title",
      "fallback-scaffold:guardrailsTitle",
      "fallback-scaffold:summary"
    ]
  );
});

test("visible text quarantine collects media and item fields with roles", () => {
  const fields = collectVisibleTextFields({
    media: {
      alt: "Campus building exterior",
      caption: "Photo: Aalto University"
    },
    mediaItems: [
      {
        body: "Prototype testing",
        title: "Lab"
      }
    ],
    title: "Project work"
  });

  assert.deepEqual(
    fields.map((field: { path: string; role: string }) => `${field.path}:${field.role}`),
    [
      "title:title",
      "media.alt:alt",
      "media.caption:caption",
      "mediaItems.0.title:title",
      "mediaItems.0.body:body"
    ]
  );
});

test("semantic deck-length planning language is classified before visible use", () => {
  assert.equal(isSemanticLengthLeak("Semantic length planning added detail where the deck had room to expand."), true);
  assert.equal(isSemanticLengthLeak("Students compare study paths before choosing an application route."), false);
});

test("visible text quarantine errors expose structured issue diagnostics", () => {
  assert.throws(
    () => assertVisibleSlideTextQuality({
      guardrails: [
        {
          body: "Ensure all claims are supported by official sources.",
          id: "guardrail-one",
          title: "Source Verification"
        }
      ],
      guardrailsTitle: "Why it matters",
      summary: "Visible copy should stay audience-facing.",
      title: "Leaky slide",
      type: "content"
    }, "diagnostic fixture"),
    (error: unknown) => {
      const diagnostic = error as {
        code?: unknown;
        fieldPath?: unknown;
        issues?: Array<{ code?: unknown; fieldPath?: unknown }>;
        name?: unknown;
      };
      assert.equal(diagnostic.name, "VisibleTextQualityError");
      assert.equal(diagnostic.code, "authoring-meta");
      assert.equal(diagnostic.fieldPath, "guardrails.0.title");
      assert.equal(diagnostic.issues?.[0]?.code, "authoring-meta");
      assert.equal(diagnostic.issues?.[0]?.fieldPath, "guardrails.0.title");
      return true;
    }
  );
});
