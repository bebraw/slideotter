const { createPresentation } = require("./deck");
const {
  getValidationConstraintOptions,
  readDesignConstraints
} = require("./design-constraints");
const {
  validateCaptionSpacing,
  validateGeometry,
  validateVerticalBalance
} = require("./validation");

function main() {
  const { reports } = createPresentation({ trackLayout: true });
  const constraints = readDesignConstraints();
  const validationOptions = getValidationConstraintOptions(constraints);
  const issues = [
    ...validateGeometry(reports),
    ...validateVerticalBalance(reports, validationOptions.verticalBalance),
    ...validateCaptionSpacing(reports, validationOptions.captionSpacing)
  ];
  const errors = issues.filter((issue) => issue.level === "error");

  if (!issues.length) {
    process.stdout.write("Geometry validation passed.\n");
    return;
  }

  for (const issue of issues) {
    const writer = issue.level === "error" ? process.stderr : process.stdout;
    writer.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }

  if (errors.length) {
    process.exitCode = 1;
  }
}

main();
