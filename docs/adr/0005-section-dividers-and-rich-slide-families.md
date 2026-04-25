# ADR 0005: Section Dividers And Rich Slide Families

## Status

Proposed implementation plan.

## Context

The demo deck now uses title-only divider slides to make a longer presentation easier to follow. That exposed two related product gaps:

- divider slides are supported by the renderer only as `toc` slides with `layout: "divider"`
- the app does not offer first-class creation or generation paths for common slide intentions such as section breaks, quote slides, photo slides, or split-photo layouts

The current model is intentionally structured. Slide specs are validated JSON, generated candidates stay inside known schemas, and the DOM renderer plus validators remain authoritative for preview and export. That structure is useful and should stay. The goal is not arbitrary HTML or freeform canvas editing. The goal is to let common presentation requests map to explicit, validated slide families.

## Decision Direction

Grow the slide model through named slide families and named layout treatments, not through arbitrary per-slide rendering code.

Authors should be able to ask for deck structure and visual intent in normal language, but the system should materialize those requests as one of the supported structured slide families. Generation may choose, for example, a divider, quote, photo, or photo-grid family, but the produced slide spec must still validate, render through the shared DOM runtime, compare cleanly, and pass the same text, geometry, media, and render checks.

## Product Rules

- Long decks should get section dividers when the outline has clear sections or when the target slide count makes pacing hard to follow.
- Divider slides should be title-only by default and should not require hidden card, summary, or note content to satisfy an unrelated slide family.
- "Arbitrary layout" requests should be interpreted as requests for a known slide family or layout treatment.
- The app should say no, or offer the nearest supported family, when a request cannot be represented safely.
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
- material picker supports selecting multiple images for one slide
- validation checks each image, each caption/source, and grid balance

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

7. Add photo-grid support.
   Introduce two-up, three-up, and four-up grid treatments through a single `photoGrid` family. Do not add arbitrary grid coordinates in the first version.

8. Update generation schemas and prompts.
   Let deck-plan and slide-drafting schemas choose among supported slide families. Prompt language should map user requests such as "quote slide", "photo slide", "before/after", and "split photos" to the corresponding family.

9. Keep layout requests bounded.
   `redo-layout` should continue to rebalance within the selected family. If the user asks for a different family, create a candidate that changes `type` explicitly and makes the family change visible in the compare view.

10. Expand validation fixtures.
    Add fixture slides for divider, quote, photo, and photo-grid. Cover text fit, media bounds, caption/source attachment, render baselines, workflow creation, and generated candidate validation.

## Non-Goals

- no arbitrary HTML, CSS, SVG, or JavaScript slide specs
- no freeform drag-and-drop visual editor in this slice
- no unconstrained per-slide layout coordinates
- no remote image URLs in slide specs without material-library import
- no silent family changes during candidate apply

## Rollout Order

1. Divider family and manual divider insertion.
2. Section-aware staged outline planning.
3. Quote family.
4. Photo family using one material.
5. `mediaItems` model.
6. Photo-grid family.
7. Family-changing generation and compare support.

This order improves long-deck clarity first, then expands visual expressiveness while keeping each slice small enough to validate from the rendered PDF.

## Open Questions

- Should existing `toc` + `layout: "divider"` specs be migrated automatically or left as a backward-compatible alias?
- What target length should trigger automatic section-divider suggestions?
- Should quote slides require a source by default, or allow unsourced editorial pull quotes?
- Should `photoGrid` support exactly two to four items, or should the first implementation only support two-up comparison?
- Should family-changing candidates live in the existing variant list or in a separate "change slide type" workflow?
