# ADR 0040: Variant Review And Slide Editing Workbench Modularization

## Status

Proposed implementation plan.

## Context

After ADR 0039, `studio/client/app.ts` no longer owns staged presentation creation, the presentation library, theme workbench internals, custom layout authoring, drawer mechanics, validation rendering, LLM status, or slide preview rendering. The file is still large, around 4,800 lines, and now acts as a shell plus several remaining feature clusters.

The most important remaining clusters are:

- inline slide text selection and selection-scoped assistant editing
- variant list rendering, variant comparison, structured diffing, stale-selection detection, and variant apply/save actions
- current-slide form rendering, JSON editor preview/save, manual slide create/delete, and material attach/detach
- deck planning, outline-plan library actions, source library actions, deck-length controls, and deck context saves
- global runtime stream handling, page routing, shared refresh, and cross-workbench orchestration

The largest maintainability risk is the variant review/comparison cluster. It mixes pure diff helpers, structured slide comparison, DOM rendering, workflow history/status, variant selection state, layout-library save actions, and apply/capture actions in one part of `app.ts`. Small changes to variant review can accidentally affect slide preview selection, workflow state, assistant selection, or layout save behavior.

The new browser-client dead-code gate catches unused frontend functions, but it does not reduce coupling. The next maintenance slice should continue the ADR 0035 pattern: extract coherent feature workbenches while keeping `app.ts` as composition and cross-workbench coordination.

## Decision Direction

Extract variant review and comparison behavior from `app.ts` into `studio/client/variant-review-workbench.ts`.

The variant review workbench should own:

- slide variant collection and selected-variant lookup
- variant list rendering and original/candidate preview selection
- variant kind labels, persistence notes, and variant storage summary text
- source and structured comparison rendering
- stale selection detection and decision-support rendering
- variant apply/capture/save-layout/save-favorite actions
- variant review open/close controls and comparison scroll synchronization

`app.ts` should provide shared dependencies:

- `state`, `elements`, `request`, `setBusy`, `escapeHtml`, `formatSourceCode`, and DOM element builders
- current slide loading/selection callbacks
- slide preview rendering callbacks
- workflow runner callbacks where variant generation remains shared
- custom layout workbench hooks for layout-library save behavior

Keep runtime event handling, page navigation, shared refresh, and cross-workbench status rendering in `app.ts` until the variant workbench boundary is stable.

## Follow-Up Direction

After variant review is extracted, split the current-slide editing cluster into `studio/client/slide-editor-workbench.ts`.

The slide editor workbench should own:

- current slide field rendering and context save actions
- structured JSON editor parse, preview, schedule, and save behavior
- manual system slide create/delete controls
- material list rendering and material upload/attach/detach controls
- inline text edit capture only after selection-scoped assistant boundaries are clear

Deck planning and source-library behavior should remain in `app.ts` until variant review and slide editing are extracted. Those flows share deck context, source retrieval, outline plans, and page-level navigation enough that they deserve a separate ADR or later slice rather than being mixed into this one.

## Required Refactors

1. Add `studio/client/variant-review-workbench.ts` and load it before `app.js`.
2. Move pure variant helpers first:
   `getSlideVariants`, `getSelectedVariant`, `describeVariantKind`, `getVariantSelectionEntries`, `getVariantSelectionStaleReason`, source serialization helpers, and structured comparison helpers.
3. Move variant rendering:
   `renderVariants`, `renderVariantFlow`, `renderVariantComparison`, and decision-support rendering.
4. Move variant actions:
   `exitVariantReview`, `openVariantGenerationControls`, `captureVariant`, `applyVariantById`, and layout save actions.
5. Keep workflow generation functions in `app.ts` until the workbench owns enough action state to accept runner callbacks cleanly.
6. Add fixture checks that `app.ts` composes `variant-review-workbench.ts` and no longer owns variant rendering or comparison helpers.
7. Keep the browser-client dead-code gate in `validate:static` so removed wrappers do not return.

## Product And Architecture Rules

- Variant candidates remain session-only until explicit apply or save.
- Stale selection checks must continue to block unsafe apply actions.
- Structured diff and decision-support summaries must remain visible before applying candidates.
- Layout favorite saves must still require favorite-ready layout previews.
- Applying a candidate must preserve active slide selection and current presentation state.
- The workbench must not write slide files directly; all writes continue through server endpoints.

## Validation

Each implementation slice should run:

- `npm run typecheck`
- `npm run validate:dead-code`
- `npm run validate:client-fixture`
- `npm run validate:browser` when rendering, event binding, or script loading changes

Run `npm run quality:gate` before moving this ADR to implemented.

## Open Questions

- Answer: Variant generation button mounting should move into the variant workbench together with rendering, but workflow runner implementation can stay in `StudioClientWorkflows`. The workbench should own UI events and call injected runner callbacks for slide ideation, theme ideation, structure ideation, and layout redo.
- Answer: Selection-scoped assistant capture should remain separate for now. It touches assistant input, inline text editing, field-path hashing, and selected DOM text. Variant review should consume only the selection metadata needed for stale checks, and shared path/hash helpers can move later if both modules need them.
- Answer: Source-diff and structured-diff helpers should become shared pure helpers only once `slide-editor-workbench.ts` needs similar JSON comparison behavior. For the first variant-review extraction, keep them inside `variant-review-workbench.ts`; extract to a shared comparison module when there is a second concrete consumer.
