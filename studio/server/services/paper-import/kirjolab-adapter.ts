import {
  convertLatexProject,
  createLatexPreviewIdentity,
  createPdfTextExtractor,
  digestLatexPreviewIdentity,
  inspectLatexArchive,
  latexArchiveMaximumCompressedBytes,
  latexArchiveMaximumEntries,
  latexArchiveMaximumExpandedBytes,
  latexArchiveMaximumStructuralRecords,
  latexArchiveMaximumTextBytes,
  latexConversionMaximumSemanticRecords,
  latexConversionSchemaVersion,
  latexConverterVersion,
  type LatexArchiveInspection,
  type LatexArchiveLimits,
  type LatexConversionDiagnostic,
  type LatexConversionOptions,
  type LatexConversionSelection,
  type LatexPreviewIdentityV1,
  type LatexProjectConversion,
  type LatexProseBlockInventory,
  type PdfTextExtractionLimits,
  type PdfTextExtractionV1,
  type PdfTextRuntime
} from "@kirjolab/paper-import";

const kirjolabPaperImportRelease = Object.freeze({
  assetBytes: 56290,
  assetSha256: "87ade7ecc1411bb1019c54b7f728f4b0c5382fd4dc5510eb411a2a503e56566a",
  converterVersion: "latex-converter-v6",
  conversionSchemaVersion: 2,
  mergeCommit: "d4d1f0c9",
  packageName: "@kirjolab/paper-import",
  packageVersion: "0.1.3",
  releaseUrl: "https://github.com/bebraw/kirjolab/releases/download/paper-import-v0.1.3/kirjolab-paper-import-0.1.3.tgz",
  tagCommit: "02f64c94c481696566397fb70d235bf92266c9c9"
} as const);

const paperLatexArchiveLimits: Required<LatexArchiveLimits> = Object.freeze({
  maximumCompressedBytes: latexArchiveMaximumCompressedBytes,
  maximumEntries: latexArchiveMaximumEntries,
  maximumExpandedBytes: latexArchiveMaximumExpandedBytes,
  maximumStructuralRecords: latexArchiveMaximumStructuralRecords,
  maximumTextBytes: latexArchiveMaximumTextBytes
});

const paperLatexConversionOptions: Required<LatexConversionOptions> = Object.freeze({
  maximumSemanticRecords: latexConversionMaximumSemanticRecords
});

const paperPdfTextLimits: PdfTextExtractionLimits = Object.freeze({
  maximumDocumentTextCodeUnits: 4_000_000,
  maximumInputBytes: 25 * 1024 * 1024,
  maximumPages: 200,
  maximumPageTextCodeUnits: 100_000
});

type QuarantinedLatexProseBlock = {
  block: LatexProseBlockInventory;
  diagnostics: readonly LatexConversionDiagnostic[];
};

type LatexProseGate = {
  eligibleBlocks: readonly LatexProseBlockInventory[];
  quarantinedBlocks: readonly QuarantinedLatexProseBlock[];
  status: "ready" | "partial" | "quarantined";
  unmatchedDiagnostics: readonly LatexConversionDiagnostic[];
};

type LatexReviewConversion = Omit<LatexProjectConversion, "files" | "proseBlocks">;

type LatexAdapterResult = {
  conversion: LatexReviewConversion;
  identity: LatexPreviewIdentityV1;
  inspection: LatexArchiveInspection;
  previewDigest: string;
  prose: LatexProseGate;
};

type InspectLatexInput = {
  archive: Uint8Array;
  selection: LatexConversionSelection;
};

type PaperImportAdapter = {
  extractPdfText(bytes: Uint8Array): Promise<PdfTextExtractionV1>;
  inspectLatex(input: InspectLatexInput): Promise<LatexAdapterResult>;
};

function diagnosticOverlapsBlock(
  diagnostic: LatexConversionDiagnostic,
  block: LatexProseBlockInventory
): boolean {
  const range = diagnostic.range;
  if (!range || range.path !== block.range.path || diagnostic.sourcePath !== block.range.path) {
    return false;
  }

  if (range.start === range.end) {
    return block.range.start <= range.start && range.start <= block.range.end;
  }

  return range.start < block.range.end && block.range.start < range.end;
}

function uniqueDiagnostics(
  diagnostics: readonly LatexConversionDiagnostic[]
): readonly LatexConversionDiagnostic[] {
  return [...new Set(diagnostics)];
}

function gateLatexProse(conversion: LatexProjectConversion): LatexProseGate {
  const provenanceDiagnostics = conversion.diagnostics.filter(
    (diagnostic) => diagnostic.code === "prose-provenance-unavailable"
  );
  const matchedDiagnostics = new Set<LatexConversionDiagnostic>();
  const blockDiagnostics = conversion.proseBlocks.map((block) => {
    const diagnostics = provenanceDiagnostics.filter((diagnostic) => {
      const matches = diagnosticOverlapsBlock(diagnostic, block);
      if (matches) {
        matchedDiagnostics.add(diagnostic);
      }
      return matches;
    });

    return { block, diagnostics };
  });
  const unmatchedDiagnostics = provenanceDiagnostics.filter(
    (diagnostic) => !matchedDiagnostics.has(diagnostic)
  );
  const quarantineAll = unmatchedDiagnostics.length > 0;
  const quarantinedBlocks = blockDiagnostics
    .filter(({ diagnostics }) => quarantineAll || diagnostics.length > 0)
    .map(({ block, diagnostics }) => ({
      block,
      diagnostics: uniqueDiagnostics([...diagnostics, ...(quarantineAll ? unmatchedDiagnostics : [])])
    }));
  const quarantinedBlockIds = new Set(quarantinedBlocks.map(({ block }) => block.id));
  const eligibleBlocks = conversion.proseBlocks.filter(
    (block) => !quarantinedBlockIds.has(block.id)
  );

  return {
    eligibleBlocks,
    quarantinedBlocks,
    status: quarantineAll
      ? "quarantined"
      : quarantinedBlocks.length === 0
      ? "ready"
      : eligibleBlocks.length === 0
        ? "quarantined"
        : "partial",
    unmatchedDiagnostics
  };
}

function createPaperImportAdapter(pdfRuntime: PdfTextRuntime): PaperImportAdapter {
  const extractPdfText = createPdfTextExtractor(pdfRuntime);

  return {
    extractPdfText(bytes) {
      return extractPdfText(bytes, paperPdfTextLimits);
    },
    async inspectLatex(input) {
      const ownedArchive = Uint8Array.from(input.archive);
      const inspection = await inspectLatexArchive(ownedArchive, paperLatexArchiveLimits);
      const conversion = convertLatexProject(
        inspection,
        input.selection,
        paperLatexConversionOptions
      );
      const identity = createLatexPreviewIdentity({
        archive: ownedArchive,
        conversion,
        files: inspection.files
      });
      const {
        files: _renderedFiles,
        proseBlocks: _ungatedProseBlocks,
        ...reviewConversion
      } = conversion;

      return {
        conversion: reviewConversion,
        identity,
        inspection,
        previewDigest: digestLatexPreviewIdentity(identity),
        prose: gateLatexProse(conversion)
      };
    }
  };
}

if (
  latexConversionSchemaVersion !== kirjolabPaperImportRelease.conversionSchemaVersion
  || latexConverterVersion !== kirjolabPaperImportRelease.converterVersion
) {
  throw new Error("Installed Kirjolab paper-import contract does not match the reviewed release");
}

export {
  createPaperImportAdapter,
  kirjolabPaperImportRelease,
  paperLatexArchiveLimits,
  paperLatexConversionOptions,
  paperPdfTextLimits
};

export type {
  InspectLatexInput,
  LatexAdapterResult,
  LatexProseGate,
  LatexReviewConversion,
  PaperImportAdapter,
  QuarantinedLatexProseBlock
};
