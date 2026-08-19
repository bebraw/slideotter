import assert from "node:assert/strict";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import test from "node:test";
import {
  LatexArchiveFailure,
  PdfTextExtractionFailure,
  latexArchiveMaximumCompressedBytes,
  latexArchiveMaximumEntries,
  latexArchiveMaximumExpandedBytes,
  latexArchiveMaximumStructuralRecords,
  latexArchiveMaximumTextBytes,
  latexConversionMaximumSemanticRecords,
  latexConversionSchemaVersion,
  latexConverterVersion,
  latexRenderedFormat
} from "@kirjolab/paper-import";
import { createPaperImportConformanceCorpusV2 } from "@kirjolab/paper-import/conformance";
import {
  kirjolabPaperImportRelease,
  localPaperImportAdapter,
  paperLatexArchiveLimits,
  paperLatexConversionOptions,
  paperPdfTextLimits
} from "../studio/server/services/paper-import/index.ts";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "..");
const conformance = createPaperImportConformanceCorpusV2();
const noindentIncludeRegressionArchive = Buffer.from(
  "UEsDBBQAAAAAACptE113nuHkbAAAAGwAAAAIAAAAbWFpbi50ZXhcZG9jdW1lbnRjbGFzc3thcnRpY2xlfQpcYmVnaW57ZG9jdW1lbnR9ClNhZmUgZXZpZGVuY2UuCgpcbm9pbmRlbnR7TGVhZCBcaW5wdXR7Y2hpbGR9IHRhaWwufQpcZW5ke2RvY3VtZW50fQpQSwMEFAAAAAAAKm0TXYkL/IsQAAAAEAAAAAkAAABjaGlsZC50ZXhDaGlsZCBldmlkZW5jZS4KUEsBAhQAFAAAAAAAKm0TXXee4eRsAAAAbAAAAAgAAAAAAAAAAAAAAAAAAAAAAG1haW4udGV4UEsBAhQAFAAAAAAAKm0TXYkL/IsQAAAAEAAAAAkAAAAAAAAAAAAAAAAAkgAAAGNoaWxkLnRleFBLBQYAAAAAAgACAG0AAADJAAAAAAA=",
  "base64"
);
const sectionIncludeRegressionArchive = Buffer.from(
  "UEsDBBQAAAAAADtvE12ckWoDUAAAAFAAAAAIAAAAbWFpbi50ZXhcZG9jdW1lbnRjbGFzc3thcnRpY2xlfQpcYmVnaW57ZG9jdW1lbnR9ClxzZWN0aW9ue1xpbnB1dHtjaGlsZH19ClxlbmR7ZG9jdW1lbnR9ClBLAwQUAAAAAAA7bxNdiQv8ixAAAAAQAAAACQAAAGNoaWxkLnRleENoaWxkIGV2aWRlbmNlLgpQSwECFAAUAAAAAAA7bxNdnJFqA1AAAABQAAAACAAAAAAAAAAAAAAAAAAAAAAAbWFpbi50ZXhQSwECFAAUAAAAAAA7bxNdiQv8ixAAAAAQAAAACQAAAAAAAAAAAAAAAAB2AAAAY2hpbGQudGV4UEsFBgAAAAACAAIAbQAAAK0AAAAAAA==",
  "base64"
);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readJsonRecord(fileName: string): Record<string, unknown> {
  return asRecord(JSON.parse(fs.readFileSync(fileName, "utf8")));
}

test("pins the reviewed immutable Kirjolab package boundary", async () => {
  const packageEntry = require.resolve("@kirjolab/paper-import");
  const installedPackage = readJsonRecord(path.resolve(path.dirname(packageEntry), "..", "package.json"));
  const rootPackage = readJsonRecord(path.join(repoRoot, "package.json"));
  const rootDependencies = asRecord(rootPackage.dependencies);
  const rootEngines = asRecord(rootPackage.engines);
  const packageLock = readJsonRecord(path.join(repoRoot, "package-lock.json"));
  const lockedPackages = asRecord(packageLock.packages);
  const lockedImport = asRecord(lockedPackages["node_modules/@kirjolab/paper-import"]);
  const productionSource = [
    "index.ts",
    "kirjolab-adapter.ts",
    "pdfjs-runtime.ts"
  ].map((fileName) => fs.readFileSync(
    path.join(repoRoot, "studio", "server", "services", "paper-import", fileName),
    "utf8"
  )).join("\n");
  const productionModule = await import("@kirjolab/paper-import");
  const installedDependencies = asRecord(installedPackage.dependencies);
  const installedEngines = asRecord(installedPackage.engines);

  assert.equal(installedPackage.version, kirjolabPaperImportRelease.packageVersion);
  assert.equal(installedPackage.license, "MIT");
  assert.equal(installedDependencies.fflate, "0.8.3");
  assert.equal(installedEngines.node, "24.15.0");
  assert.equal(rootEngines.node, "24.15.0");
  assert.equal(rootEngines.npm, "11.12.1");
  assert.equal(rootDependencies["@kirjolab/paper-import"], kirjolabPaperImportRelease.releaseUrl);
  assert.equal(lockedImport.resolved, kirjolabPaperImportRelease.releaseUrl);
  assert.equal(
    lockedImport.integrity,
    "sha512-cAJyN1JXt0LbzIk5FdjFH7rtzmadHEsZRdV2lPR5mfK0BrdJrjyIRfRLvxnVbvIX7V+erCxa/KJT2q1zpX0cZA=="
  );
  assert.equal(latexConversionSchemaVersion, kirjolabPaperImportRelease.conversionSchemaVersion);
  assert.equal(latexConverterVersion, kirjolabPaperImportRelease.converterVersion);
  assert.equal("createPaperImportConformanceCorpusV2" in productionModule, false);
  assert.doesNotMatch(productionSource, /@kirjolab\/paper-import\/conformance/);
  assert.deepEqual(paperLatexArchiveLimits, {
    maximumCompressedBytes: latexArchiveMaximumCompressedBytes,
    maximumEntries: latexArchiveMaximumEntries,
    maximumExpandedBytes: latexArchiveMaximumExpandedBytes,
    maximumStructuralRecords: latexArchiveMaximumStructuralRecords,
    maximumTextBytes: latexArchiveMaximumTextBytes
  });
  assert.deepEqual(paperLatexConversionOptions, {
    maximumSemanticRecords: latexConversionMaximumSemanticRecords
  });
  assert.deepEqual(paperPdfTextLimits, {
    maximumDocumentTextCodeUnits: 4_000_000,
    maximumInputBytes: 25 * 1024 * 1024,
    maximumPages: 200,
    maximumPageTextCodeUnits: 100_000
  });
  assert.ok(Object.isFrozen(paperLatexArchiveLimits));
  assert.ok(Object.isFrozen(paperLatexConversionOptions));
  assert.ok(Object.isFrozen(paperPdfTextLimits));
});

test("runs the reviewed LaTeX corpus through one inspect-convert-identity pipeline", async () => {
  const fixture = conformance.latex.reviewedPaper;
  const result = await localPaperImportAdapter.inspectLatex({
    archive: fixture.archive,
    selection: fixture.selection
  });

  assert.equal(result.identity.archiveSha256, fixture.expected.archiveSha256);
  assert.equal(
    result.identity.archiveManifestSha256,
    fixture.expected.identity.archiveManifestSha256
  );
  assert.equal(
    result.identity.conversionManifestSha256,
    fixture.expected.identity.conversionManifestSha256
  );
  assert.equal(result.previewDigest, fixture.expected.identity.previewDigest);
  assert.equal(result.prose.status, "ready");
  assert.deepEqual(
    result.prose.eligibleBlocks.map((block) => block.text),
    fixture.expected.conversion.proseBlocks.map((block) => block.text)
  );
  assert.deepEqual(result.prose.quarantinedBlocks, []);
  assert.deepEqual(
    result.conversion.figures.map((figure) => ({
      archivePath: figure.archivePath,
      caption: figure.caption?.value,
      contentHash: figure.contentHash,
      label: figure.label?.value,
      mediaType: figure.mediaType,
      referenceRange: figure.referenceRange
    })),
    fixture.expected.conversion.figures.map((figure) => ({
      archivePath: figure.archivePath,
      caption: figure.caption,
      contentHash: figure.contentHash,
      label: figure.label,
      mediaType: figure.mediaType,
      referenceRange: figure.referenceRange
    }))
  );

  for (const block of result.prose.eligibleBlocks) {
    const source = fixture.sourceByPath[block.range.path];
    assert.ok(source !== undefined);
    assert.equal(source.slice(block.range.start, block.range.end), block.source);
    assert.ok(result.conversion.sourceFingerprints.some(
      (fingerprint) => fingerprint.path === block.range.path && fingerprint.sha256.length === 64
    ));
  }

  assert.equal(latexRenderedFormat, "scholarmark-v1");
  assert.equal("files" in result.conversion, false);
  assert.equal("proseBlocks" in result.conversion, false);
});

test("matches the remaining public LaTeX conformance-v2 fixtures", async () => {
  const graphResults = [];
  for (const fixture of [
    conformance.latex.includeGraph.canonical,
    conformance.latex.includeGraph.reordered
  ]) {
    const result = await localPaperImportAdapter.inspectLatex({
      archive: fixture.archive,
      selection: fixture.selection
    });
    assert.deepEqual(result.inspection.files.map((file) => ({
      bytes: file.bytes.byteLength,
      kind: file.kind,
      path: file.path
    })), fixture.expected.inspection.manifest);
    assert.deepEqual(result.inspection.diagnostics, fixture.expected.inspection.diagnostics);
    assert.deepEqual(result.conversion.diagnostics, fixture.expected.conversion.diagnostics);
    assert.deepEqual(
      result.conversion.sourceFingerprints,
      fixture.expected.conversion.sourceFingerprints
    );
    graphResults.push({
      diagnostics: result.conversion.diagnostics,
      fingerprints: result.conversion.sourceFingerprints
    });
  }
  assert.deepEqual(graphResults[0], graphResults[1]);

  const ambiguousFixture = conformance.latex.ambiguousFigure;
  const ambiguousResult = await localPaperImportAdapter.inspectLatex({
    archive: ambiguousFixture.archive,
    selection: ambiguousFixture.selection
  });
  assert.deepEqual(ambiguousResult.conversion.figures.map((figure) => ({
    archivePath: figure.archivePath,
    contentHash: figure.contentHash,
    mediaType: figure.mediaType,
    referenceRange: figure.referenceRange,
    requestedPath: figure.requestedPath,
    resolutionDiagnostics: figure.resolutionDiagnostics,
    resolvedAssetPath: figure.resolvedAssetPath,
    source: figure.source
  })), ambiguousFixture.expected.figures);
  assert.deepEqual(ambiguousResult.conversion.diagnostics, ambiguousFixture.expected.diagnostics);

  const escapedFixture = conformance.latex.escapedCommands;
  const escapedResult = await localPaperImportAdapter.inspectLatex({
    archive: escapedFixture.archive,
    selection: escapedFixture.selection
  });
  assert.equal(escapedResult.identity.archiveSha256, escapedFixture.expected.archiveSha256);
  assert.deepEqual(escapedResult.conversion.citations.map((citation) => ({
    keys: citation.keys,
    range: citation.range,
    source: citation.source
  })), escapedFixture.expected.citations);
  assert.deepEqual(escapedResult.conversion.sections.map((section) => ({
    range: section.range,
    source: section.source,
    title: section.title
  })), escapedFixture.expected.sections);
  assert.deepEqual(escapedResult.conversion.equations.map((equation) => ({
    range: equation.range,
    source: equation.source,
    value: equation.value
  })), escapedFixture.expected.equations);

  const proseFixture = conformance.latex.proseBlocks;
  const proseResult = await localPaperImportAdapter.inspectLatex({
    archive: proseFixture.archive,
    selection: proseFixture.selection
  });
  assert.equal(proseResult.identity.archiveSha256, proseFixture.expected.archiveSha256);
  assert.deepEqual(proseResult.conversion.sections, proseFixture.expected.sections);
  assert.deepEqual([
    ...proseResult.prose.eligibleBlocks,
    ...proseResult.prose.quarantinedBlocks.map(({ block }) => block)
  ].sort((left, right) => left.id.localeCompare(right.id)), [
    ...proseFixture.expected.blocks
  ].sort((left, right) => left.id.localeCompare(right.id)));
  assert.deepEqual(
    proseResult.conversion.diagnostics.filter(
      (diagnostic) => diagnostic.code === "prose-provenance-unavailable"
    ),
    proseFixture.expected.provenanceDiagnostics
  );
  assert.deepEqual({
    codeBlocks: proseResult.conversion.codeBlocks.map((block) => ({
      environment: block.environment,
      value: block.value
    })),
    equations: proseResult.conversion.equations.map((equation) => equation.value),
    figures: proseResult.conversion.figures.map((figure) => ({
      archivePath: figure.archivePath,
      caption: figure.caption?.value,
      requestedPath: figure.requestedPath
    })),
    tables: proseResult.conversion.tables.map((table) => table.environment)
  }, proseFixture.expected.excludedEnvironmentInventories);
});

test("quarantines provenance-affected prose instead of repairing TeX downstream", async () => {
  const result = await localPaperImportAdapter.inspectLatex({
    archive: noindentIncludeRegressionArchive,
    selection: { rootPath: "main.tex" }
  });

  assert.equal(result.prose.status, "partial");
  assert.deepEqual(result.prose.eligibleBlocks.map((block) => block.text), ["Safe evidence."]);
  assert.equal(result.prose.quarantinedBlocks.length, 1);
  const quarantined = result.prose.quarantinedBlocks[0];
  assert.ok(quarantined);
  assert.equal(quarantined.block.source, "\\noindent{Lead \\input{child} tail.}");
  assert.equal(quarantined.block.text, "\\noindent{Lead tail.}");
  assert.deepEqual(quarantined.diagnostics.map((diagnostic) => diagnostic.code), [
    "prose-provenance-unavailable"
  ]);
  assert.deepEqual(quarantined.diagnostics[0]?.range, {
    end: 85,
    path: "main.tex",
    start: 72,
    unit: "utf16-code-unit"
  });
  const reviewedBlocks = [
    ...result.prose.eligibleBlocks,
    ...result.prose.quarantinedBlocks.map(({ block }) => block)
  ];
  assert.equal(reviewedBlocks.some((block) => block.range.path === "child.tex"), false);
  assert.equal(result.prose.eligibleBlocks.some((block) => block.source.includes("\\input{child}")), false);
});

test("reports unmatched provenance as quarantined even when no prose block exists", async () => {
  const result = await localPaperImportAdapter.inspectLatex({
    archive: sectionIncludeRegressionArchive,
    selection: { rootPath: "main.tex" }
  });

  assert.equal(result.prose.status, "quarantined");
  assert.deepEqual(result.prose.eligibleBlocks, []);
  assert.deepEqual(result.prose.quarantinedBlocks, []);
  assert.equal(result.prose.unmatchedDiagnostics.length, 1);
  assert.equal(result.prose.unmatchedDiagnostics[0]?.code, "prose-provenance-unavailable");
});

test("fails closed when provenance diagnostics cannot be associated with one block", async () => {
  const fixture = conformance.latex.structuralContainment;
  const result = await localPaperImportAdapter.inspectLatex({
    archive: fixture.archive,
    selection: fixture.selection
  });

  assert.equal(result.prose.status, "quarantined");
  assert.deepEqual(result.prose.eligibleBlocks, []);
  assert.equal(result.prose.quarantinedBlocks.length, fixture.expected.blocks.length);
  assert.deepEqual(result.conversion.sections, fixture.expected.sections);
  assert.deepEqual(
    result.prose.quarantinedBlocks.map(({ block }) => block),
    fixture.expected.blocks
  );
  assert.deepEqual(result.conversion.footnotes, fixture.expected.footnotes);
  assert.deepEqual(
    result.conversion.diagnostics.filter(
      (diagnostic) => diagnostic.code === "prose-provenance-unavailable"
    ),
    fixture.expected.provenanceDiagnostics
  );
  assert.ok(result.prose.unmatchedDiagnostics.length > 0);
  assert.ok(result.prose.unmatchedDiagnostics.every(
    (diagnostic) => diagnostic.code === "prose-provenance-unavailable"
  ));
});

test("preserves bounded archive failure codes through the adapter", async () => {
  for (const fixture of conformance.latex.archiveFailures) {
    await assert.rejects(
      localPaperImportAdapter.inspectLatex({
        archive: fixture.archive,
        selection: { rootPath: "main.tex" }
      }),
      (error: unknown) => {
        assert.ok(error instanceof LatexArchiveFailure);
        assert.equal(error.code, fixture.expected.code);
        return true;
      }
    );
  }
});

test("extracts page-bounded PDF text through the injected Slideotter PDF.js runtime", async () => {
  const fixture = conformance.pdf.twoPageNativeText;
  const result = await localPaperImportAdapter.extractPdfText(fixture.bytes);

  assert.deepEqual(result, fixture.expected);
  await assert.rejects(
    localPaperImportAdapter.extractPdfText(new TextEncoder().encode("not a PDF")),
    (error: unknown) => {
      assert.ok(error instanceof PdfTextExtractionFailure);
      assert.equal(error.code, "pdf-signature");
      return true;
    }
  );
  await assert.rejects(
    localPaperImportAdapter.extractPdfText(
      new Uint8Array(paperPdfTextLimits.maximumInputBytes + 1)
    ),
    (error: unknown) => {
      assert.ok(error instanceof PdfTextExtractionFailure);
      assert.equal(error.code, "pdf-input-size");
      return true;
    }
  );
});
