import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "slides/output", "studio/output"]);
const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isIgnored(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return [...ignoredDirectories].some((ignored) => normalized === ignored || normalized.startsWith(`${ignored}/`));
}

function listMarkdownFiles(directory = repoRoot): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);
    if (isIgnored(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isExternalLink(target: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target);
}

function stripAnchor(target: string): string {
  return target.split("#")[0] || "";
}

function decodeLinkTarget(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function validateMarkdownLinks(fileName: string): string[] {
  const content = fs.readFileSync(fileName, "utf8");
  const issues: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content))) {
    const matchedTarget = match[1];
    if (!matchedTarget) {
      continue;
    }

    const rawTarget = matchedTarget.trim();
    if (!rawTarget || isExternalLink(rawTarget)) {
      continue;
    }

    const withoutAnchor = stripAnchor(rawTarget);
    if (!withoutAnchor) {
      continue;
    }

    const targetPath = path.resolve(path.dirname(fileName), decodeLinkTarget(withoutAnchor));
    if (!fs.existsSync(targetPath)) {
      const line = content.slice(0, match.index).split("\n").length;
      issues.push(`${path.relative(repoRoot, fileName)}:${line} missing ${rawTarget}`);
    }
  }

  return issues;
}

function main() {
  const issues = listMarkdownFiles().flatMap(validateMarkdownLinks);
  if (issues.length) {
    process.stderr.write(`${issues.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Documentation link validation passed.\n");
}

main();
