# ADR 0041: Current Slide And Deck Planning Workbench Modularization

## Status

Proposed implementation plan.

## Context

After ADR 0040, `studio/client/app.ts` is down to about 3,800 lines and no longer owns variant review rendering, comparison, apply/capture actions, or variant button binding. It is now mostly a composition shell plus several remaining feature clusters.

A review of the remaining file shows three clusters that still carry too much direct behavior:

- current-slide editing: slide context fields, structured JSON editor preview/save, inline text editing, selection-scoped assistant capture, manual slide create/delete, material upload/attach/detach, and active preview editing hooks
- deck planning and source library: deck structure candidates, deck diff support, deck length planning, outline-plan rendering/actions, source add/delete, and shared deck-context apply behavior
- orchestration: runtime stream handling, page routing, refresh/load slide sequencing, status rendering, drawer wiring, and cross-workbench composition

The most immediate risk is current-slide editing because it mutates the active slide spec from several paths: JSON preview, JSON save, inline text edit, material attach/detach, manual slide create/delete, deck-length restore, and variant preview refresh. These paths all need to preserve active slide selection, DOM preview state, variant comparison invalidation, assistant selection validity, and render/status updates. Keeping them interleaved in `app.ts` makes it easy for one edit path to forget a sibling refresh or stale-selection clear.

The largest remaining rendering block is deck planning. `renderDeckStructureCandidates`, `renderDeckLengthPlan`, `renderOutlinePlans`, and related apply functions are independent enough to extract, but they share deck context, outline plans, source retrieval, presentation creation staging, and page navigation. That makes them a better second extraction after the current-slide editing boundary is stable.

## Decision Direction

Extract current-slide editing behavior from `app.ts` into `studio/client/slide-editor-workbench.ts`.

The slide editor workbench should own:

- selected slide context field rendering and save actions
- structured slide-spec editor parse, syntax highlighting, preview scheduling, draft error state, and save behavior
- active preview inline text editing and selected DOM text capture for assistant workflows
- selection path/hash helpers needed by inline edit and selection-scoped assistant capture
- manual system slide create/delete controls and form rendering
- material list rendering and material upload/attach/detach controls
- selected slide material lookup and slide material payload application

`app.ts` should provide shared dependencies:

- `state`, `elements`, `request`, `setBusy`, `escapeHtml`, `highlightJsonSource`, and file-reading helpers
- active slide loading and selection callbacks
- DOM preview state patching and slide preview rendering callbacks
- variant review refresh callbacks for comparison invalidation
- drawer/page/status callbacks needed after slide mutations

After slide editing is extracted, add `studio/client/deck-planning-workbench.ts`.

The deck planning workbench should own:

- deck structure candidate rendering, deck diff support, and apply actions
- deck length plan rendering, apply, and skipped-slide restore actions
- outline plan library rendering, JSON save, derive, live draft staging, propose, duplicate, archive, and delete actions
- source library rendering and add/delete actions
- pure deck-plan display helpers such as action labels, grouping, count helpers, and diff impact summaries

Keep runtime stream handling, page routing, `refreshState`, `loadSlide`, shared status rendering, and top-level workbench composition in `app.ts` until both workbench boundaries are stable. These functions still coordinate multiple modules and should remain visible at the shell level.

## Required Refactors

1. Add `studio/client/slide-editor-workbench.ts` and load it before `app.js`.
2. Move pure slide-path helpers first:
   `pathToArray`, `pathToString`, `canonicalJson`, `hashFieldValue`, `getSlideSpecPathValue`, `cloneSlideSpecWithPath`, and `normalizeInlineText`.
3. Move selected text and inline editing:
   `enableDomSlideTextEditing`, `selectElementText`, `clearAssistantSelection`, `getSelectionEditElement`, `getSelectionEditElements`, `buildSelectionEntry`, `captureAssistantSelection`, and `beginInlineTextEdit`.
4. Move structured slide editor behavior:
   `updateSlideSpecHighlight`, `parseSlideSpecEditor`, `previewSlideSpecEditorDraft`, `scheduleSlideSpecEditorPreview`, and `saveSlideSpec`.
5. Move current-slide side panels:
   `renderSlideFields`, `saveSlideContext`, `renderManualSlideForm`, `renderManualDeckEditOptions`, `setManualSlideDetailsOpen`, `createSystemSlide`, `deleteSlideFromDeck`, `renderMaterials`, `uploadMaterial`, `attachMaterialToSlide`, and `detachMaterialFromSlide`.
6. Add fixture checks that `app.ts` composes `slide-editor-workbench.ts` and no longer owns current-slide rendering, JSON editor, inline edit, or material actions.
7. Once slide editing is stable, add `studio/client/deck-planning-workbench.ts` and move deck planning/source-library rendering and actions.
8. Add fixture checks that `app.ts` composes `deck-planning-workbench.ts` and no longer owns deck structure candidate rendering, outline plan rendering/actions, deck length rendering/actions, or source-library actions.
9. Keep the browser-client dead-code gate in `validate:static` so removed wrappers do not return.

## Product And Architecture Rules

- The browser must not write slide files directly; all mutations continue through server endpoints.
- JSON editor preview may update local preview state, but save remains explicit.
- Inline text editing must preserve the same validation and server save boundary as the JSON editor.
- Selection-scoped assistant capture must keep field paths and hashes so stale apply checks remain possible.
- Material attach/detach must continue to update structured slide specs and DOM preview state together.
- Manual slide create/delete must preserve active slide selection, deck order, and archived-slide semantics.
- Deck planning candidates remain proposals until explicit apply.
- Deck plan apply must continue to expose shared deck setting changes as an explicit option.
- Source records remain presentation-scoped and should not become global library state in this extraction.

## Validation

Each implementation slice should run:

- `npm run typecheck`
- `npm run validate:dead-code`
- `npm run validate:client-fixture`
- `npm run validate:browser` when rendering, event binding, script loading, inline editing, or preview behavior changes

Run `npm run quality:gate` before moving this ADR to implemented.

## Non-Goals

- Do not introduce a browser bundler in this ADR; ADR 0036 still owns that decision.
- Do not rewrite the UI framework or introduce a frontend framework.
- Do not change server endpoints, slide spec schemas, variant semantics, deck planning semantics, or write boundaries.
- Do not extract runtime stream handling, page routing, or shared refresh into a generic framework in the same slice.

## Open Questions

- Should selection path/hash helpers live in `slide-editor-workbench.ts` or a shared pure helper module?
  - Answer: Start in `slide-editor-workbench.ts`. Extract a shared helper only if `variant-review-workbench.ts` or another module needs direct path/hash ownership beyond injected stale-check callbacks.
- Should deck length and outline plans be separate workbenches?
  - Answer: Not initially. They both operate on deck-level planning state and share current deck context, slide order, and apply/restore refresh behavior. Split them later only if the combined deck-planning workbench becomes hard to navigate.
- Should active preview rendering move out of `app.ts`?
  - Answer: Not yet. `renderPreviews` combines slide selection, live presentation creation status, custom layout preview state, selected variant preview state, and inline editing enablement. Keep it in `app.ts` until slide editing and deck planning no longer depend on its internals.
