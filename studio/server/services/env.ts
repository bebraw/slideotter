const fs = require("fs");
const path = require("path");
const { getRuntimeConfig } = require("./runtime-config.ts");

const envFileNames = [".env", ".env.local"];
let loaded = false;

type EnvEntry = {
  key: string;
  value: string;
};

function parseQuotedValue(rawValue: string, quote: string): string {
  const value = rawValue.slice(1);
  let escaped = false;
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      if (quote === "\"") {
        switch (char) {
          case "n":
            output += "\n";
            break;
          case "r":
            output += "\r";
            break;
          case "t":
            output += "\t";
            break;
          default:
            output += char || "";
            break;
        }
      } else {
        output += char || "";
      }
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === quote) {
      return output;
    }

    output += char || "";
  }

  return output;
}

function parseValue(rawValue: unknown): string {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("\"") || trimmed.startsWith("'")) {
    return parseQuotedValue(trimmed, trimmed[0] || "");
  }

  const commentIndex = trimmed.search(/\s#/);
  if (commentIndex >= 0) {
    return trimmed.slice(0, commentIndex).trim();
  }

  return trimmed;
}

function parseLine(line: string): EnvEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: parseValue(normalized.slice(separatorIndex + 1))
  };
}

function loadEnvFiles() {
  if (loaded) {
    return;
  }

  loaded = true;
  const initialKeys = new Set(Object.keys(process.env));
  const { envDir } = getRuntimeConfig();

  envFileNames.forEach((fileName) => {
    const filePath = path.join(envDir, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line: string) => {
      const entry = parseLine(line);
      if (!entry || initialKeys.has(entry.key)) {
        return;
      }

      process.env[entry.key] = entry.value;
    });
  });
}

module.exports = {
  loadEnvFiles
};
