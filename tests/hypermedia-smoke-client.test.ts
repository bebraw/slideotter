import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { once } from "node:events";
import test from "node:test";

const { runHypermediaSmokeClient } = require("../scripts/hypermedia-smoke-client.ts");
const { startServer } = require("../studio/server/index.ts");

async function startTestServer() {
  const server = startServer({ port: 0 });
  if (!server.listening) {
    await once(server, "listening");
  }

  const address = server.address();
  const port = address && typeof address === "object" ? address.port : null;
  assert.ok(port, "Hypermedia smoke client tests need a local server port");

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server
  };
}

test("headless hypermedia smoke client follows links and advertised write actions", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const result = await runHypermediaSmokeClient({ baseUrl });

    assert.ok(result.presentationId);
    assert.ok(result.slideId);
  } finally {
    server.close();
  }
});
