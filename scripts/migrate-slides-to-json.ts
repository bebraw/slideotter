#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { extractSlideSpec } = require("../studio/server/services/slide-specs/index.ts");

function printHelp() {
  process.stdout.write([
    "Usage: npm run slides:migrate:json -- [files...] [--force] [--delete-js] [--out-dir <dir>]",
    "",
    "Converts legacy slide CommonJS files into slide-spec JSON files for the supported slide families:",
    "cover, toc, content, and summary.",
    "",
    "Examples:",
    "  npm run slides:migrate:json -- slides/slide-02.js",
    "  npm run slides:migrate:json -- slides/slide-01.js slides/slide-02.js --out-dir migrated-slides",
    "  npm run slides:migrate:json -- slides/slide-03.js --force --delete-js"
  ].join("\n") + "\n");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function compareNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function resolveDefaultInputs() {
  const slidesDir = path.join(process.cwd(), "slides");
  if (!fs.existsSync(slidesDir)) {
    return [];
  }

  return fs.readdirSync(slidesDir)
    .filter((fileName) => /^slide-\d+\.js$/.test(fileName))
    .sort(compareNames)
    .map((fileName) => path.join(slidesDir, fileName));
}

function parseArgs(argv) {
  const options = {
    deleteJs: false,
    files: [],
    force: false,
    outDir: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }

    if (value === "--force") {
      options.force = true;
      continue;
    }

    if (value === "--delete-js") {
      options.deleteJs = true;
      continue;
    }

    if (value === "--out-dir") {
      index += 1;
      if (index >= argv.length) {
        fail("Missing value after --out-dir");
      }
      options.outDir = path.resolve(argv[index]);
      continue;
    }

    if (value.startsWith("-")) {
      fail(`Unknown option: ${value}`);
    }

    options.files.push(path.resolve(value));
  }

  if (!options.files.length) {
    options.files = resolveDefaultInputs();
  }

  if (!options.files.length) {
    fail("No slide JS files found. Pass one or more files explicitly.");
  }

  return options;
}

function assertLegacySlideFile(fileName) {
  if (!fs.existsSync(fileName) || !fs.statSync(fileName).isFile()) {
    fail(`File not found: ${fileName}`);
  }

  if (path.extname(fileName) !== ".js") {
    fail(`Expected a .js slide file: ${fileName}`);
  }
}

function toJsonFileName(fileName, outDir) {
  const nextBase = `${path.basename(fileName, ".js")}.json`;
  return outDir ? path.join(outDir, nextBase) : path.join(path.dirname(fileName), nextBase);
}

function migrateOne(fileName, options) {
  assertLegacySlideFile(fileName);
  const source = fs.readFileSync(fileName, "utf8");
  const slideSpec = extractSlideSpec(source);
  const outputFile = toJsonFileName(fileName, options.outDir);

  if (!options.force && fs.existsSync(outputFile)) {
    fail(`Refusing to overwrite existing file without --force: ${outputFile}`);
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(slideSpec, null, 2)}\n`, "utf8");

  if (options.deleteJs) {
    fs.unlinkSync(fileName);
  }

  return {
    outputFile,
    slideSpec,
    sourceFile: fileName
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = options.files.map((fileName) => migrateOne(fileName, options));

  results.forEach((result) => {
    process.stdout.write([
      `Converted ${path.relative(process.cwd(), result.sourceFile)} -> ${path.relative(process.cwd(), result.outputFile)}`,
      `  type: ${result.slideSpec.type}`,
      `  title: ${result.slideSpec.title}`
    ].join("\n") + "\n");
  });

  process.stdout.write(`Migrated ${results.length} slide file${results.length === 1 ? "" : "s"}.\n`);
}

main();
