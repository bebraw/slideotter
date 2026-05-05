# ADR 0049: Minimal Built-In Layouts And User-Defined Layout Expansion

## Status

Proposed implementation plan.

## Context

slideotter has gained several layout mechanisms: built-in slide families, named layout treatments, generated layout definitions, deck-local layouts, favorite layouts, custom layout authoring, photo-grid arrangements, and validation-backed layout candidates.

Real deck usage shows a tension:

- More built-in layouts can make generated slides feel more varied.
- More built-in layouts also increase schema, renderer, validation, migration, prompt, and quality-gate burden.
- Weak models get more opportunities to choose a poor layout when the built-in set grows too broad.
- Users and teams often need layouts that reflect their own style, not a generic product gallery.

The long-term question is whether visual variety should come from expanding core templates or from making user-defined layouts easier to author, save, import, validate, and reuse.

## Decision Direction

Keep the built-in layout set small, stable, and high quality. Prefer user-defined, deck-local, favorite, imported, or plugin-provided layouts for long-tail layout expansion.

Core layouts should behave like primitives. They should cover common slide jobs reliably, validate well, and remain easy for generation to choose. Core should not grow into a large template marketplace.

When a real deck needs a new layout, first ask whether it can be represented as a reusable layout definition. Add a new built-in only when the current layout-definition model cannot express the needed behavior or when the pattern is essential to the baseline authoring loop.

## Product Rules

- Built-in layouts should be few, predictable, and robust.
- User-defined layouts should be first-class authoring assets, not an advanced escape hatch.
- Generation should choose from the current presentation's available layouts, not only from hardcoded core choices.
- Saved layouts should carry compatibility metadata, preview evidence, validation status, and import/export shape.
- Favorite layouts should require stronger validation than deck-local one-off layouts.
- Layout packs can provide variety without becoming always-on core behavior.
- Layout failures should produce reviewable candidates or validation findings, not silent renderer fallbacks.

## Core Layout Boundary

Core should keep only layouts that are needed for baseline use:

- simple cover/title opening
- standard content with bounded support panels
- summary/checklist closing
- divider/chapter break
- quote
- photo
- photo grid
- table-like or comparison structure only if it becomes baseline and validates well

Core should avoid adding layouts that are:

- brand-specific
- industry-specific
- mostly decorative
- slight visual variants of existing layouts
- useful only for one deck
- impossible to validate mechanically
- dependent on arbitrary CSS or manual positioning

## User-Defined Layout Expansion

User-defined layouts should become the main expansion path:

1. Start from a built-in, deck-local, favorite, imported, or generated candidate layout.
2. Edit constrained layout definition fields.
3. Preview against real slide content.
4. Validate for fit, spacing, media, captions, and progress-area clearance.
5. Save to deck-local or favorite library.
6. Reuse through Redo Layout, generation, import/export, or layout packs.

The layout library should support both one-off deck layouts and durable team-level favorites. Future plugin or marketplace work can add layout packs without changing the core renderer contract.

## Generation Behavior

Generation should treat layout availability as scoped context:

- built-in core layouts
- deck-local layouts compatible with the slide family
- favorite layouts compatible with the slide family
- imported or plugin-provided layout packs enabled for the workspace

The model may propose layout intent, but the server should map that intent to an available validated layout. If no suitable user-defined layout exists, generation should choose a conservative core primitive.

Generated layout definitions may still be useful, but they should generally become candidates that can be saved and reused rather than hidden one-off layout behavior.

## Migration Direction

Existing built-ins remain supported for compatibility. The reduction should be about future growth, not breaking old decks.

Implementation can proceed in phases:

1. Inventory current built-in layout treatments and identify which are core primitives.
2. Mark long-tail or brittle treatments as legacy/internal where appropriate.
3. Make generation prefer the curated primitive set by default.
4. Improve layout-library search, preview, validation, and save/apply flows.
5. Let users explicitly opt into favorite, deck-local, imported, or plugin-provided layouts during generation.
6. Add migration helpers only if old layout fields become invalid, which should be avoided where possible.

## Validation

Coverage should include:

- built-in layout inventory and compatibility checks
- imported layout validation and duplicate id normalization
- favorite-ready multi-slide validation
- generation choosing a deck-local or favorite layout only when compatible
- fallback to core primitive when a custom layout fails validation
- old decks retaining legacy layout rendering
- quality-gate coverage that catches overflow in both core and user-defined layouts

## Relationship To Existing ADRs

ADR 0005 records generated reusable layout definitions. This ADR narrows their role toward reusable candidates and saved assets instead of endless one-off built-ins.

ADR 0015 keeps DOM rendering and validation authoritative. User-defined layout expansion must use the same renderer.

ADR 0018 records the implemented rich slide-family and layout-library baseline. This ADR refines the growth strategy for that baseline.

ADR 0020's plugin system is the right long-term path for layout packs that should not live in core.

ADR 0026 records custom layout authoring and preview. This ADR elevates that workflow from an advanced feature to the primary path for layout variety.

ADR 0048 should improve title-slide quality within this boundary: add only a small number of core title treatments, and route brand/team-specific title styles through user-defined layouts.

## Non-Goals

- No removal of existing deck compatibility.
- No freeform WYSIWYG canvas.
- No arbitrary CSS or JavaScript layout plugins in core.
- No model-authored renderer code.
- No large bundled template gallery.
- No weakening of validation to make more layouts appear to work.

## Open Questions

- Which current built-in treatments should be considered core primitives, and which should become legacy/internal?
- Should generation require explicit user approval before using favorite or imported layouts?
- How should favorite layouts prove compatibility across different themes and content densities?
- Should layout packs ship as data-only plugins before the broader plugin runtime exists?
- How should teams share favorite layouts between local and future cloud workspaces?
