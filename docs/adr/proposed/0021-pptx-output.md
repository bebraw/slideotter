# ADR 0021: PPTX Output

## Status

Proposed implementation plan.

## Context

slideotter currently publishes checked PDF archives from the shared DOM renderer. That is the right canonical output for reviewable, validated decks, but many presentation workflows still require PowerPoint files:

- stakeholder review in Microsoft Office
- last-mile editing by teams that standardize on PowerPoint
- conference or corporate submission requirements
- handoff to people who cannot use slideotter
- reuse of selected slides in existing `.pptx` decks

The Quarto comparison showed that mature publishing tools often support multiple output formats, including PowerPoint. It also highlighted the risk: multi-output support is a discipline, not a checkbox. Different formats have different capabilities, and output-specific constraints should not distort the authoring model.

slideotter should add PPTX output carefully. The DOM renderer remains canonical. PPTX should be an export artifact with explicit fidelity expectations, not a second source model or a new authoring surface.

## Decision Direction

Add PowerPoint `.pptx` export as a secondary output target.

The exported PPTX should preserve the active deck's slide order, visible slide content, images, captions, source lines, and basic visual theme as well as PowerPoint allows. It should omit skipped and archived slides by default, matching PDF export and presentation mode.

PPTX export should not replace PDF archive output. PDF remains the highest-fidelity, validation-backed artifact. PPTX is for handoff and interoperability.

## Product Rules

- PPTX export uses active, non-skipped, non-archived slides by default.
- Export must be explicit; it should not run as part of every build unless requested.
- The user should see that PPTX is an interoperability export, not the canonical validated archive.
- Exported slides should preserve useful editability when practical, but not at the cost of introducing a second renderer.
- If a slide feature cannot be represented faithfully in PowerPoint, the exporter should warn rather than silently misrepresent it.
- Speaker/presenter behavior, graph navigation, statecharts, and browser-only interactions do not need to round-trip into PPTX.
- PPTX export should be available through the same server-controlled job/action model as other exports.

## Export Strategies

There are two viable strategies:

### Image-Based Export

Render each active slide through the DOM runtime, then place each rendered slide image full-bleed into a PowerPoint slide.

Benefits:

- Highest visual fidelity.
- Reuses the existing DOM renderer and baseline validation path.
- Low schema translation complexity.
- Works for all supported slide families and layout treatments.

Costs:

- Output is not meaningfully editable in PowerPoint.
- Text, shapes, and images are flattened.
- File size can grow quickly.

### Structured Export

Map slide specs into native PowerPoint text boxes, shapes, images, and theme values.

Benefits:

- Output is more editable.
- Text remains text.
- Images can remain selectable.

Costs:

- Requires a second layout mapping for every supported slide family and layout treatment.
- Higher risk of visual drift from DOM/PDF output.
- Needs separate validation and many edge-case rules.

## Decision For First Implementation

Start with core, image-based PPTX export.

This preserves the DOM-first decision from ADR 0015 and gives users a useful handoff file without creating a parallel renderer. The generated PPTX should be visually faithful to the current validated deck, even if it is not deeply editable. PowerPoint handoff is common enough baseline interoperability to live in core for the first implementation, but the exporter should be isolated behind an export service boundary so it can later move behind ADR 0020's plugin model if exporter variety grows.

The first exporter should render each slide at 2x the deck CSS pixel size, which means roughly 2560x1440 for the current 16:9 slide runtime. That is a practical default for projected decks and Office review while keeping files smaller than 4K-per-slide exports. A later advanced option can expose 1x, 2x, 3x, or explicit DPI.

PPTX artifacts should include minimal traceability metadata, not hidden speaker notes by default. Include document properties and, if practical, per-slide notes with presentation id, slide id, source slide path, export timestamp, and slide title. Do not include deck context, source excerpts, prompts, provider diagnostics, or private material metadata unless a future explicit provenance export option asks for it.

PPTX archives should be generated on demand only, not checked in by default. PDF remains the checked, canonical archive artifact. PPTX is an interoperability artifact and can vary by library version, image resolution, and Office behavior, so default source control should avoid storing it unless a user explicitly archives one.

Use `pptxgenjs` for the first Node implementation. It is purpose-built for writing `.pptx`, supports image placement well enough for the image-based strategy, avoids automating PowerPoint or LibreOffice, and keeps the first exporter simple. Keep the dependency isolated behind the PPTX export service so replacing it later does not affect the DOM renderer or PDF export path.

Structured PPTX export can be considered later for a constrained subset of slide families if there is clear demand and enough validation coverage.

## Artifact Shape

PPTX output should live beside other generated artifacts:

```text
slides/output/<presentation-id>.pptx
```

Under the user-data packaging direction, the equivalent path should be:

```text
~/.slideotter/output/<presentation-id>.pptx
```

If the user explicitly archives a PPTX artifact, it should live beside PDF archives:

```text
archive/<presentation-id>.pptx
```

PPTX archives should be explicit. The existing archive workflow should continue to prioritize PDF until a product decision says otherwise.

## API And UI Shape

The studio should expose PPTX export as an action:

- Deck-level action: `Export PPTX`
- Job status: queued, rendering slides, writing PPTX, complete, failed
- Result: download/open artifact path
- Diagnostics: unsupported features, fallback choices, slide count, image resolution, output size

In ADR 0013's hypermedia model, PPTX export should appear as an available action only when the active deck can be exported.

Example action descriptor:

```json
{
  "id": "export-pptx",
  "method": "POST",
  "href": "/api/presentations/slideotter/exports/pptx",
  "input": "pptxExportRequest",
  "effect": "artifact"
}
```

## Validation

PPTX export validation should focus on artifact correctness and obvious regressions:

- exported file exists and has nonzero size
- slide count matches active deck count
- skipped and archived slides are omitted by default
- slide dimensions match the deck aspect ratio
- each slide has one full-slide rendered image in the image-based exporter
- exported image resolution is high enough for normal presentation use
- export reports warnings for unsupported non-static features
- browser/PDF render validation remains the primary visual validation

The first implementation does not need pixel comparison inside PowerPoint. The visual source should be the same rendered images already validated through the DOM/PDF pipeline.

## Plugin System Relationship

PPTX export should start as a core-supported exporter only if it is considered common enough for baseline interoperability. Otherwise, ADR 0020's plugin system is a good fit.

Even if the first exporter lives in core, it should be designed like a plugin contribution:

- declared export capability
- server-controlled action
- explicit permissions in cloud/workspace mode
- structured diagnostics
- job-backed execution
- no direct mutation of deck source

This keeps the path open for later exporters such as Quarto Revealjs, image packs, or LMS packages.

## Cloud Hosting Relationship

In the Cloudflare-hosted direction, PPTX export should be a background job. The job may need a dedicated rendering service if Workers cannot perform the required browser rendering or PPTX packaging directly.

The cloud artifact should be stored as a managed export object, likely in R2, with authorization on download links.

## Implementation Plan

1. Add an export service boundary.
   Create a generic export interface for PDF and future PPTX-style artifacts without changing the existing PDF build behavior.

2. Add image-based PPTX generation.
   Render active slides through the DOM preview path and write one full-slide image per PowerPoint slide.

3. Add CLI command.
   Add a script such as `npm run export:pptx` or `slideotter export pptx` once the packaged CLI exists.

4. Add studio action.
   Expose `Export PPTX` as a deck-level action with status and diagnostics.

5. Add validation coverage.
   Check artifact existence, slide count, dimensions, skipped-slide behavior, and basic file readability.

6. Add archive option later.
   Keep PDF archive as default. Add explicit PPTX archive only when users need checked-in PowerPoint handoff snapshots.

7. Revisit structured export.
   Consider native editable PPTX only after the image-based exporter proves useful and the highest-value editable subset is clear.

## Non-Goals

- No replacement of PDF archive output.
- No PPTX as a source format in the first implementation.
- No full PowerPoint round-trip editing.
- No second slide renderer.
- No support for browser-only navigation, graph branches, or statechart behavior inside PPTX.
- No guarantee that exported PPTX is visually identical when edited in PowerPoint.

## Resolved Questions

- PPTX export lives in core for the first implementation, behind an exporter-shaped service boundary.
- The default image resolution is 2x the deck CSS pixel size.
- Exported files include minimal traceability metadata and no hidden speaker notes by default.
- PPTX archives are generated on demand only and are not checked in by default.
- `pptxgenjs` writes `.pptx` files in Node for the first implementation.
