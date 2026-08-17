# ADR 0064: Reviewed LaTeX And PDF Paper Import

## Status

Proposed implementation plan.

## Context

Slideotter can ground generation in presentation-scoped notes, excerpts, URLs,
and image materials. That is sufficient for short source packs, but it is a
poor intake boundary for a complete academic paper:

- a LaTeX project may contain several source files, BibTeX, figures, labels,
  equations, and include relationships
- a rendered PDF provides page locations and visual truth but loses much of the
  paper's semantic structure
- pasting a complete paper into one source field loses file, section, page, and
  figure provenance and can be truncated before retrieval
- base64 file content inside the existing JSON request boundary would add
  avoidable size overhead and would not support normal paper PDFs reliably
- both LaTeX and PDF are untrusted inputs that require explicit resource,
  execution, path, and prompt-injection boundaries

The staged creation flow also has an important lifecycle boundary. Before the
author approves an outline, there may be no presentation id. Paper artifacts
therefore need draft-scoped review first and presentation-scoped persistence
only after the deck exists.

Kirjolab already contains a bounded, non-executing LaTeX archive inspector and
converter, PDF.js extraction contracts, stable diagnostics, and a digest-bound
preview/confirm workflow. Reusing those pure TypeScript ideas and tests can
avoid rebuilding the riskiest parts of the importer, but Slideotter should not
depend on Kirjolab's Cloudflare Worker, R2, Durable Object, queue, browser, or
writing-workspace layers.

## Decision Direction

Add a reviewed paper-import capability in front of the existing source and
material libraries.

The preferred author input is an Overleaf-style LaTeX ZIP plus the rendered
PDF. The LaTeX archive is the semantic authority for title, abstract, section
structure, labels, equations, citation keys, bibliography, figure paths, and
captions. The rendered PDF is the visual and page-location authority and a text
fallback or consistency check.

Import is a two-stage operation:

1. **Preview** stores or reads bounded draft artifacts, computes fingerprints,
   inspects the archive and PDF without canonical presentation mutation, and
   returns typed structure, figures, locators, and diagnostics for review.
2. **Confirm** revalidates the selected artifacts, fingerprints, root document,
   bibliography, and import options before creating canonical presentation
   sources and materials. Stale or invalid confirmation performs no canonical
   write and cleans up invalid temporary artifacts.

Paper import should extend staged creation and the existing source library. It
must not create a parallel presentation format, renderer, research library, or
automatic one-click slide generator.

## Authority And Representation Rules

- Treat one logical paper as a group of source representations rather than as
  unrelated LaTeX and PDF sources.
- Keep independent SHA-256 fingerprints for the LaTeX archive and rendered PDF.
- Use the LaTeX representation for semantic chunks when it is available and
  sufficiently complete.
- Use the PDF representation for page locators, visual verification, and
  fallback text when semantic source is missing.
- Do not double-weight equivalent LaTeX and PDF text during retrieval.
- Preserve reconciliation warnings when the source title, sections, figures,
  references, or page text appear inconsistent with the rendered PDF.
- Keep imported bytes immutable. Store annotations, extraction results, and
  derived metadata separately.
- Store large source text and raw files outside slide specs and memory records.
  Slides, outline plans, and memory should carry stable pointers instead.

## Import Contract

The exact schema may evolve, but the external and persisted boundary should use
explicit domain types rather than merging paper content into one text field.

```ts
type PaperArtifactKind = "latex-archive" | "rendered-pdf";

interface PaperSourceRange {
  path: string;
  from: number;
  to: number;
  unit: "utf16-code-unit";
  sourceSha256: string;
}

interface PaperArtifact {
  id: string;
  paperId: string;
  kind: PaperArtifactKind;
  filename: string;
  mediaType: string;
  size: number;
  sha256: string;
  createdAt: string;
}

type PaperLocator =
  | {
      kind: "latex";
      range: PaperSourceRange;
      section?: string;
      label?: string;
    }
  | {
      kind: "pdf";
      page: number;
      quote?: string;
      rects?: readonly NormalizedRect[];
    }
  | {
      kind: "figure";
      path: string;
      label?: string;
      caption: string;
      pdfPage?: number;
    };

interface PaperImportPreview {
  schemaVersion: 1;
  paperId: string;
  sourceSha256: string;
  pdfSha256: string;
  rootPath: string;
  bibliographyPath: string | null;
  sourceFiles: readonly string[];
  ignoredFiles: readonly string[];
  sections: readonly PaperSectionPreview[];
  figures: readonly PaperFigureCandidate[];
  diagnostics: readonly PaperImportDiagnostic[];
  previewDigest: string;
}
```

Every extracted chunk should keep a stable chunk id, paper id, representation
id, locator, and extraction version. Legacy sources remain readable through
normalization, but paper-aware generation should receive the richer contract
rather than a lossy compatibility projection.

All LaTeX ranges must refer to the original decoded source file, not a
comment-masked, body-sliced, or progressively rewritten conversion string. The
contract fixes offsets to JavaScript UTF-16 code units. A converter that cannot
map a diagnostic or output back to the original source should omit the range
and report that limitation rather than returning a plausible but incorrect
offset.

Figure candidates should retain their original archive path, resolved output
path, label, caption, reference range, media type, byte size, and SHA-256.
Conversion to a material candidate must not discard the information needed to
trace the figure back to the paper.

## Upload And Storage Boundary

- Upload raw binary bodies or another streaming file representation. Do not put
  base64 file payloads inside the current JSON API.
- Before a presentation exists, keep paper artifacts in ignored, draft-scoped
  user-data storage controlled by the server write boundary.
- After confirmation, move or copy immutable paper artifacts into the active
  presentation's user-data boundary and persist normalized metadata and chunks
  with the presentation's source state.
- Import supported original figure assets through the existing presentation
  material library. Preserve paper id, source path, label, caption, and
  fingerprints as material origin metadata.
- Reject or diagnose figure formats the material library cannot validate. Do
  not silently rasterize, compile, or reinterpret unsupported assets.
- Local app storage, repository-mode storage, and cloud storage may use
  different adapters, but they should expose the same logical artifact,
  preview, diagnostic, and confirmation contracts.

`previewDigest` must bind the complete reviewed interpretation, not only the
uploaded bytes. Compute it over a canonical representation of the source and
PDF fingerprints, selected root, selected bibliography, import options,
converter and schema versions, and conversion manifest. Confirmation with the
same ZIP but a different root, bibliography, option set, or converter version
must be rejected as stale.

## LaTeX Safety Rules

- Never execute or compile TeX.
- Never invoke shell escape, external tools, arbitrary commands, or network
  access while inspecting a paper.
- Resolve `\input`, `\include`, bibliography, and figure references only inside
  the uploaded archive.
- Reject absolute paths, parent traversal, drive-qualified paths, backslash
  ambiguity, case-folded duplicates, symlinks, encrypted entries, unsupported
  compression, malformed central directories, and invalid UTF-8 text.
- Enforce explicit limits for compressed bytes, expanded bytes, entry count,
  individual text files, expansion ratio, and parser work.
- Start from Kirjolab's reviewed limits and diagnostics, but keep the values
  centralized and observable so real paper imports can justify changes.
- Preserve unsupported commands or environments as inert source and typed
  diagnostics. Do not invent meaning for constructs the converter does not
  understand.

## PDF Safety And Extraction Rules

- Validate declared media type and a bounded `%PDF-` signature before canonical
  storage.
- Compute SHA-256 independently of the filesystem, HTTP server, or object-store
  ETag.
- Bound raw bytes, pages, text per page, raster dimensions, execution time, and
  memory use.
- Reject or clearly diagnose encrypted, malformed, unsupported, or no-text
  PDFs.
- Extract page-bounded native text with the existing PDF.js dependency. Keep
  page boundaries before whitespace normalization.
- Treat two-column reading order, ligatures, equations, repeated headers and
  footers, and scanned pages as quality risks surfaced in the preview.
- Keep OCR out of the first slice. A later OCR adapter must be opt-in, disclose
  whether page images leave the local machine, and preserve page provenance.

## Source And Model Safety

Paper text is untrusted data even when the author supplied it.

- Delimit paper excerpts as evidence rather than model instructions.
- Detect, redact, or quarantine instruction-looking source chunks before prompt
  assembly and in user-facing diagnostics.
- Preserve the visible-text quarantine from ADR 0050 for generated output.
- Send only bounded, selected chunks to the configured model provider.
- Explain to authors that selected excerpts from an unpublished paper may be
  sent to that provider. Local-only extraction must not imply local-only
  generation.

## Kirjolab Reuse Boundary

The first implementation should port or adapt Kirjolab's pure TypeScript LaTeX
archive inspector, converter helpers, path normalization, PDF extraction
contracts, and trust-boundary tests from a recorded source revision.

The feasibility review used Kirjolab revision
[`c5a64eb`](https://github.com/bebraw/kirjolab/tree/c5a64eb0e62329d10fe5cdd3220c0979e380a65d),
including its bounded
[`latex-import.ts`](https://github.com/bebraw/kirjolab/blob/c5a64eb0e62329d10fe5cdd3220c0979e380a65d/src/domain/manuscript/latex-import.ts)
and
[`latex-converter.ts`](https://github.com/bebraw/kirjolab/blob/c5a64eb0e62329d10fe5cdd3220c0979e380a65d/src/domain/manuscript/latex-converter.ts).
Implementation should record the exact later revision actually reused.

- Retain the MIT notice for substantial copied code.
- Keep Kirjolab workspace, Cloudflare, Durable Object, R2, queue, browser UI,
  OCR, annotation, and collaboration dependencies outside Slideotter core.
- Adapt the converter's outer result to `PaperImportPreview`, section chunks,
  bibliography records, and figure candidates rather than Kirjolab project
  seeds.
- Correct selection-bound preview hashing, original-source range mapping, and
  figure-origin metadata before treating the reused contract as stable.
- Keep host-specific filesystem, PDF.js, browser, and cloud adapters outside the
  pure inspection and conversion modules.
- Do not make Slideotter runtime depend on a Kirjolab application checkout.
- A neutral shared package may replace the source-local port after both products
  agree on a versioned contract and maintenance/release ownership. Packaging is
  not required to prove the first Slideotter workflow.

## Relationship To Existing ADRs

ADR 0003 remains the authority for presentation materials. Imported paper
figures become ordinary materials with additional provenance rather than a new
media system.

ADR 0004 and ADR 0039 provide draft-scoped staged creation. Paper preview must
fit before outline approval and must not create a presentation folder early.

ADR 0006 provides the user-data and packaged-app write boundary. Immutable raw
paper artifacts belong in user data, not installed application assets.

ADR 0013 provides versioned hypermedia resources and actions. Upload, preview,
confirm, inspect, and remove should become advertised actions with explicit
input contracts and base versions where mutation is possible.

ADR 0017 provides bounded presentation-scoped source grounding. Paper chunks
extend its source model without replacing its retrieval and diagnostics
principles.

ADR 0019 and ADR 0046 provide the hosted storage and provider boundaries. The
local implementation comes first; cloud R2 and job adapters can follow without
changing the logical paper contract.

ADR 0028 requires compact prompt packs. Complete paper text must not become a
default generation payload.

ADR 0044 requires strict typed boundaries and runtime validation for imported
and persisted unknown data.

ADR 0061 provides typed knowledge memory. Paper artifacts remain sources;
authors may later promote reviewed claims or evidence into memory explicitly.

## Implementation Plan

1. Port the bounded LaTeX archive inspector, path helpers, diagnostics, and
   trust-boundary tests from Kirjolab with recorded provenance.
2. Adapt the LaTeX converter to emit neutral paper sections, bibliography
   records, figure candidates, source locators, and a conversion report.
3. Add raw draft-artifact upload with byte limits, safe filenames, signatures,
   SHA-256 fingerprints, cleanup, and typed metadata.
4. Add local PDF.js page-text extraction and diagnostic reporting without OCR.
5. Add a non-mutating preview resource that reconciles the selected LaTeX root,
   bibliography, figures, and rendered PDF.
6. Add digest-bound confirmation that persists separate paper source records
   and selected figure materials only after validation succeeds.
7. Expose paper preview cards and warnings in Brief and Outline without
   displacing the existing compact text and URL source controls.
8. Extend source chunks and generation diagnostics with section, page, path,
   representation, and paper-group locators.
9. Add cloud artifact and asynchronous extraction adapters only after the local
   workflow proves the contract.

## Validation

Coverage should include:

- empty, oversized, malformed, encrypted, traversal, symlink, duplicate-path,
  unsupported-compression, expansion-ratio, UTF-8, and text-size archives
- root, include, bibliography, citation, label, equation, table, code, section,
  comment, and figure resolution with exact source ranges
- PDF MIME and magic-byte mismatch, malformed and encrypted PDFs, page limits,
  native text extraction, no-text warnings, timeouts, and cleanup
- confirmation with matching and stale artifact fingerprints
- confirmation rejecting root, bibliography, option, schema, or converter drift
  even when archive bytes are unchanged
- diagnostics and figure candidates resolving to exact original-source ranges
  using the declared offset unit
- no canonical writes when preview or confirmation validation fails
- dual LaTeX/PDF grouping without duplicate retrieval weighting
- imported figure provenance through the existing material library
- instruction-looking paper content staying out of prompt instructions and
  slide-visible text
- draft upload, preview, outline approval, presentation creation, source
  persistence, locator diagnostics, and cleanup through the browser workflow
- local and cloud contract parity when a cloud adapter is added

## Non-Goals

- No TeX compilation or general TeX authoring environment.
- No arbitrary filesystem, archive, shell, or network access from paper source.
- No automatic OCR in the first slice.
- No PDF annotation, drawing, or full research-reader UI in the first slice.
- No semantic PDF figure, table, or equation recovery when original LaTeX
  assets are available.
- No Crossref, DOI, or open-access network enrichment as part of import.
- No general document-ingestion framework before the paper workflow proves a
  reusable need.
- No direct slide creation from unreviewed imported artifacts.

## Open Questions

- Should a single-file `.tex` convenience upload be accepted directly, or
  should the first UI consistently require a ZIP so assets and includes are
  never implied to be complete?
- Which source and PDF limits should be user-configurable in local app mode?
- Should confirmed raw artifacts be included in normal presentation bundles by
  default or only in an explicit reproducibility export?
- When should the reused importer become a separately versioned neutral package
  shared with Kirjolab?
