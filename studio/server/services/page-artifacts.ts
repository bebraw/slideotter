const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  fs.rmSync(dir, { force: true, recursive: true });
  ensureDir(dir);
}

function listPages(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function createContactSheet(pageFiles, targetPath) {
  const rows = [];
  const tempDir = path.join(path.dirname(targetPath), ".contact-sheet-rows");
  resetDir(tempDir);

  for (let index = 0; index < pageFiles.length; index += 2) {
    const rowPath = path.join(tempDir, `row-${String(index / 2).padStart(2, "0")}.png`);
    const rowResult = run("magick", [
      ...pageFiles.slice(index, index + 2),
      "+append",
      rowPath
    ]);

    if (rowResult.status !== 0) {
      const details = (rowResult.stderr || rowResult.stdout || "").trim();
      throw new Error(`Failed to create contact-sheet row.\n${details}`);
    }

    rows.push(rowPath);
  }

  const sheetResult = run("magick", [
    ...rows,
    "-append",
    targetPath
  ]);

  fs.rmSync(tempDir, { force: true, recursive: true });

  if (sheetResult.status !== 0) {
    const details = (sheetResult.stderr || sheetResult.stdout || "").trim();
    throw new Error(`Failed to create contact sheet.\n${details}`);
  }
}

module.exports = {
  createContactSheet,
  ensureDir,
  listPages,
  resetDir
};
