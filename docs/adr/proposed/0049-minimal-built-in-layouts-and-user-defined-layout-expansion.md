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
- Generation may create new declarative layout definitions when existing compatible layouts do not satisfy the slide intent.
- Saved layouts should carry compatibility metadata, preview evidence, validation status, and import/export shape.
- Favorite layouts should require stronger validation than deck-local one-off layouts.
- Layout packs can provide variety without becoming always-on core behavior.
- Layout failures should produce reviewable candidates or validation findings, not silent renderer fallbacks.

## Core Layout Boundary

Core should keep only layouts that are needed for baseline use:

- cover/title openings: `statement`, `identity`, `agenda`, `proof`, and `chapter`
- content primitives: `standard`, `steps`, and `checklist`
- structured slide families: `divider`, `quote`, `photo`, `photoGrid`, `toc`, `content`, and `summary`
- table-like or comparison structure only if it becomes baseline and validates well

Core should avoid adding layouts that are:

- removed treatments such as `callout`, `focus`, and `strip`
- brand-specific
- industry-specific
- mostly decorative
- slight visual variants of existing layouts
- useful only for one deck
- impossible to validate mechanically
- dependent on arbitrary CSS or manual positioning

## User-Defined Layout Expansion

User-defined layouts should become the main expansion path. The product should treat the layout workbench, generated layout candidates, deck-local layouts, favorite layouts, and layout-pack exchange as one coherent expansion surface rather than separate advanced tools.

1. Start from a built-in, deck-local, favorite, imported, or generated candidate layout.
2. Edit constrained layout definition fields.
3. Preview against real slide content.
4. Validate for fit, spacing, media, captions, and progress-area clearance.
5. Save to deck-local or favorite library.
6. Reuse through Redo Layout, generation, import/export, or layout packs.

The layout library should support both one-off deck layouts and durable team-level favorites. Future plugin or marketplace work can add layout packs without changing the core renderer contract.

## Primary Expansion Surface

The current custom/generated layout workflow is the right foundation, but it should become the primary way visual variety grows:

- **Construct**: Authors can create a layout from constrained controls, advanced JSON, an existing saved layout, or a generated candidate.
- **Preview**: Every new layout should render against real slide content in the same DOM preview path used by export and validation.
- **Validate**: The preview should show fit, spacing, media, caption, progress-area, and current-slide validation findings before save or apply.
- **Save**: A useful layout can become deck-local immediately, or a favorite after stronger reusable-layout validation.
- **Share**: Deck-local and favorite layouts should export as single-layout JSON or layout-pack JSON, then import into another presentation or workspace with duplicate ids normalized.
- **Reuse**: Generation and Redo Layout should see compatible deck-local and favorite layouts as scoped context, and should propose saved layouts before generating a new one.

The near-term product shift is not to invent another layout system. It is to make this path easier to discover, stronger at proving compatibility, and good enough that adding a new built-in treatment feels exceptional.

The next improvements should focus on:

- a clearer Layout Studio entry point for creating a new layout before there is a candidate
- richer generated-layout prompts that produce layout-definition candidates, not just layout intent
- multi-slide favorite-ready preview across representative content densities
- theme-compatibility preview using at least the current theme plus one contrasting theme profile
- layout-pack browsing, naming, provenance, and import review instead of raw copy/paste as the only sharing experience
- workspace/team sharing that uses the same layout-pack document shape before cloud sync adds permissions and ownership

## Generation Behavior

Generation should treat layout availability as scoped context:

- built-in core layouts
- deck-local layouts compatible with the slide family
- favorite layouts compatible with the slide family
- imported or plugin-provided layout packs enabled for the workspace

The model may propose layout intent, and the server should first try to map that intent to an available validated layout. If no suitable user-defined layout exists, generation may produce a new declarative layout-definition candidate instead of forcing a conservative core primitive.

Generated layout definitions are allowed, but only inside the same guarded layout-definition contract as manually authored layouts:

- generated layouts must be schema-backed JSON, not renderer code, CSS, HTML, SVG, or JavaScript
- generated layouts must preview against real slide content before apply
- generated layouts must pass fit, spacing, media, caption, and progress-area validation before apply or save
- generated layouts should be session-only candidates until the author explicitly applies or saves them
- generated layouts should carry rationale, intended slide family, compatibility claims, and validation evidence
- generated layouts should be saveable to deck-local or favorite libraries when they prove reusable

Generation should prefer existing compatible layouts before creating a new definition. New generated definitions are appropriate when the slide has a clear layout need that cannot be expressed by the current available layouts, or when Redo Layout is explicitly asked to explore a different structure.

## Migration Direction

Because the tool is not yet used by external decks, this reduction should remove obsolete built-in treatment support outright. Repository decks and layout fixtures should be migrated in the same change so every checked-in deck uses valid current fields.

Implementation can proceed in phases:

1. Inventory current built-in layout treatments and identify which are core primitives.
2. Remove long-tail or brittle treatments from generation, validation, layout import, and repository decks where appropriate.
3. Make generation prefer the curated primitive set by default.
4. Promote Layout Studio from an advanced drawer workflow into the primary construction path for new reusable layouts.
5. Improve layout-library search, preview, validation, save/apply, and import/export review flows.
6. Allow generation to propose new layout-definition candidates after content exists and real-slide preview is possible.
7. Strengthen favorite-ready validation with multi-slide, density, and theme-compatibility evidence.
8. Let users explicitly opt into favorite, deck-local, imported, or plugin-provided layouts during generation.
9. Add data-only layout-pack browsing and team/workspace sharing on top of the existing exchange document shape.
10. Add migration helpers only if old layout fields become invalid, which should be avoided where possible.

## Validation

Coverage should include:

- built-in layout inventory and compatibility checks
- imported layout validation and duplicate id normalization
- favorite-ready multi-slide validation
- theme and content-density preview evidence for favorite-ready layouts
- generation choosing a deck-local or favorite layout only when compatible
- generation producing a new layout-definition candidate when no compatible saved layout fits
- generated layout candidates remaining session-only until explicit apply or save
- layout-pack export/import preserving provenance and compatibility metadata
- invalid custom layouts producing validation findings instead of renderer fallbacks
- repository decks rejecting removed layout treatments
- quality-gate coverage that catches overflow in both core and user-defined layouts

## Relationship To Existing ADRs

ADR 0005 records generated reusable layout definitions. This ADR narrows their role toward reusable candidates and saved assets instead of endless one-off built-ins.

ADR 0015 keeps DOM rendering and validation authoritative. User-defined layout expansion must use the same renderer.

ADR 0018 records the implemented rich slide-family and layout-library baseline. This ADR refines the growth strategy for that baseline.

ADR 0020's plugin system is the right long-term path for layout packs that should not live in core.

ADR 0026 records custom layout authoring and preview. This ADR elevates that workflow from an advanced feature to the primary path for layout variety.

ADR 0048 should improve title-slide quality within this boundary: add only a small number of core title treatments, and route brand/team-specific title styles through user-defined layouts.

## Non-Goals

- No external-deck migration promise before there are real external users.
- No freeform WYSIWYG canvas.
- No arbitrary CSS or JavaScript layout plugins in core.
- No model-authored renderer code.
- No large bundled template gallery.
- No weakening of validation to make more layouts appear to work.

## Resolved Questions

- Current core primitives are `standard`, `steps`, and `checklist` for content-like slides, plus cover treatments `statement`, `identity`, `agenda`, `proof`, and `chapter`. `callout`, `focus`, and `strip` should be removed from generation and validation rather than carried as compatibility-only treatments.
- Generation may create new layouts, but only as declarative validated layout-definition candidates. It should not add built-in treatment names, renderer branches, or hidden one-off layout behavior.
- Deck-local layouts do not need per-slide approval during generation because they are already scoped to the active presentation. Favorite, imported, and plugin-provided layouts should be explicitly enabled at the generation session, deck, or workspace level, and their source should remain visible in candidate review.
- Favorite layouts should prove compatibility through validation evidence. A favorite-ready layout should pass current-slide preview plus representative compatible slide or fixture coverage for each declared slide family, across the default theme and at least one materially different theme profile, with short, normal, and dense content cases when the layout claims broad reuse.
- Layout packs should ship first as data-only plugin/package artifacts. They may include declarative layout definitions, metadata, previews, compatibility claims, and validation evidence, but no executable renderer code.
- Teams should share favorite layouts through portable layout-pack JSON first. The exchange format should carry stable ids, version, author/source metadata, compatibility metadata, validation evidence, preview references, and duplicate-id normalization on import. Future cloud workspaces can sync the same document shape with permissions, ownership, and update provenance layered on top.
