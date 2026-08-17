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
  _test: {
    contentSecurityPolicy: string;
    createInternalServerErrorResponse(request: Request): Response;
    finalizeWebsiteResponse(request: Request, response: Response): Response;
    securityHeaders: Readonly<Record<string, string>>;
  };
};

const worker = require("../website/worker.ts") as WebsiteWorker;

const context = {
  waitUntil(_promise: Promise<unknown>): void {
    return;
  }
};

const expectedSecurityHeaders = {
  "content-security-policy": "default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'self' https://fonts.gstatic.com; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
} as const;

function fetchWebsite(pathname: string, init?: RequestInit): Promise<Response> | Response {
  return worker.default.fetch(new Request(`https://slideotter.test${pathname}`, init), {}, context);
}

function assertSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(expectedSecurityHeaders)) {
    assert.equal(response.headers.get(name), value, `${name} should match the public website policy`);
  }

  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
}

test("website renders the home page", async () => {
  const response = await fetchWebsite("/");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.equal(response.headers.get("cache-control"), null);
  assertSecurityHeaders(response);
  assert.match(body, /<title>slideotter<\/title>/);
  assert.match(body, /class="skip-link" href="#main-content"/);
  assert.match(body, /id="main-content"/);
});

test("website renders a branded 404 for unknown routes", async () => {
  const response = await fetchWebsite("/bar");
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assertSecurityHeaders(response);
  assert.match(body, /Page not found/);
  assert.match(body, /Return home/);
  assert.doesNotMatch(body, /Internal Server Error/);
});

test("website keeps GET and HEAD response metadata aligned", async () => {
  for (const [pathname, expectedStatus] of [["/", 200], ["/missing", 404]] as const) {
    const getResponse = await fetchWebsite(pathname);
    const headResponse = await fetchWebsite(pathname, { method: "HEAD" });

    assert.equal(headResponse.status, expectedStatus);
    assert.equal(headResponse.status, getResponse.status);
    assert.equal(headResponse.headers.get("content-type"), getResponse.headers.get("content-type"));
    assert.equal(headResponse.headers.get("cache-control"), getResponse.headers.get("cache-control"));
    assertSecurityHeaders(headResponse);
    assert.equal(await headResponse.text(), "");
  }
});

test("website preserves method negotiation while hardening 405 responses", async () => {
  const response = await fetchWebsite("/", { method: "POST" });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assertSecurityHeaders(response);
  assert.equal(await response.text(), "Method Not Allowed");
});

test("website hardens generic errors and suppresses HEAD error bodies", async () => {
  const getRequest = new Request("https://slideotter.test/failure");
  const getResponse = worker._test.finalizeWebsiteResponse(
    getRequest,
    worker._test.createInternalServerErrorResponse(getRequest)
  );
  const headRequest = new Request("https://slideotter.test/failure", { method: "HEAD" });
  const headResponse = worker._test.finalizeWebsiteResponse(
    headRequest,
    worker._test.createInternalServerErrorResponse(headRequest)
  );

  assert.equal(getResponse.status, 500);
  assert.equal(getResponse.headers.get("cache-control"), "no-store");
  assertSecurityHeaders(getResponse);
  assert.equal(await getResponse.text(), "Internal Server Error");
  assert.equal(headResponse.status, 500);
  assertSecurityHeaders(headResponse);
  assert.equal(await headResponse.text(), "");
});

test("website contains unexpected asset failures behind a generic 500", async () => {
  const logs: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...values: unknown[]) => logs.push(values);

  try {
    const response = await worker.default.fetch(
      new Request("https://slideotter.test/broken.ico"),
      {
        ASSETS: {
          async fetch(): Promise<Response> {
            throw new Error("asset backend detail");
          }
        }
      },
      context
    );

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertSecurityHeaders(response);
    assert.equal(await response.text(), "Internal Server Error");
    assert.match(JSON.stringify(logs), /asset backend detail/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("website sends HSTS only for HTTPS requests", async () => {
  const request = new Request("http://slideotter.test/");
  const response = worker._test.finalizeWebsiteResponse(request, new Response("ok"));

  assert.equal(response.headers.get("strict-transport-security"), null);
  assert.equal(worker._test.contentSecurityPolicy, expectedSecurityHeaders["content-security-policy"]);
  assert.deepEqual(worker._test.securityHeaders, expectedSecurityHeaders);
});
