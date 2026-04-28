# ADR 0031: Slide Studio Live Presentation Creation

## Status

Proposed implementation plan.

## Context

New presentation creation currently uses staged creation: authors complete a brief, generate and approve an editable outline, then enter a Content phase where slides are materialized and previewed before handoff into Slide Studio.

That Content phase has become redundant. It previews draft slides, tracks per-slide generation, and offers review affordances that overlap with Slide Studio's core job: showing the active slide, thumbnail rail, slide context, structured spec, theme controls, chat, validation, and candidate workflows.

Progressive slide generation already writes accumulated deck output after each successful slide and keeps partial output available when later generation fails. That means Slide Studio can become the live generation surface instead of waiting for a separate Content review stage to finish.

## Decision Direction

After outline approval, move directly into Slide Studio and generate the presentation there.

The creation flow should keep Brief and Outline as dedicated stages. Once the author approves the outline, the app should open Slide Studio, create or select the target presentation, and show slides in the normal Studio surfaces as they are generated.

The separate post-outline Content stage should be removed once Slide Studio can clearly represent pending, generating, complete, and failed slides.

## Product Rules

- Brief and Outline remain the pre-write creation flow.
- Outline approval remains the explicit boundary before slide files are written.
- Slide Studio becomes the live surface for post-outline slide drafting.
- Generated slides should appear in the normal thumbnail rail and active slide preview as soon as they are available.
- The active preview should never be replaced by a separate creation-only preview surface.
- Per-slide generation state must be visible: pending, generating, complete, failed, and stopped when applicable.
- Failed or stopped generation must preserve already materialized slides and enough outline context to resume or retry.
- Not-yet-generated slides may appear as placeholders in the rail, but they should not pretend to be editable completed slides.
- Slide context seeded from the approved outline should be available through the Context drawer as soon as a slide placeholder or generated slide exists.
- Theme, Chat, Spec, validation, and future inline variant controls should work against completed slides without leaving the live generation surface.

## UI Shape

The creation flow becomes:

1. **Brief**: capture audience, objective, tone, constraints, target length, theme brief, sources, and starter material.
2. **Outline**: generate, edit, lock, refine, and approve the deck outline.
3. **Slide Studio**: materialize slides progressively in the normal Studio workspace.

In Slide Studio during generation:

- the thumbnail rail includes generated slides plus pending placeholders from the approved outline
- the current slide preview shows the selected completed slide, or a compact placeholder when the selected slide is pending
- the masthead or workflow status line shows deck-level generation progress and stop/retry controls
- each rail item shows generation state without adding a separate dashboard
- the Context drawer exposes outline-derived intent, must-include notes, layout hints, and speaker notes for the selected slide
- failed slides can be retried from their placeholder or from a compact generation status control

## Relationship To Existing ADRs

ADR 0004's staged creation direction remains valid through Brief and Outline, but the final content materialization UI should move into Slide Studio.

ADR 0012's progressive slide generation preview becomes the foundation for live Studio handoff rather than a separate creation preview.

ADR 0023's Theme drawer fits this model because deck-level theme tuning is available immediately after the first real slides exist.

ADR 0024's inline current-slide variant generation complements this change: Slide Studio becomes the single workbench for both first-pass generation review and later slide-level improvement.

ADR 0028's token-efficient generation direction should still apply. Moving the UI surface must not require sending broader prompts or repeating full deck context unnecessarily.

## Server Behavior

The server should remain authoritative for:

- creating the target presentation from the approved outline
- storing the locked brief and outline snapshot used for generation
- publishing per-slide generation progress
- writing accumulated deck files after each successful slide
- seeding slide context from the approved outline and generated slide plan
- validating generated specs before marking a slide complete
- preserving partial output and failure metadata

No client-side direct writes to slide files should be introduced.

## Validation

Add coverage for:

- approving an outline moves the author into Slide Studio instead of a Content stage
- the thumbnail rail shows pending placeholders before all slides are generated
- generated slides appear in the active preview without leaving Studio
- generation progress and stop/retry controls remain visible without a creation-only preview
- failed generation preserves completed slides and marks the failed slide clearly
- Context drawer fields are seeded for pending and completed slides
- Theme, Chat, Spec, validation, and inline variant surfaces remain usable for completed slides during or after generation
- no duplicate Content-stage preview remains in the creation flow

## Migration Plan

1. Introduce Studio rail placeholders backed by the approved outline.
2. Route outline approval into Slide Studio while keeping the existing Content phase behind a temporary compatibility path if needed.
3. Move deck-level generation progress, stop, retry, and failure messaging into Studio chrome.
4. Seed Context drawer data before or as each slide placeholder is created.
5. Remove Content-stage DOM, state, tests, and copy after live Studio generation covers stop, retry, partial output, and completion.
6. Update roadmap, status, screenshots, and demo copy that describe a separate Content phase.

## Non-Goals

- No removal of the Brief or Outline stages.
- No automatic application of slide variants.
- No direct editing of not-yet-generated slide specs.
- No model-owned file writes.
- No new rendering path outside the shared DOM runtime.
- No freeform canvas editor.

## Open Questions

- Should outline placeholders be selectable before their slide content exists, or should the rail keep focus on the latest completed slide?
- Should generation auto-select each newly completed slide, or preserve the author's current selection once they interact with Studio?
- Where should retry controls live: on each failed rail item, in the workflow status line, or both?
- Should Theme open automatically after the first few slides are generated, or wait until full deck completion?
- How much placeholder context should be editable before generation reaches that slide?
