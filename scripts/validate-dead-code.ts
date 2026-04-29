const ts = require("typescript");
const path = require("path");

function findNodeAt(sourceFile, position) {
  function visit(node) {
    if (position < node.getFullStart() || position >= node.getEnd()) {
      return null;
    }

    return ts.forEachChild(node, visit) || node;
  }

  return visit(sourceFile);
}

function findDeclaration(node) {
  let current = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) {
      return current;
    }
    if (
      ts.isVariableDeclaration(current)
      && current.initializer
      && (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))
    ) {
      return current;
    }
    if (ts.isVariableDeclaration(current) || ts.isParameter(current)) {
      return null;
    }
    current = current.parent;
  }
  return null;
}

function getDeclarationName(declaration) {
  if (!declaration || !declaration.name) {
    return "";
  }
  return declaration.name.getText();
}

const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
  throw new Error("Could not find tsconfig.json");
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n");
  throw new Error(message);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath),
  {
    noUnusedLocals: true,
    noUnusedParameters: false
  }
);

const program = ts.createProgram({
  options: parsedConfig.options,
  rootNames: parsedConfig.fileNames.filter((fileName) => (
    path.relative(process.cwd(), fileName).startsWith(`studio${path.sep}client${path.sep}`)
  ))
});

const failures = [];
for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
  if (diagnostic.code !== 6133 || !diagnostic.file || typeof diagnostic.start !== "number") {
    continue;
  }

  const node = findNodeAt(diagnostic.file, diagnostic.start);
  const declaration = findDeclaration(node);
  const name = getDeclarationName(declaration);
  if (!declaration || !name || name.startsWith("StudioClient")) {
    continue;
  }

  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  failures.push({
    fileName: path.relative(process.cwd(), diagnostic.file.fileName),
    line: position.line + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  });
}

if (failures.length) {
  const details = failures
    .sort((left, right) => left.fileName.localeCompare(right.fileName) || left.line - right.line)
    .map((failure) => `${failure.fileName}:${failure.line}: ${failure.message}`)
    .join("\n");
  throw new Error(`Unused browser-client function declarations found:\n${details}`);
}

console.log("Dead-code validation passed.");
