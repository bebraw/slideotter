const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const outputDir = path.join(__dirname, "output");
const pptxFile = path.join(outputDir, "demo-presentation.pptx");
const pdfFile = path.join(outputDir, "demo-presentation.pdf");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getLibreOfficeCommand() {
  const bundledPath = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  for (const command of ["soffice", "libreoffice"]) {
    const result = run("/usr/bin/which", [command]);
    if (result.status === 0) {
      return command;
    }
  }

  return null;
}

function getKeynotePath() {
  const knownPaths = [
    "/Applications/Keynote.app",
    "/Applications/Keynote Creator Studio.app",
    "/System/Applications/Keynote.app",
    path.join(process.env.HOME || "", "Applications", "Keynote.app"),
    path.join(process.env.HOME || "", "Applications", "Keynote Creator Studio.app")
  ];

  const directPath = knownPaths.find((appPath) => appPath && fs.existsSync(appPath));
  if (directPath) {
    return directPath;
  }

  const result = run("/usr/bin/mdfind", [
    'kMDItemCFBundleIdentifier == "com.apple.Keynote"'
  ]);

  if (result.status !== 0) {
    return null;
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || null;
}

function tryLibreOffice(command) {
  const result = run(command, [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    pptxFile
  ]);

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    fail(`LibreOffice failed to convert PPTX to PDF.\n${details}`);
  }

  return "LibreOffice";
}

function tryKeynote(keynotePath) {
  const keynoteTermsSource = escapeAppleScriptString(keynotePath);
  const scriptLines = [
    "on run argv",
    `using terms from application "${keynoteTermsSource}"`,
    "tell application (item 3 of argv)",
    "activate",
    "set theDocument to open POSIX file (item 1 of argv)",
    "export theDocument to POSIX file (item 2 of argv) as PDF",
    "close theDocument saving no",
    "end tell",
    "end using terms from",
    "end run"
  ];

  const args = [];
  for (const line of scriptLines) {
    args.push("-e", line);
  }
  args.push("--", pptxFile, pdfFile, keynotePath);

  const result = run("/usr/bin/osascript", args);
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    fail(`Keynote failed to convert PPTX to PDF.\n${details}`);
  }

  return "Keynote";
}

function main() {
  if (!fs.existsSync(pptxFile)) {
    fail(`Missing PPTX input: ${pptxFile}\nRun npm run build first.`);
  }

  if (fs.existsSync(pdfFile)) {
    fs.unlinkSync(pdfFile);
  }

  let converter = null;
  const libreOfficeCommand = getLibreOfficeCommand();
  const keynotePath = getKeynotePath();

  if (libreOfficeCommand) {
    converter = tryLibreOffice(libreOfficeCommand);
  } else if (keynotePath) {
    converter = tryKeynote(keynotePath);
  } else {
    fail(
      [
        "No supported PDF converter found.",
        "Install LibreOffice or Keynote to enable PPTX to PDF export on macOS.",
        "Expected output would be written to:",
        pdfFile
      ].join("\n")
    );
  }

  if (!fs.existsSync(pdfFile)) {
    fail(`Conversion reported success with ${converter}, but no PDF was written:\n${pdfFile}`);
  }

  process.stdout.write(`${pdfFile}\n`);
}

main();
