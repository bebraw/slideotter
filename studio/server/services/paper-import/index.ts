import { createPaperImportAdapter } from "./kirjolab-adapter.ts";
import { pdfJsTextRuntime } from "./pdfjs-runtime.ts";

const localPaperImportAdapter = createPaperImportAdapter(pdfJsTextRuntime);

export {
  localPaperImportAdapter
};

export {
  createPaperImportAdapter,
  kirjolabPaperImportRelease,
  paperLatexArchiveLimits,
  paperLatexConversionOptions,
  paperPdfTextLimits
} from "./kirjolab-adapter.ts";

export type {
  InspectLatexInput,
  LatexAdapterResult,
  LatexProseGate,
  LatexReviewConversion,
  PaperImportAdapter,
  QuarantinedLatexProseBlock
} from "./kirjolab-adapter.ts";
