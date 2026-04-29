# ADR 0026: Custom Layout Authoring And Preview

## Status

Implemented.

## Context

The studio already supports a reusable layout baseline: slide specs can carry validated layout treatments, deck-local and favorite layout libraries persist JSON definitions, layouts can be imported and exported, and Redo Layout candidates can reuse or save compatible definitions.

That baseline is enough for saving known treatments, generated `photoGridArrangement` definitions, and generated `slotRegionLayout` definitions. This ADR records the implemented guarded workflow for creating and inspecting custom layouts before applying them.

Custom layouts should expand what authors can express while preserving the product boundary: structured slide specs, server-controlled writes, shared DOM preview, validation, and explicit apply.

## Decision

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

ADR 0005 records the implemented generated reusable layout-definition workflow. This ADR narrows the custom layout authoring and preview contract.

ADR 0015's DOM-first rendering boundary remains unchanged. Custom layout preview, thumbnails, validation, PDF output, and exported artifacts must use the same runtime.

ADR 0018 records the implemented reusable-layout baseline. Custom layout authoring builds on that baseline rather than replacing deck-local and favorite layout libraries.

ADR 0024's inline current-slide generation direction should place custom layout editing near the current slide preview and candidate review surface.

ADR 0025's assisted remediation direction may use custom layout candidates as one repair strategy for validation failures, but remediation should not silently create or apply custom layouts.

## Implemented Scope

- Custom layout authoring starts with `content` slides.
- The Slide Studio layout library panel includes constrained controls for layout treatment, region pattern, spacing, minimum font size, favorite-ready preview mode, and advanced definition JSON.
- The editor can load an existing `slotRegionLayout` definition or create a draft definition from bounded controls.
- Preview creates a normal session-only `custom-layout` candidate through the server, rendered by the shared DOM preview path.
- Saving to deck-local and favorite libraries uses the existing layout candidate save path.
- Favorite custom layouts require a favorite-ready preview flag before save.
- The server validates custom layout JSON before preview, rejects unsupported slide families, and requires the content slots `title`, `summary`, `signals`, and `guardrails`.

## Validation

Coverage includes:

- schema validation for custom layout definitions
- incompatible family and missing-field rejection
- candidate preview rendering through the shared DOM runtime
- browser validation for the Slide Studio custom layout controls

Existing layout-library coverage continues to cover duplicate id normalization on save/import and export/import round trips. Existing candidate apply coverage continues to cover explicit apply and stale-candidate boundaries.

## Non-Goals

- No freeform canvas editor for arbitrary object placement.
- No second layout renderer.
- No executable layout plugins.
- No arbitrary CSS escape hatch.
- No silent apply when saving a custom layout.
- No guarantee that one custom layout works across every slide family.

## Resolved Questions

- Custom layout authoring should start with `content` slides. They exercise the most useful `slotRegionLayout` surface: title, summary, signals, guardrails, reading order, two-panel balance, spacing, and typography roles. `photoGrid` already has arrangement definitions, while `divider`, `quote`, and `photo` have fewer degrees of freedom.
- Multi-slide preview should be required before saving a favorite layout, but optional for deck-local layouts. Favorites are cross-presentation assets, so they should prove they work on at least the current slide plus one representative compatible slide or fixture. Deck-local layouts may remain current-slide-only when the author is solving one immediate deck problem.
- Direct manipulation should support selecting slots, assigning slots to predefined regions, changing row and column spans within a bounded grid, reordering reading order, and adjusting spacing, alignment, and media-fit tokens. It should not support pixel dragging, arbitrary resizing, free text boxes, custom CSS, overlapping regions, or unconstrained z-order.
- Custom layouts should use their own `layoutDefinition.schemaVersion`, independent from the slide-spec schema. Slide specs and layout definitions evolve at different rates, and imported or favorite layouts need compatibility checks without forcing slide-spec migrations.
- Layout validation should expose immediate findings, but repair suggestions should remain candidates under ADR 0025. The editor can say what failed and highlight the affected slot or region; it should not auto-repair or silently rewrite layout definitions outside the remediation candidate flow.

## Open Questions

- None.
