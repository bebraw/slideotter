import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import { createDemoPreflightReport, formatReport } from "../scripts/demo-preflight.ts";

const requiredScriptNames = [
  "studio:dev",
  "quality:gate:fast",
  "quality:gate",
  "validate:presentation-workflow",
  "demo:rehearse",
  "fuzz:lmstudio",
  "fuzz:lmstudio:browser"
] as const;

function createPreflightFixture(): {
  cwd: string;
  home: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "slideotter-demo-preflight-"));
  const home = path.join(root, "slideotter-home");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "slides", "output"), { recursive: true });
  fs.mkdirSync(path.join(root, "archive"), { recursive: true });
  fs.mkdirSync(path.join(home, "presentations", "future-frontend-demo"), { recursive: true });

  fs.writeFileSync(path.join(root, "docs", "HYPERMEDIA_DEMO_REHEARSAL.md"), "# Demo\n");
  fs.writeFileSync(path.join(root, "slides", "output", "slideotter.pdf"), Buffer.alloc(60_000));
  fs.writeFileSync(path.join(root, "archive", "slideotter.pdf"), Buffer.alloc(60_000));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    scripts: Object.fromEntries(requiredScriptNames.map((name) => [name, `echo ${name}`]))
  }));

  return { cwd: root, home };
}

test("demo preflight passes with required scripts, docs, artifacts, and user deck", async () => {
  const fixture = createPreflightFixture();
  const report = await createDemoPreflightReport({
    cwd: fixture.cwd,
    env: {
      ...process.env,
      SLIDEOTTER_HOME: fixture.home
    }
  });

  assert.equal(report.ok, true);
  assert.equal(report.checks.some((check) => check.level === "fail"), false);
  assert.match(formatReport(report), /Demo preflight passed/);
});

test("demo preflight reports missing demo scripts as blocking failures", async () => {
  const fixture = createPreflightFixture();
  fs.writeFileSync(path.join(fixture.cwd, "package.json"), JSON.stringify({
    scripts: {
      "studio:dev": "echo studio"
    }
  }));

  const report = await createDemoPreflightReport({
    cwd: fixture.cwd,
    env: {
      ...process.env,
      SLIDEOTTER_HOME: fixture.home
    }
  });

  assert.equal(report.ok, false);
  assert.ok(report.checks.some((check) => check.level === "fail" && check.label === "npm script quality:gate"));
  assert.match(formatReport(report), /blocking failures/);
});
