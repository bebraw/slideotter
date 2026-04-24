const { validateDeckInDom } = require("../studio/server/services/dom-validate.ts");

function writeIssues(issues) {
  for (const issue of issues) {
    const writer = issue.level === "error" ? process.stderr : process.stdout;
    writer.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }
}

async function main() {
  const { geometry } = await validateDeckInDom();
  writeIssues(geometry.issues);

  if (!geometry.issues.length) {
    process.stdout.write("Geometry validation passed.\n");
  }

  if (geometry.errors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
