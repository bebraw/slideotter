const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.join(__dirname, "..");
const coverageDir = fs.mkdtempSync(path.join(os.tmpdir(), "slideotter-service-coverage-"));
const targetFiles = [
  "studio/server/services/presentations.ts",
  "studio/server/services/deck-length.ts",
  "studio/server/services/slides.ts",
  "studio/server/services/materials.ts",
  "studio/server/services/sources.ts",
  "studio/server/services/variants.ts",
  "studio/server/services/write-boundary.ts"
].map((fileName) => path.resolve(repoRoot, fileName));
const thresholds = {
  overallFunctions: 70,
  overallLines: 70,
  perFileFunctions: 55,
  perFileLines: 55
};

function listTestFiles() {
  const testsDir = path.join(repoRoot, "tests");
  return fs.readdirSync(testsDir)
    .filter((fileName) => fileName.endsWith(".test.ts"))
    .sort()
    .map((fileName) => path.join(testsDir, fileName));
}

function normalizeCoverageUrl(url) {
  if (url.startsWith("file://")) {
    return path.resolve(new URL(url).pathname);
  }

  return path.resolve(url);
}

function lineOffsets(source) {
  const lines = source.split("\n");
  let offset = 0;

  return lines.map((line) => {
    const start = offset;
    const end = offset + line.length;
    offset = end + 1;

    return {
      end,
      firstCodeOffset: start + (line.match(/\S/)?.index ?? 0),
      start,
      text: line
    };
  });
}

function isTopLevelFunction(coverageFunction, sourceLength) {
  const firstRange = coverageFunction.ranges && coverageFunction.ranges[0];
  return coverageFunction.functionName === ""
    && firstRange
    && firstRange.startOffset === 0
    && firstRange.endOffset >= sourceLength;
}

function rangeLength(range) {
  return range.endOffset - range.startOffset;
}

function countAtOffset(ranges, offset) {
  const containingRanges = ranges
    .filter((range) => range.startOffset <= offset && offset < range.endOffset)
    .sort((left, right) => rangeLength(left) - rangeLength(right));

  return containingRanges.length ? containingRanges[0].count : 0;
}

function collectFileCoverage(fileName, scriptCoverage) {
  const source = fs.readFileSync(fileName, "utf8");
  const coverageFunctions = (scriptCoverage.functions || [])
    .filter((coverageFunction) => !isTopLevelFunction(coverageFunction, source.length));
  const executableRanges = coverageFunctions
    .map((coverageFunction) => coverageFunction.ranges && coverageFunction.ranges[0])
    .filter(Boolean);
  const allRanges = coverageFunctions.flatMap((coverageFunction) => coverageFunction.ranges || []);
  const lines = lineOffsets(source)
    .filter((line) => line.text.trim())
    .filter((line) => executableRanges.some((range) => range.startOffset <= line.firstCodeOffset && line.firstCodeOffset < range.endOffset));
  const coveredLines = lines.filter((line) => countAtOffset(allRanges, line.firstCodeOffset) > 0);
  const functions = coverageFunctions.filter((coverageFunction) => coverageFunction.functionName !== "");
  const coveredFunctions = functions.filter((coverageFunction) => {
    const firstRange = coverageFunction.ranges && coverageFunction.ranges[0];
    return firstRange && firstRange.count > 0;
  });

  return {
    coveredFunctions: coveredFunctions.length,
    coveredLines: coveredLines.length,
    fileName,
    functions: functions.length,
    lines: lines.length
  };
}

function formatPercent(covered, total) {
  if (!total) {
    return "100.0";
  }

  return ((covered / total) * 100).toFixed(1);
}

function percent(covered, total) {
  return total ? (covered / total) * 100 : 100;
}

function main() {
  const testResult = spawnSync(process.execPath, [
    "--test",
    "--test-concurrency=1",
    ...listTestFiles()
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_V8_COVERAGE: coverageDir
    },
    stdio: "inherit"
  });

  if (testResult.status !== 0) {
    process.exit(testResult.status || 1);
  }

  const coverageFiles = fs.readdirSync(coverageDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => path.join(coverageDir, fileName));
  const scriptCoverages = new Map();

  for (const coverageFile of coverageFiles) {
    const payload = JSON.parse(fs.readFileSync(coverageFile, "utf8"));
    for (const scriptCoverage of payload.result || []) {
      if (!scriptCoverage.url || scriptCoverage.url.startsWith("node:")) {
        continue;
      }

      scriptCoverages.set(normalizeCoverageUrl(scriptCoverage.url), scriptCoverage);
    }
  }

  const summaries = targetFiles.map((fileName) => {
    const scriptCoverage = scriptCoverages.get(fileName);
    if (!scriptCoverage) {
      throw new Error(`No V8 coverage found for ${path.relative(repoRoot, fileName)}`);
    }

    return collectFileCoverage(fileName, scriptCoverage);
  });
  const totals = summaries.reduce((accumulator, summary) => ({
    coveredFunctions: accumulator.coveredFunctions + summary.coveredFunctions,
    coveredLines: accumulator.coveredLines + summary.coveredLines,
    functions: accumulator.functions + summary.functions,
    lines: accumulator.lines + summary.lines
  }), {
    coveredFunctions: 0,
    coveredLines: 0,
    functions: 0,
    lines: 0
  });
  const failures = [];

  process.stdout.write("\nHigh-risk service coverage\n");
  process.stdout.write("file | lines | functions\n");
  process.stdout.write("--- | ---: | ---:\n");
  for (const summary of summaries) {
    const relativeFile = path.relative(repoRoot, summary.fileName);
    const lineCoverage = percent(summary.coveredLines, summary.lines);
    const functionCoverage = percent(summary.coveredFunctions, summary.functions);
    process.stdout.write(`${relativeFile} | ${formatPercent(summary.coveredLines, summary.lines)}% | ${formatPercent(summary.coveredFunctions, summary.functions)}%\n`);

    if (lineCoverage < thresholds.perFileLines) {
      failures.push(`${relativeFile} line coverage ${lineCoverage.toFixed(1)}% < ${thresholds.perFileLines}%`);
    }
    if (functionCoverage < thresholds.perFileFunctions) {
      failures.push(`${relativeFile} function coverage ${functionCoverage.toFixed(1)}% < ${thresholds.perFileFunctions}%`);
    }
  }

  const overallLineCoverage = percent(totals.coveredLines, totals.lines);
  const overallFunctionCoverage = percent(totals.coveredFunctions, totals.functions);
  process.stdout.write(`overall | ${formatPercent(totals.coveredLines, totals.lines)}% | ${formatPercent(totals.coveredFunctions, totals.functions)}%\n`);

  if (overallLineCoverage < thresholds.overallLines) {
    failures.push(`overall line coverage ${overallLineCoverage.toFixed(1)}% < ${thresholds.overallLines}%`);
  }
  if (overallFunctionCoverage < thresholds.overallFunctions) {
    failures.push(`overall function coverage ${overallFunctionCoverage.toFixed(1)}% < ${thresholds.overallFunctions}%`);
  }

  fs.rmSync(coverageDir, { recursive: true, force: true });

  if (failures.length) {
    process.stderr.write(`\nCoverage gate failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  fs.rmSync(coverageDir, { recursive: true, force: true });
  throw error;
}
