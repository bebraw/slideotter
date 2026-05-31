import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

type WebsiteWorker = {
  default: {
    fetch(request: Request, env: Record<string, unknown>, ctx: {
      waitUntil(promise: Promise<unknown>): void;
    }): Promise<Response> | Response;
  };
};

const worker = require("../website/worker.ts") as WebsiteWorker;

const context = {
  waitUntil(_promise: Promise<unknown>): void {
    return;
  }
};

test("website renders the home page", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/"), {}, context);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /<title>slideotter<\/title>/);
});

test("website renders a branded 404 for unknown routes", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/bar"), {}, context);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(body, /Page not found/);
  assert.match(body, /Return home/);
  assert.doesNotMatch(body, /Internal Server Error/);
});

