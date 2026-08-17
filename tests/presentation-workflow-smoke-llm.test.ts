import assert from "node:assert/strict";
import test from "node:test";

import {
  installSmokeLlmMock,
  restoreSmokeLlmMock
} from "../scripts/presentation-workflow/smoke-llm.ts";

test("presentation workflow smoke LLM fails closed for unknown schemas", async () => {
  installSmokeLlmMock();

  try {
    await assert.rejects(
      fetch("http://127.0.0.1:1234/v1/chat/completions", {
        body: JSON.stringify({
          response_format: {
            json_schema: {
              name: "unknown_smoke_schema"
            }
          }
        }),
        method: "POST"
      }),
      /does not handle schema "unknown_smoke_schema"/
    );
  } finally {
    restoreSmokeLlmMock();
  }
});
