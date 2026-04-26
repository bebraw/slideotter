# ADR 0005: Section Dividers, Rich Slide Families, And Layout Library

## Status

Proposed implementation plan.

## Context

The demo deck now uses title-only divider slides to make a longer presentation easier to follow. That exposed two related product gaps:

- divider slides are supported by the renderer only as `toc` slides with `layout: "divider"`
- the app does not offer first-class creation or generation paths for common slide intentions such as section breaks, quote slides, photo slides, or split-photo layouts
- layout treatments are hardcoded in the renderer instead of being defined, saved, reused, and shared like themes

The current model is intentionally structured. Slide specs are validated JSON, generated candidates stay inside known schemas, and the DOM renderer plus validators remain authoritative for preview and export. That structure is useful and should stay. At the same time, layouts should become a shareable authoring asset, similar to themes. The goal is to let common presentation requests map to explicit slide families and reusable layout definitions while still protecting validation, preview, and PDF output from arbitrary runtime code.

## Decision Direction

Grow the slide model through named slide families and reusable JSON layout definitions.

Authors should be able to ask for deck structure and visual intent in normal language, but the system should materialize those requests as one of the supported structured slide families. Generation may choose, for example, a divider, quote, photo, or photo-grid family, but the produced slide spec must still validate, render through the shared DOM runtime, compare cleanly, and pass the same text, geometry, media, and render checks.

Authors should also be able to define, save, favorite, reuse, and share layouts across slide sets. From the user's perspective, layout requests can be arbitrary: "make this a quote spread", "put the chart beside two takeaways", "use three stacked screenshots", or "split these photos 70/30". Internally, those requests should compile to a bounded declarative JSON layout definition that the renderer and validators understand.

JSON should be the canonical intermediate and exchange format for layouts. Generated layout candidates, deck-local saved layouts, favorite-layout entries, copy/paste transfer, and exported layout packs should all use the same versioned JSON document shape. The renderer can compile that JSON into DOM/CSS, but layout sharing should never require copying runtime CSS, generated HTML, or hidden editor state.

## Product Rules

- Long decks should get section dividers when the outline has clear sections or when the target slide count makes pacing hard to follow.
- Divider slides should be title-only by default and should not require hidden card, summary, or note content to satisfy an unrelated slide family.
- Arbitrary layout requests should be accepted when they can compile to a validated layout definition.
- The app should say no, or offer the nearest supported family/layout, when a request cannot be represented safely.
- Layout definitions should be saved as reusable library items, not embedded as one-off hidden renderer code inside slide specs.
- Layout definitions should be copyable as validated JSON so authors can move a layout between decks, workspaces, or review threads without special tooling.
- A slide should reference a layout by id plus layout-safe slot assignments or parameters.
- Rich visual families should build on the presentation material library rather than raw external URLs.
- Multi-image families should keep captions, source lines, alt text, and validation close to each image.
- Existing slide families should keep working; migrations should be additive and reversible where possible.

## Target Slide Families

### Divider

Purpose: section transition in medium and long decks.

Minimum fields:

- `type: "divider"`
- `title`
- optional `eyebrow`

Expected UI:

- manual "Add divider" action in Slide Studio
- deck outline and staged creation can insert dividers between sections
- deck length growth can add dividers only when it improves navigation, not as filler

### Quote

Purpose: one quoted claim, testimonial, excerpt, or source-backed pull quote.

Minimum fields:

- `type: "quote"`
- `quote`
- optional `attribution`
- optional `source`
- optional `context`

Expected UI:

- quote slide generator from selected text or source snippet
- source grounding keeps attribution visible and compact
- validation checks quote length and attribution placement

### Photo

Purpose: one dominant image with a short title or caption.

Minimum fields:

- `type: "photo"`
- `title`
- `media`
- optional `caption`

Expected UI:

- create from an attached material
- image search/import can propose photo slides when visual evidence is the point
- validation prioritizes image bounds, caption attachment, and progress-area spacing

### Photo Grid

Purpose: two to four related images, such as before/after, comparison, or examples.

Minimum fields:

- `type: "photoGrid"`
- `title`
- `mediaItems`
- optional per-item captions

Expected UI:

- split-photo and comparison requests map here
- material picker supports selecting multiple images for one slide; Slide Studio now supports manual two-to-four material photo-grid creation
- validation checks each image, each caption/source, and grid balance

## Layout Library

Layouts should become a first-class reusable asset, similar to saved themes.

### Storage

Layout definitions should live outside individual slide specs and use JSON as their portable representation:

- deck-local layout definitions under `~/.slideotter/presentations/<id>/state/layouts.json`
- user-saved favorite layouts in a reusable user library under `~/.slideotter/libraries/layouts/`
- later export/import support for sharing JSON layout packs across repositories

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

### Generation And Review

Layout generation should behave like theme generation:

- candidates are session-only until applied
- candidates preview against the selected slide or a small slide set
- authors can apply a layout to one slide, save it as a deck layout, or save it to their favorite-layout library for reuse across presentations; Redo Layout candidates now expose direct deck/favorite save actions
- generated layouts include a short rationale and the intended slide families
- compare view shows both content changes and layout-definition changes

### Favorite Layouts

Authors should be able to save layouts they like into a favorite-layout library.

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

## Implementation Plan

1. Promote dividers from a layout hack to a first-class slide family.
   Add `type: "divider"` to slide spec validation, DOM rendering, JSON editing, compare diffs, thumbnails, and workflow previews. Keep temporary compatibility for existing `toc` + `layout: "divider"` slides until the demo deck can migrate cleanly.

2. Add manual divider creation.
   Replace the current "system slide" only path with a small slide-type chooser or add a separate "Add divider" action. The first divider form should only ask for title and insertion point.

3. Teach outline planning about sections.
   Extend the staged outline model with optional section boundaries. When target length is high enough or the generated outline has clear phases, render section dividers in the outline review before slide drafting.

4. Materialize dividers during staged creation and deck growth.
   The slide drafting pipeline should create divider specs directly from approved section boundaries. Semantic deck length growth should prefer concrete detail slides by default, but may propose a divider when it improves navigation between existing clusters.

5. Add quote and single-photo families.
   Implement quote and photo specs before multi-image layouts. They cover common requests while keeping the renderer, validator, and material model changes small.

6. Extend materials from one `media` object to optional `mediaItems`.
   Keep the existing one-image `media` field for current families. Add a validated `mediaItems` path for families that need multiple images, with per-item alt text, caption, source, and material id.

7. Add the layout-library model.
   Introduce deck-local `layouts.json`, a favorite-layout runtime store, layout ids, a versioned JSON layout document shape, and layout definition validation. Start with definitions that can express the current hardcoded treatments before adding richer arrangements.

8. Add favorite-layout save and reuse.
   Let authors save a generated or adjusted layout as a favorite, browse favorite layouts in creation and Slide Studio, apply one to the current slide, copy/paste its JSON, and delete stale favorites. Slide Studio now exposes JSON exchange controls that export/import deck-local and favorite layout documents with duplicate-id normalization.

9. Add photo-grid support.
   Introduce two-up, three-up, and four-up grid treatments through a single `photoGrid` family. Do not add arbitrary grid coordinates in the first version.

10. Update generation schemas and prompts.
   Let deck-plan and slide-drafting schemas choose among supported slide families and saved layout definitions. Prompt language should map user requests such as "quote slide", "photo slide", "before/after", and "split photos" to the corresponding family and, when useful, a generated layout candidate.

11. Add layout candidate generation.
    `redo-layout` should generate layout candidates that may either reuse an existing library layout or propose a new declarative JSON layout definition. If the user asks for a different family, create a candidate that changes `type` explicitly and makes the family change visible in the compare view.

12. Expand validation fixtures.
    Add fixture slides and fixture layout definitions for divider, quote, photo, photo-grid, and generated layout-library candidates. Cover text fit, media bounds, caption/source attachment, render baselines, workflow creation, and generated candidate validation.

## Non-Goals

- no arbitrary HTML, CSS, SVG, or JavaScript execution from slide specs or layout definitions
- no freeform drag-and-drop visual editor in this slice
- no unconstrained per-slide absolute positioning
- no remote image URLs in slide specs without material-library import
- no separate non-JSON package format for layout sharing
- no silent family changes during candidate apply

## Rollout Order

1. Divider family and manual divider insertion.
2. Section-aware staged outline planning.
3. Quote family.
4. Photo family using one material.
5. Layout library for current built-in treatments.
6. Favorite-layout save, browse, apply, and delete.
7. Generated layout candidates with save/favorite/apply review.
8. `mediaItems` model.
9. Photo-grid family.
10. Family-changing generation and compare support. Initial local structure candidates now make common family changes explicit in compare/apply review; LLM-backed family changes can follow once generated layout definitions are in place.

This order improves long-deck clarity first, then turns layout into a reusable library asset before expanding visual expressiveness. Each slice should stay small enough to validate from the rendered PDF.

## Resolved Questions

- Existing `toc` + `layout: "divider"` specs do not need a long-lived backward-compatible alias. When `type: "divider"` lands, patch the repository-owned demo slides and fixtures to the new first-class family in the same change, then remove the old special case from active authoring paths.
- Automatic section-divider suggestions should begin at 12 or more target slides when the outline has clear section boundaries. At 18 or more target slides, staged creation should actively propose dividers unless the outline is intentionally linear or the user asks for a compact deck.
- Quote slides should support sourced quotes and editorial pull quotes as distinct modes. Sourced quotes require attribution and source metadata. Editorial pull quotes may be unsourced, but must be represented as authored slide copy rather than a quotation from an external person or document.
- Favorite layouts should live in the user-level `~/.slideotter` library from the start. More broadly, user-created slide sets and mutable user-owned data should live under `~/.slideotter`; the bundled slideotter tutorial presentation can stay in the application repository because it doubles as product documentation and an internal fixture.
- The first layout-definition schema should express named slots, region assignment, reading order, grid-like rows/columns, spacing tokens, typography roles, media fit rules, and validation constraints. It should not expose arbitrary CSS properties, selectors, absolute coordinates, or custom breakpoints. The schema only needs to cover the current built-in treatments first; richer layout grammar should be added only when a real slide family needs it.
- Staged creation may select from built-in layouts and saved favorite layouts, but should not generate new layout definitions before draft slide content exists. New generated layout definitions should happen in Slide Studio or in a post-content creation step where candidates can preview against real slide content and pass validation before being saved or applied.
- `photoGrid` should support two to four media items from the first schema version, but only through a small fixed set of arrangements such as two-up, three-item feature/stack, and four-up grid. The first implementation should not expose arbitrary grid coordinates; new arrangements can be added later as named layout definitions when real decks need them.
- Family-changing candidates should live in the existing candidate review surface, but must be explicitly labeled as slide-family changes. The compare view should highlight the old and new `type`, show any content fields that will be dropped or transformed, and require explicit confirmation before apply.

## Open Questions

- None.
