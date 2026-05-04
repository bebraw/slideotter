import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { assert } = require("../fixture-helpers.ts");

type ClientTypeScriptSource = {
  filePath: string;
  source: string;
};

function readClientTypeScriptSources(): ClientTypeScriptSource[] {
  const rootDir = path.join(process.cwd(), "studio/client");
  const sources: ClientTypeScriptSource[] = [];

  function visit(directoryPath: string) {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (entry.name.endsWith(".ts")) {
        sources.push({
          filePath: path.relative(process.cwd(), entryPath),
          source: fs.readFileSync(entryPath, "utf8")
        });
      }
    }
  }

  visit(rootDir);
  return sources;
}

export function validateClientRenderingHygiene(): void {
  const slideDomSource = fs.readFileSync(path.join(process.cwd(), "studio/rendering/slide-dom.ts"), "utf8");
  const renderingDocumentsSource = fs.readFileSync(path.join(process.cwd(), "studio/rendering/documents.ts"), "utf8");
  const allowedClientInnerHtmlSites = [
    {
      filePath: "studio/client/editor/custom-visual-model.ts",
      pattern: /preview\.innerHTML = content \|\| ""/
    },
    {
      filePath: "studio/client/preview/slide-preview.ts",
      pattern: /stage\.innerHTML = renderer\.renderSlideMarkup\(slideSpec, renderOptions\)/
    }
  ];

  const clientInnerHtmlSites = readClientTypeScriptSources()
    .flatMap(({ filePath, source }) => Array.from(source.matchAll(/\binnerHTML\b/g)).map((match) => ({
      filePath,
      index: match.index || 0,
      source
    })));
  const unexpectedInnerHtmlSites = clientInnerHtmlSites.filter((site) => {
    return !allowedClientInnerHtmlSites.some((allowed) => allowed.filePath === site.filePath && allowed.pattern.test(site.source));
  });
  assert(
    unexpectedInnerHtmlSites.length === 0,
    `Client innerHTML should stay limited to trusted renderer/custom-SVG boundaries: ${unexpectedInnerHtmlSites.map((site) => site.filePath).join(", ")}`
  );
  assert(
    allowedClientInnerHtmlSites.every((allowed) => allowed.pattern.test(fs.readFileSync(path.join(process.cwd(), allowed.filePath), "utf8"))),
    "Trusted client innerHTML boundaries should remain explicit and reviewable"
  );

  const clientRenderingBoundaryViolations = readClientTypeScriptSources()
    .filter(({ source }) => /rendering\/(?:documents|presentation-script)\.ts/.test(source))
    .map(({ filePath }) => filePath);

  assert(
    clientRenderingBoundaryViolations.length === 0
      && /export function renderSlideMarkup/.test(slideDomSource)
      && /export \{ normalizeTheme \} from "\.\/theme\.ts";/.test(slideDomSource)
      && !/render(?:Deck|Slide|Presentation)Document/.test(slideDomSource)
      && !/renderDeckMarkup/.test(slideDomSource)
      && !/presentation-script\.ts/.test(slideDomSource)
      && /export function renderPresentationDocument/.test(renderingDocumentsSource)
      && /renderPresentationScript/.test(renderingDocumentsSource),
    `Client rendering split point should not ship server-only document rendering: ${clientRenderingBoundaryViolations.join(", ")}`
  );
}
