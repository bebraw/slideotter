// @ts-check

/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  $schema: "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  testRunner: "command",
  commandRunner: {
    command: "npm test",
  },
  coverageAnalysis: "off",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: [
    "studio/server/services/generated-json-path.ts",
    "studio/shared/json-utils.ts",
    "studio/shared/outline-locks.ts",
    "!**/*.test.ts",
    "!**/*.d.ts",
  ],
  ignorePatterns: [
    ".codex",
    "archive",
    "desktop-dist",
    "dist",
    "docs/assets",
    "slides/output",
    "studio/baseline",
    "studio/client-dist",
    "studio/output",
    "website/dist",
    "website/website/dist",
  ],
  reporters: ["progress", "clear-text", "html", "json"],
  htmlReporter: {
    fileName: "reports/mutation/mutation.html",
  },
  jsonReporter: {
    fileName: "reports/mutation/mutation.json",
  },
  incremental: true,
  concurrency: "50%",
  thresholds: {
    high: 80,
    low: 60,
    break: 90,
  },
};

export default config;
