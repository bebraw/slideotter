const { validateDeckInDom } = require("../studio/server/services/dom-validate.ts");

function writeIssues(issues) {
  for (const issue of issues) {
    const writer = issue.level === "error" ? process.stderr : process.stdout;
    writer.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }
}

async function main() {
  const { text } = await validateDeckInDom();
  writeIssues(text.issues);

  if (!text.issues.length) {
    process.stdout.write("Text validation passed.\n");
  }

  if (text.errors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
