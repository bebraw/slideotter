const { createPresentation } = require("./deck");
const {
  getValidationConstraintOptions,
  readDesignConstraints
} = require("./design-constraints");
const {
  validateImageAspectRatio,
  validateMinimumFontSize,
  validateSlideWordCount,
  validateTextContrast,
  validateTextFit,
  validateTextPadding
} = require("./validation");

function main() {
  const { reports } = createPresentation({ trackLayout: true });
  const constraints = readDesignConstraints();
  const validationOptions = getValidationConstraintOptions(constraints);
  const issues = [
    ...validateImageAspectRatio(reports),
    ...validateTextContrast(reports),
    ...validateMinimumFontSize(reports, validationOptions.minimumFontSize),
    ...validateSlideWordCount(reports, validationOptions.slideWordCount),
    ...validateTextFit(reports),
    ...validateTextPadding(reports, validationOptions.textPadding)
  ];
  const errors = issues.filter((issue) => issue.level === "error");

  for (const issue of issues) {
    const writer = issue.level === "error" ? process.stderr : process.stdout;
    writer.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }

  if (!issues.length) {
    process.stdout.write("Text-fit validation passed.\n");
  }

  if (errors.length) {
    process.exitCode = 1;
  }
}

main();
