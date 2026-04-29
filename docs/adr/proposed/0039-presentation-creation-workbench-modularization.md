# ADR 0039: Presentation Creation Workbench Modularization

## Status

Proposed implementation plan.

## Context

After ADR 0038, `studio/client/app.ts` is smaller but still owns a large staged-presentation-creation cluster:

- creation form field extraction, application, dirty tracking, and debounced draft saves
- stage access rules for brief, outline structure, content run, and theme review
- editable outline rendering, slide locks, source-outline previews, and single-slide regeneration controls
- presentation outline generation, approval, backtracking, and live content-run status rendering
- presentation list selection, create, duplicate, regenerate, and delete actions
- cross-calls into theme, content-run, source, and slide-selection rendering

This keeps one of the most user-visible workflows embedded in unrelated slide editing, variant review, layout, material, validation, and assistant code. It also makes creation-stage regressions likely because small changes must coordinate state updates, runtime events, saved drafts, outline locks, and page transitions manually.

ADR 0004 defines staged presentation creation, and ADR 0031 defines live Slide Studio generation after outline approval. This ADR narrows the next browser-client maintenance slice: extract staged creation into a focused workbench while keeping server generation and write boundaries unchanged.

## Decision Direction

Extract staged presentation creation from `app.ts` into `studio/client/presentation-creation-workbench.ts`.

The creation workbench should own:

- creation field selectors and field application
- creation stage state, access rules, and stage button rendering
- debounced creation draft persistence
- editable outline rendering, outline locks, outline dirty state, and outline source synchronization
- generate outline, regenerate outline slide, approve outline, and back-to-outline actions
- content-run view rendering for the staged creation flow
- create-presentation form controls and the post-creation handoff button

`app.ts` should compose the workbench and provide shared dependencies:

- state, elements, request/post helpers, busy state, and escaping
- page navigation and current-slide selection callbacks
- theme-workbench hooks for theme rendering/persistence
- content-run action mounting hooks until those controls have a clearer home
- global refresh/render callbacks for status, previews, slides, and presentations

The server remains authoritative for generating outlines, materializing slides, persisting drafts, validating slide specs, and writing presentation files.

## Target Shape

Add:

- `studio/client/presentation-creation-workbench.ts`: owns staged creation UI state, field mapping, outline editing, creation draft saves, outline generation/approval actions, and content-run rendering.

Keep for now:

- `studio/client/theme-workbench.ts`: remains the owner of theme candidate rendering and theme generation.
- `studio/client/content-run-actions.ts`: remains the owner of retry/stop/accept action event handling until content-run rendering and action mounting can be unified cleanly.
- `app.ts`: remains the shell for global navigation, runtime events, slide selection, and cross-workbench orchestration.

Later, if the presentation list remains large after creation extraction, split it into a separate `presentation-library.ts` module instead of expanding the creation workbench beyond staged-creation responsibilities.

## Required Refactors

1. Move creation field mapping into the workbench.
   Extract `getCreationFields`, `applyCreationFields`, creation input discovery, outline-relevant input detection, and draft-save scheduling.

2. Move stage and outline rendering into the workbench.
   Extract creation stage access, editable deck-plan outline rendering, outline locks, quick source outline rendering, creation draft rendering, and content-run rendering.

3. Move staged creation actions into the workbench.
   Extract presentation creation, draft save, outline generation, single-slide regeneration, approve outline, back-to-outline, and open-created-presentation behavior.

4. Keep theme generation separate.
   Creation theme controls should continue to call the existing theme workbench rather than merging theme candidate logic into the creation workbench.

5. Keep server write boundaries unchanged.
   The extraction must not make the browser construct or write slide files directly.

## Product And Architecture Rules

- The staged creation flow remains a guarded progression from brief to outline to content generation.
- Outline approval remains the write boundary for materializing slide files.
- Local browser state may preview and edit draft outline data, but the server remains authoritative for persisted creation drafts.
- Theme candidate generation stays server-owned through the existing theme workflow.
- The workbench must preserve partial content-run recovery, retry, stop, and partial-accept behavior.
- Existing browser validation coverage must continue to cover presentation create, material upload/attach, deck length scaling, duplicate, and delete flows.

## First Implementation Slice

1. Add `presentation-creation-workbench.ts` and load it before `app.js`. (Done.)
2. Move pure field mapping and creation-stage helper functions into the workbench. (Partially done: field mapping and outline-relevant input detection moved; stage access remains with rendering.)
3. Move creation input event mounting and debounced draft saving into the workbench. (Done.)
4. Add fixture coverage that `app.ts` composes the creation workbench and no longer owns creation field mapping. (Done.)

This slice should not change the visible creation flow.

## Follow-Up Slices

1. Move creation draft, stage, outline, and content-run rendering into the workbench.
2. Move outline generation, slide regeneration, approval, and backtracking actions into the workbench.
3. Move create/open-created-presentation behavior into the workbench.
4. Reassess whether presentation list rendering and duplicate/regenerate/delete actions should become `presentation-library.ts`.
5. Move ADR 0039 to implemented after `app.ts` no longer owns staged-creation field mapping, outline rendering, or staged-creation actions.

## Validation

Each slice should run:

- `npm run typecheck`
- `npm run validate:client-fixture`
- `npm run validate:browser` when event binding, script loading, or visible creation behavior changes

Run `npm run quality:gate` before marking the ADR implemented.

## Open Questions

- Should presentation list rendering move into the creation workbench, or become a separate presentation library module?
- Should content-run status rendering and content-run action mounting merge into the same module, or stay split between view and action helpers?
- Should outline plan generation in Deck Planning share helpers with staged creation outlines, or remain separate until duplication becomes concrete?
