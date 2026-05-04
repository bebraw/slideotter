# ADR 0002: Pragmatic Studio UI Review

## Status

Implemented

## Context

The browser studio has accumulated the core deck authoring workflows: DOM preview, slide selection, direct text edits, structured JSON edits, variant generation, deck planning, assistant actions, and checks. The product direction is pragmatic and clean: keep the interface quiet, make repeated deck work efficient, and avoid turning the studio into a broad dashboard.

The April 2026 UI review inspected the live Studio, deck planning, Checks, Structured Draft, Assistant, and mobile states.

## Decision

Keep the UI anchored around the rendered slide and the immediate authoring loop. Secondary tools should be available on demand but should not permanently compete with the slide preview.

The next UI refinements should follow this order:

1. Move Variant Generation directly below the preview and thumbnail selector.
2. Keep slide context and manual slide add/remove below the primary generation workflow.
3. Hide the candidate comparison workspace until candidates exist.
4. Make Checks default to run actions, status, and latest findings; keep check settings behind a collapsed disclosure.
5. Make Spec and Chat drawers less visually intrusive, especially where they cover slide content.
6. Compact the mobile thumbnail selector so the first viewport remains dominated by the active slide and current action.
7. Keep deck planning dense but calm; collapse palette and guardrail controls when they are not the immediate task.

## Findings

- The Spec and Chat drawers can obscure the slide canvas and feel like competing workspaces instead of helpers.
- Mobile Studio spends too much of the first viewport on thumbnail chrome and filenames.
- Variant generation sits lower than its importance in the Slide Studio workflow.
- The empty candidate comparison area reserves too much blank space before candidates exist.
- Checks are correctly demoted from primary navigation, but the panel still exposes settings too early.
- Deck planning is functional and quiet, but palette controls can dominate the second viewport.

## Consequences

- The Studio page should prioritize preview, selection, and variant generation before lower-frequency context and slide-management controls.
- Empty states should be compact and action-oriented.
- Advanced settings should remain discoverable without being prominent by default.
- Layout regression coverage should keep checking that the preview, thumbnail rail, and Checks panel stay within the viewport.
