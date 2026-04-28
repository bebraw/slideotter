# ADR 0023: Post-Creation Theme Control

## Status

Implemented.

## Context

The staged creation flow currently treats theming as a distinct stage after content materialization. That made sense while the product needed a visible place to test saved themes, generated variants, and apply summaries.

In practice, theme choice is easier to judge after the slide set exists and the author can inspect real slides in Slide Studio. Keeping theme work as a required creation stage makes initial deck creation feel longer, and it puts visual styling before the author has reviewed the actual generated content. It also creates a separate workflow surface for a concern that belongs beside normal slide review.

Theme should remain a first-class concern, but it should not block the initial slide set from opening in the main editing workspace.

## Decision Direction

After initial slides are created, move directly to Slide Studio.

Theming should become an optional Slide Studio control rather than a required creation stage. The control can live in a slide-out rail or drawer similar to the existing Chat and Spec controls, with its own compact closed state and wider open state for previews, saved themes, and apply review.

The creation flow may still collect theme intent in the brief so initial generation can choose reasonable defaults. That intent should seed the first deck theme and later theme candidates, but it should not force the author through a separate Theme stage before reaching the generated deck.

## Product Rules

- Initial presentation creation should end in Slide Studio once the approved outline has materialized into slides.
- Theme intent may be captured during brief setup, but only as input to generation and later theme controls.
- Theme choice should be optional after creation, not a blocking stage.
- The Slide Studio theme control should preview changes against real deck slides.
- Theme changes should remain candidate-based until explicitly applied.
- Applying a theme should patch deck-level visual theme state, not rewrite slide content.
- Theme work should preserve slide family, layout treatment, materials, sources, and slide text unless the user explicitly starts a content-oriented workflow.
- The current deck theme should remain visible through rendered slide previews, not through app chrome.
- Saved theme favorites and generated theme variants should be available from the same theme control.
- Theme validation must keep contrast and progress-indicator guardrails in the apply path.

## UI Shape

Slide Studio should treat theme as a sibling side control to Chat and Spec:

- closed rail or handle labeled `Theme`
- open drawer with current theme summary
- saved theme picker
- generated theme variants
- focused palette and font controls
- multi-slide preview using real slides from the active deck
- apply summary before mutation
- save-to-favorites action for reusable themes

The control should not compete with the main preview. It should let the author open theme work when needed, compare candidates, apply one, then return to slide editing.

## Creation Flow Changes

The creation flow should keep the content-first path:

1. Capture brief, audience, objective, constraints, sources, target length, and optional theme intent.
2. Generate an editable outline.
3. Let the author approve or refine the outline.
4. Materialize the initial slide set.
5. Open Slide Studio on the new presentation.
6. Offer theme adjustment through the Slide Studio Theme control.

The old required Theme stage should be removed or reduced to a transition note that points to the Theme control in Slide Studio.

## Server Behavior

The server should continue to store deck theme values in presentation-scoped state. Theme candidate generation should remain server-owned and proposal-oriented:

- read current deck theme and theme brief
- generate normalized theme tokens
- render previews through the shared DOM runtime
- validate contrast and theme shape
- return session-only candidates
- apply only after explicit user confirmation

Theme operations should be deck-scoped actions. They should not be coupled to creation draft state after slides are materialized.

## Relationship To Existing ADRs

ADR 0004's staged creation direction still applies for separating brief, structure, content, and review. This ADR narrows the theme part of that flow: theme remains available after content creation, but it is no longer a required creation stage.

ADR 0010's LLM theme candidate direction still applies. The model can propose visual treatment candidates, while local code owns normalization, contrast checking, preview rendering, and apply.

ADR 0015's DOM-first boundary remains unchanged. Theme previews should use the shared DOM renderer.

ADR 0013's hypermedia API direction should expose theme as a deck-level action available from the active presentation resource, not only from a creation-flow resource.

## Validation

Add coverage for:

- new presentation creation lands in Slide Studio after slide materialization
- no required Theme stage blocks access to the generated deck
- Slide Studio exposes a Theme control beside Chat and Spec
- theme candidates preview against real active-deck slides
- applying a theme changes deck visual theme state only
- rejected theme candidates cannot bypass contrast validation
- saved favorite themes remain reusable from the Theme control
- theme operations are unavailable while no active presentation exists

## Non-Goals

- No removal of theme briefs from initial creation.
- No direct CSS editing surface.
- No model-written theme files.
- No slide-content rewrite as part of theme apply.
- No second renderer for theme preview.
- No requirement that every new deck chooses a theme variant before editing starts.

## Open Questions

Resolved:

- The Theme drawer should stay closed after deck creation, with the persistent Theme rail tab as the only visible affordance in Slide Studio.
- Theme preview should use three real slides by default: the cover, one content-heavy slide, and one visually distinct slide such as divider, quote, photo, or photo-grid. If the deck has fewer than three slides, use all available slides.
- Theme candidates should be generated only on user request. The initial theme should come from brief intent and deterministic normalization.
- Layout treatment suggestions should remain separate from the Theme control. Theme apply stays deck-level and non-content-mutating; slide/family-sensitive layout work remains in Redo Layout and layout-library workflows.
