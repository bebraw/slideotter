# ADR 0005: Rich Generated Layout Definitions

## Status

Implemented.

## Context

ADR 0018 records the implemented baseline from the original ADR 0005 plan:
first-class `divider`, `quote`, `photo`, and `photoGrid` slide families; optional
multi-image `mediaItems`; deck-local and favorite layout libraries; portable
layout JSON exchange; saved-layout candidates; and explicit family-changing
compare/apply review.

That baseline left one larger product direction open: authors should be able to
ask for richer layout intent in normal language and receive validated,
shareable JSON layout definitions rather than renderer-specific hidden state.
The studio now supports that direction through generated `slotRegionLayout`
definitions for non-photo-grid slides and existing `photoGridArrangement`
definitions for photo-grid slides.

The current model is intentionally structured. Slide specs are validated JSON,
generated candidates stay inside known schemas, and the DOM renderer plus
validators remain authoritative for preview and export. Richer layout generation
should keep that boundary.

## Decision

Layout generation compiles common visual-intent requests to bounded
declarative JSON layout definitions.

Generation may choose an existing supported slide family, reuse a saved layout,
or propose a new layout definition. The produced candidate still validates,
renders through the shared DOM runtime, compares cleanly, and passes the same
text, geometry, media, and render checks as manually authored slides.

JSON should be the canonical intermediate and exchange format for layouts. Generated layout candidates, deck-local saved layouts, favorite-layout entries, copy/paste transfer, and exported layout packs should all use the same versioned JSON document shape. The renderer can compile that JSON into DOM/CSS, but layout sharing should never require copying runtime CSS, generated HTML, or hidden editor state.

ADR 0026 narrows the related custom layout authoring workflow. This ADR remains
focused on generated layout definitions and how natural-language layout requests
become reusable validated JSON.

## Product Rules

- Arbitrary layout requests should be accepted when they can compile to a validated layout definition.
- The app should say no, or offer the nearest supported family/layout, when a request cannot be represented safely.
- Layout definitions should be saved as reusable library items, not embedded as one-off hidden renderer code inside slide specs.
- Layout definitions should be copyable as validated JSON so authors can move a layout between decks, workspaces, or review threads without special tooling.
- A slide should reference a layout by id plus layout-safe slot assignments or parameters.
- Rich visual families should build on the presentation material library rather than raw external URLs.
- Multi-image families should keep captions, source lines, alt text, and validation close to each image.
- Existing slide families should keep working; migrations should be additive and reversible where possible.
- New generated definitions should preview against real slide content before they can be saved or applied.
- Staged creation may select from built-in layouts and saved favorite layouts, but should not generate new layout definitions before draft slide content exists.

## Layout Library

Layouts are already a first-class reusable asset at the baseline level. Richer
generated definitions should extend that model rather than adding a second
layout store or a separate sharing format.

### Storage

Layout definitions should live outside individual slide specs and use JSON as their portable representation:

- deck-local layout definitions under `~/.slideotter/presentations/<id>/state/layouts.json`
- user-saved favorite layouts in a reusable user library under `~/.slideotter/libraries/layouts/`
- JSON layout packs for explicit sharing and backup

The bundled slideotter tutorial presentation is the exception to the user-data rule. It can remain inside the application repository because it is part of the product documentation and development fixture set. User-created slide sets, user libraries, and other mutable user-owned data should live under `~/.slideotter`.

Slide specs should reference layouts by id:

```json
{
  "type": "content",
  "layoutId": "quote-with-sidebar",
  "layoutParams": {
    "emphasis": "quote",
    "mediaPosition": "right"
  }
}
```

The exact shape can change, but the boundary should stay clear: slide specs carry content and layout references; layout library entries carry the reusable arrangement.

### JSON Exchange Format

Every reusable layout should be serializable as a standalone JSON document with:

- a schema version
- stable layout id, name, and description
- supported slide families
- named slots and slot constraints
- theme token references instead of raw theme copies
- layout regions, spacing tokens, alignment, and media treatment rules
- validation constraints for text fit, media bounds, captions, sources, and progress-area clearance
- optional preview metadata such as thumbnail path or sample content id

Copy/paste should move this JSON document directly. Import should validate the document, normalize any local ids that would collide, and then save it into the deck-local or favorite-layout library. Exported layout packs should be arrays or named collections of the same JSON documents rather than a separate format.

### Definition Shape

A layout definition should be declarative and constrained:

- named slots, such as `title`, `quote`, `media.primary`, `media.secondary`, `body`, `caption`, and `source`
- responsive-safe regions, expressed as grid tracks, rows, columns, alignment, and spacing tokens
- theme-aware typography roles instead of hardcoded font stacks
- allowed media treatments such as crop, contain, cover, fit, and focal point
- explicit constraints for minimum font size, maximum line count, caption placement, and progress-area clearance

The renderer should compile the definition into DOM/CSS under the same runtime, not execute arbitrary user code.

The implemented broad definition type is `slotRegionLayout`. It stores named
slots, reading order, constrained regions, spacing tokens, typography roles,
media treatment, and validation constraints. It intentionally rejects arbitrary
CSS properties, selectors, absolute coordinates, custom breakpoints, and hidden
runtime code.

### Generation And Review

Layout generation should behave like theme generation:

- candidates are session-only until applied
- candidates preview against the selected slide or a small slide set
- authors can apply a layout to one slide, save it as a deck layout, or save it to their favorite-layout library for reuse across presentations
- generated layouts include a short rationale and the intended slide families
- compare view shows both content changes and layout-definition changes
- generated definitions should expose dropped, preserved, and transformed content fields when the layout request also changes slide family
- LLM output should describe layout intent and slot mapping; local validation should materialize the actual reusable definition before preview/apply

### Favorite Layouts

Authors can already save layouts into a favorite-layout library. Richer generated
layout definitions should preserve the same save, reuse, export, import, and
delete model.

- every generated or manually adjusted layout candidate should expose "save as favorite"
- favorite layouts should carry a name, description, supported slide families, preview thumbnail, definition version, and created/updated timestamps
- the creation flow and Slide Studio should let authors choose from favorite layouts before asking the model to generate a new one
- favorite layouts should remain user-editable and removable
- favorite layout definitions should be validated again when reused, so older saved layouts cannot silently bypass newer renderer or validation rules
- favorites should live in the user-level `~/.slideotter` library from the first implementation; export/import should still support portable layout packs for explicit sharing and backup

### Validation

Every saved layout definition should pass validation before it can be used:

- schema validation for allowed tokens and slot names
- DOM render validation using representative fixture content
- text fit and minimum font-size checks
- media bounds and caption/source attachment checks
- progress-area clearance
- contrast checks through the active theme

## Implemented Scope

1. Broadened the layout-definition schema.
   The layout service accepts `slotRegionLayout` definitions in addition to
   `photoGridArrangement`. The schema normalizes slots, reading order, regions,
   spacing, typography, media treatment, and validation constraints.

2. Generated reusable layout definitions after content exists.
   Redo Layout candidates now attach validated layout definitions for supported
   slide specs. Photo-grid slides continue to use `photoGridArrangement`; other
   supported families use `slotRegionLayout`.

3. Kept LLM output intent-shaped.
   The model provides target family, emphasis, dropped and preserved fields, and
   rationale. Local code materializes the validated slide spec and reusable
   layout definition before preview/apply.

4. Expanded compare and apply for definition changes.
   Candidate review now identifies candidates with layout definitions and
   summarizes the definition type, slot count, and region count.

5. Reused generated definitions through normal libraries.
   Generated definitions flow through the existing save layout, save favorite,
   JSON export/import, duplicate-id normalization, and revalidation path.

6. Expanded validation fixtures.
   Unit coverage verifies `slotRegionLayout` normalization, rejection of
   unbounded renderer state, and redo-layout generation of reusable definitions.

## Non-Goals

- no arbitrary HTML, CSS, SVG, or JavaScript execution from slide specs or layout definitions
- no freeform drag-and-drop visual editor in this slice
- no unconstrained per-slide absolute positioning
- no remote image URLs in slide specs without material-library import
- no separate non-JSON package format for layout sharing
- no silent family changes during candidate apply

## Rollout Notes

The first broad layout class is `slotRegionLayout`. Future layout classes should
be added only when real decks need them, and each class should stay small enough
to validate from the rendered PDF.

## Resolved Questions

- ADR 0018 owns the implemented divider, quote, photo, photo-grid, `mediaItems`, layout-library, favorite-layout, JSON exchange, and family-changing candidate baseline.
- Favorite layouts should continue to live in the user-level `~/.slideotter` library. More broadly, user-created slide sets and mutable user-owned data should live under `~/.slideotter`; the bundled slideotter tutorial presentation can stay in the application repository because it doubles as product documentation and an internal fixture.
- The broader layout-definition schema should express named slots, region assignment, reading order, grid-like rows/columns, spacing tokens, typography roles, media fit rules, and validation constraints. It should not expose arbitrary CSS properties, selectors, absolute coordinates, or custom breakpoints.
- Staged creation may select from built-in layouts and saved favorite layouts, but should not generate new layout definitions before draft slide content exists. New generated layout definitions should happen in Slide Studio or in a post-content creation step where candidates can preview against real slide content and pass validation before being saved or applied.
- `photoGrid` should support two to four media items from the first schema version, but only through a small fixed set of arrangements such as two-up, three-item feature/stack, and four-up grid. The first implementation should not expose arbitrary grid coordinates; new arrangements can be added later as named layout definitions when real decks need them.
- Family-changing candidates should live in the existing candidate review surface, but must be explicitly labeled as slide-family changes. The compare view should highlight the old and new `type`, show any content fields that will be dropped or transformed, and require explicit confirmation before apply.

## Open Questions

- None.
