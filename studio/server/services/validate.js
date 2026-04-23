const fs = require("fs");
const path = require("path");
const { createPresentation } = require("../../../generator/deck");
const {
  getValidationConstraintOptions,
  readDesignConstraints
} = require("../../../generator/design-constraints");
const {
  baselineDir,
  comparePageImages,
  ensureDir,
  listPages,
  renderPdfPages,
  resetDir
} = require("../../../generator/render-utils");
const {
  validateCaptionSpacing,
  validateGeometry,
  validateImageAspectRatio,
  validateMinimumFontSize,
  validateSlideWordCount,
  validateTextContrast,
  validateTextFit,
  validateTextPadding,
  validateVerticalBalance
} = require("../../../generator/validation");
const {
  outputDir,
  renderCheckCurrentDir,
  renderCheckDiffDir
} = require("./paths");
const { buildAndRenderDeck } = require("./build");

const MAX_NORMALIZED_RMSE = 0.001;

function asAssetUrl(fileName) {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function summarizeIssues(issues) {
  return {
    errors: issues.filter((issue) => issue.level === "error"),
    issues,
    ok: !issues.some((issue) => issue.level === "error")
  };
}

function runGeometryValidation(reports, validationOptions) {
  return summarizeIssues([
    ...validateGeometry(reports),
    ...validateVerticalBalance(reports, validationOptions.verticalBalance),
    ...validateCaptionSpacing(reports, validationOptions.captionSpacing)
  ]);
}

function runTextValidation(reports, validationOptions) {
  return summarizeIssues([
    ...validateImageAspectRatio(reports),
    ...validateTextContrast(reports),
    ...validateMinimumFontSize(reports, validationOptions.minimumFontSize),
    ...validateSlideWordCount(reports, validationOptions.slideWordCount),
    ...validateTextFit(reports),
    ...validateTextPadding(reports, validationOptions.textPadding)
  ]);
}

function runRenderValidation() {
  const baselinePages = listPages(baselineDir);
  if (!baselinePages.length) {
    return {
      errors: [{
        level: "error",
        slide: 0,
        rule: "baseline-missing",
        message: "No render baseline found. Run npm run baseline:render to create it."
      }],
      failures: [],
      issues: [],
      ok: false
    };
  }

  ensureDir(renderCheckDiffDir);
  const currentPages = renderPdfPages(renderCheckCurrentDir);
  if (baselinePages.length !== currentPages.length) {
    return {
      errors: [{
        level: "error",
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
    const comparison = comparePageImages(baselinePages[index], currentPages[index], diffPath);

    if (!Number.isFinite(comparison.normalized) || comparison.normalized > MAX_NORMALIZED_RMSE) {
      failures.push({
        diffUrl: asAssetUrl(diffPath),
        metric: comparison.raw,
        page: index + 1
      });
      continue;
    }

    fs.rmSync(diffPath, { force: true });
  }

  return {
    errors: failures.map((failure) => ({
      level: "error",
      slide: failure.page,
      rule: "render-mismatch",
      message: `Page ${failure.page} differs from the approved render baseline (${failure.metric})`
    })),
    failures,
    issues: [],
    ok: failures.length === 0
  };
}

async function validateDeck(options = {}) {
  const includeRender = options.includeRender === true;
  const buildResult = await buildAndRenderDeck();
  const { reports } = createPresentation({ trackLayout: true });
  const validationOptions = getValidationConstraintOptions(readDesignConstraints());
  const geometry = runGeometryValidation(reports, validationOptions);
  const text = runTextValidation(reports, validationOptions);
  const render = includeRender
    ? runRenderValidation()
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
