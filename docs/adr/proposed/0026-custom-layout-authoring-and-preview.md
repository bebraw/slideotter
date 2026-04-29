# ADR 0026: Custom Layout Authoring And Preview

## Status

Proposed implementation plan.

## Context

The studio already supports a reusable layout baseline: slide specs can carry validated layout treatments, deck-local and favorite layout libraries persist JSON definitions, layouts can be imported and exported, and Redo Layout candidates can reuse or save compatible definitions.

That baseline is enough for saving known treatments and generated photo-grid arrangements, but it does not yet define how authors should create or inspect custom layouts before applying them. Without a specific decision, custom layout work could drift toward freeform visual editing, hidden renderer-specific state, or layout JSON that is only validated after it has already disrupted a slide.

Custom layouts should expand what authors can express while preserving the product boundary: structured slide specs, server-controlled writes, shared DOM preview, validation, and explicit apply.

## Decision Direction

Add custom layout authoring as a guarded layout-definition workflow.

Authors may create or edit declarative layout definitions for supported slide families, preview them against real slide content, validate the rendered result, and then save or apply them through the existing candidate review path. Custom layouts remain JSON data owned by the studio schema, not arbitrary CSS, HTML, SVG, JavaScript, or renderer plugins.

Custom layout preview is part of the authoring workflow, not a separate renderer. The same DOM runtime used for active slide preview, compare views, export, and validation must render custom layout candidates before they can be saved or applied.

## Product Rules

- Custom layout work starts from a supported slide family and real slide content.
- Authors should be able to duplicate an existing built-in, deck-local, favorite, or candidate layout before editing it.
- The layout editor should expose constrained controls for slots, regions, reading order, spacing, alignment, media fit, and typography roles.
- A structured JSON editor may exist for advanced users, but it must validate before preview and save.
- Preview should show the candidate layout against the current slide by default.
- Multi-slide preview should be available when saving a reusable layout that may affect more than one slide.
- Applying a custom layout to a slide should create a normal layout candidate with rationale, diff, preview, validation, and explicit apply.
- Saving a custom layout to the deck-local or favorite library should be separate from applying it to the active slide.
- Layout definitions should declare compatible slide families and required fields so incompatible slides cannot apply them accidentally.
- Custom layouts should not bypass text fit, media bounds, caption/source attachment, progress-area spacing, or render-baseline checks.

## Preview Flow

The first custom-layout preview flow should be slide-local:

1. Choose a source layout or create a blank constrained layout for the current slide family.
2. Edit layout properties through structured controls or validated JSON.
3. Render a live candidate preview through the shared DOM runtime.
4. Show validation findings beside the preview.
5. Save the layout to a library, apply it to the current slide, or discard it.

Preview should distinguish three states:

- **Draft**: the layout definition is being edited and has not validated.
- **Previewable**: the definition validates structurally and can render against the selected slide.
- **Applicable**: the rendered result passes the required checks for the selected slide and can become an apply candidate.

## Layout Definition Boundary

Custom layout definitions may describe:

- named content and media slots
- region assignment
- reading order
- rows, columns, groups, and relative emphasis
- spacing tokens from the supported design system
- alignment and media-fit policies
- typography roles from the deck theme
- validation constraints such as required fields, minimum region size, and caption attachment

Custom layout definitions may not include:

- arbitrary CSS properties, selectors, or custom breakpoints
- executable code
- raw HTML or SVG
- absolute per-pixel positioning as the primary model
- deck-specific visible copy
- hidden renderer behavior that cannot be imported, exported, and validated as JSON

## Server Behavior

The server remains authoritative for layout persistence and apply:

- validate layout-definition JSON before preview
- normalize ids and version fields before saving
- reject definitions that reference unsupported slide families or fields
- render previews through the shared DOM document
- run layout, text, geometry, and media validation before apply
- persist saved layouts only after validation succeeds
- apply only one selected candidate after explicit confirmation

The client may offer immediate editing feedback, but it should not write custom layout definitions directly to presentation state or favorite libraries.

## Relationship To Existing ADRs

ADR 0005 remains the future-direction record for generated reusable layout definitions. This ADR narrows the custom layout authoring and preview contract.

ADR 0015's DOM-first rendering boundary remains unchanged. Custom layout preview, thumbnails, validation, PDF output, and exported artifacts must use the same runtime.

ADR 0018 records the implemented reusable-layout baseline. Custom layout authoring builds on that baseline rather than replacing deck-local and favorite layout libraries.

ADR 0024's inline current-slide generation direction should place custom layout editing near the current slide preview and candidate review surface.

ADR 0025's assisted remediation direction may use custom layout candidates as one repair strategy for validation failures, but remediation should not silently create or apply custom layouts.

## Validation

Coverage should include:

- schema validation for custom layout definitions
- incompatible family and missing-field rejection
- duplicate id normalization on save/import
- candidate preview rendering through the shared DOM runtime
- text, geometry, media, caption/source, and progress-area validation for custom layout previews
- apply rejection when a candidate becomes stale after slide content changes
- export/import round trip for custom layout documents
- browser workflow coverage for duplicate, edit, preview, save, apply, and discard

## Non-Goals

- No freeform canvas editor for arbitrary object placement.
- No second layout renderer.
- No executable layout plugins.
- No arbitrary CSS escape hatch.
- No silent apply when saving a custom layout.
- No guarantee that one custom layout works across every slide family.

## Open Questions

- Which slide family should receive custom layout authoring first?
- Should multi-slide preview be mandatory before saving a favorite layout?
- How much direct manipulation should the constrained editor support before it starts behaving like a freeform canvas?
- Should custom layouts be versioned independently from the slide-spec schema?
- Should layout validation expose repair suggestions immediately or defer them to ADR 0025 remediation?
