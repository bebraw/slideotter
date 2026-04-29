const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..");

test("desktop package config follows the Electron wrapper ADR boundary", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const clientSource = fs.readFileSync(path.join(repoRoot, "studio", "client", "app.ts"), "utf8");
  const mainSource = fs.readFileSync(path.join(repoRoot, "desktop", "main.cjs"), "utf8");
  const preferencesSource = fs.readFileSync(path.join(repoRoot, "studio", "client", "preferences.ts"), "utf8");

  assert.equal(packageJson.main, "desktop/main.cjs");
  assert.match(packageJson.scripts["desktop:dev"], /package:build/);
  assert.match(packageJson.scripts["desktop:dev"], /env -u ELECTRON_RUN_AS_NODE electron \./);
  assert.match(packageJson.scripts["desktop:smoke"], /env -u ELECTRON_RUN_AS_NODE SLIDEOTTER_ELECTRON_SMOKE=1 electron \./);
  assert.match(packageJson.scripts["desktop:pack"], /npm run desktop:browsers/);
  assert.match(packageJson.scripts["desktop:pack"], /electron-builder --mac --dir/);
  assert.match(packageJson.scripts["desktop:dist"], /npm run desktop:browsers/);
  assert.match(packageJson.scripts["desktop:dist"], /electron-builder --mac/);
  assert.match(packageJson.scripts["desktop:browsers"], /PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium/);
  assert.equal(packageJson.build.productName, "slideotter");
  assert.deepEqual(packageJson.build.mac.target, ["dmg", "zip"]);
  assert.ok(packageJson.build.files.includes("dist/**/*"), "desktop package should use the packaged runtime");
  assert.ok(packageJson.build.files.includes("node_modules/playwright-core/.local-browsers/**/*"), "desktop package should include hermetic Playwright browsers");

  assert.match(mainSource, /SLIDEOTTER_HOME/);
  assert.match(mainSource, /\.slideotter/);
  assert.match(mainSource, /SLIDEOTTER_DATA_DIR/);
  assert.match(mainSource, /port: 0/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /Open Data Folder/);
  assert.match(mainSource, /Open Archive Folder/);
  assert.match(mainSource, /Open Current Presentation Output/);
  assert.match(clientSource, /StudioClientPreferences\.loadCurrentPage\(\)/);
  assert.match(clientSource, /StudioClientPreferences\.persistCurrentPage\(state\.ui\.currentPage\)/);
  assert.match(preferencesSource, /return "presentations";\n  }\n\n  export function persistCurrentPage/);
});
