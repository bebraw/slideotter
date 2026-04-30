const path = require("path");
const { getOutputConfig } = require("./output-config.ts");
const {
  comparePageImages,
  listPages,
  renderPdfPages,
  resetDir
} = require("./baseline-utils.ts");
const { validateDeckInDom } = require("./dom-validate.ts");
const { readValidationSettings, resolveValidationLevel } = require("./validation-settings.ts");
const {
  outputDir,
  renderCheckCurrentDir,
  renderCheckDiffDir
} = require("./paths.ts");
const {
  ensureAllowedDir,
  removeAllowedPath
} = require("./write-boundary.ts");
const { buildAndRenderDeck } = require("./build.ts");

const MAX_NORMALIZED_RMSE = 0.001;

type ValidationOptions = {
  includeRender?: boolean;
};

function asAssetUrl(fileName: string): string {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeFailure(error: unknown, message: string) {
  const validationSettings = readValidationSettings();
  const issue = {
    level: resolveValidationLevel("dom-validation-failed", "error", validationSettings),
    slide: 0,
    rule: "dom-validation-failed",
    message: `${message}: ${formatErrorMessage(error)}`
  };

  return {
    errors: [issue],
    issues: [issue],
    ok: false
  };
}

async function runRenderValidation() {
  const validationSettings = readValidationSettings();
  const { baselineDir, pdfFile } = getOutputConfig();
  const baselinePages = listPages(baselineDir);
  if (!baselinePages.length) {
    return {
      errors: [{
        level: resolveValidationLevel("baseline-missing", "error", validationSettings),
        slide: 0,
        rule: "baseline-missing",
        message: "No render baseline found. Run npm run baseline:render to create it."
      }],
      failures: [],
      issues: [],
      ok: false
    };
  }

  ensureAllowedDir(renderCheckDiffDir);
  const currentPages = await renderPdfPages(renderCheckCurrentDir, pdfFile);
  if (baselinePages.length !== currentPages.length) {
    return {
      errors: [{
        level: resolveValidationLevel("render-page-count", "error", validationSettings),
        slide: 0,
        rule: "render-page-count",
        message: `Rendered page count changed. baseline=${baselinePages.length}, current=${currentPages.length}`
      }],
      failures: [],
      issues: [],
      ok: false
    };
  }

  resetDir(renderCheckDiffDir);
  const failures = [];

  for (let index = 0; index < baselinePages.length; index += 1) {
    const diffPath = path.join(renderCheckDiffDir, `page-${String(index).padStart(2, "0")}-diff.png`);
    const comparison = await comparePageImages(baselinePages[index], currentPages[index], diffPath);

    if (!Number.isFinite(comparison.normalized) || comparison.normalized > MAX_NORMALIZED_RMSE) {
      failures.push({
        diffUrl: asAssetUrl(diffPath),
        metric: comparison.raw,
        page: index + 1
      });
      continue;
    }

    removeAllowedPath(diffPath, { force: true });
  }

  return {
    errors: failures.map((failure) => ({
      level: resolveValidationLevel("render-mismatch", "error", validationSettings),
      slide: failure.page,
      rule: "render-mismatch",
      message: `Page ${failure.page} differs from the approved render baseline (${failure.metric})`
    })),
    failures,
    issues: [],
    ok: failures.length === 0
  };
}

async function validateDeck(options: ValidationOptions = {}) {
  const includeRender = options.includeRender === true;
  const buildResult = await buildAndRenderDeck();
  let domResult;

  try {
    domResult = await validateDeckInDom();
  } catch (error) {
    const failure = summarizeFailure(error, "DOM validation failed");
    const render = includeRender
      ? await runRenderValidation()
      : {
          errors: [],
          failures: [],
          issues: [],
          ok: true,
          skipped: true
        };

    return {
      build: buildResult.build,
      geometry: failure,
      ok: false,
      previews: buildResult.previews,
      render,
      text: failure
    };
  }

  const geometry = domResult.geometry;
  const text = domResult.text;
  const render = includeRender
    ? await runRenderValidation()
    : {
        errors: [],
        failures: [],
        issues: [],
        ok: true,
        skipped: true
      };

  return {
    build: buildResult.build,
    geometry,
    ok: geometry.ok && text.ok && render.ok,
    previews: buildResult.previews,
    render,
    text
  };
}

module.exports = {
  validateDeck
};
