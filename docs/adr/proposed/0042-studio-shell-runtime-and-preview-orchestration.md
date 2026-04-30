# ADR 0042: Studio Shell Runtime And Preview Orchestration

## Status

Proposed implementation plan.

## Context

After ADR 0041, `studio/client/app.ts` is about 2,000 lines. The largest feature surfaces now live in dedicated browser scripts:

- presentation creation and presentation library
- theme workbench
- custom layout workbench
- variant review workbench
- slide editor workbench
- deck planning workbench
- validation report, slide preview, drawer controller, LLM status, API Explorer, state, elements, preferences, and workflow runners

The remaining `app.ts` is closer to a shell, but it still has several orchestration clusters that are easy to damage because they coordinate many workbenches at once:

- composition and dependency wiring for all feature factories
- global status rendering and button enablement
- runtime event stream handling, workflow history, source retrieval diagnostics, prompt budget diagnostics, and creation-draft stream reactions
- page routing, drawer registry setup, drawer preference persistence, global escape/hash/click handling, and startup initialization
- active preview and thumbnail rendering across selected slide state, live content-run status, custom layout preview, selected variant preview, and inline editing
- refresh and selected-slide loading, including DOM preview state, variants, assistant selection, custom layout state, presentation library state, outline plans, sources, materials, skipped slides, and hypermedia resources

The next maintainability risk is not another feature extraction. It is that `app.ts` is both a composition root and the owner of runtime shell behavior. A change to runtime updates, page routing, or preview selection can accidentally affect workbench rendering order, stale slide selection, live deck creation, variant comparison, custom layout preview, or assistant selection.

## Decision Direction

Keep `app.ts` as the composition root, but extract shell-level orchestration into smaller modules with explicit APIs.

Add `studio/client/runtime-status-workbench.ts`.

This module should own:

- `renderStatus`
- LLM popover state helpers
- workflow history rendering
- source retrieval diagnostics rendering
- prompt budget diagnostics rendering
- runtime stream connection and event parsing
- runtime workflow updates and operation status text
- creation draft stream updates that do not require full app refresh decisions
- LLM provider check action

Add `studio/client/navigation-shell.ts`.

This module should own:

- page visibility and nav active state rendering
- current-page preference loading/persistence
- validation panel open/close state
- drawer registry configuration and drawer open/close helpers
- global Escape handling, document click handling for popovers, and hashchange handling
- mounting of shell navigation, drawer, and popover controls

Add `studio/client/preview-workbench.ts` only after the runtime and navigation boundaries are stable.

The preview workbench should own:

- active preview rendering
- thumbnail rail rendering
- selected variant/custom layout/live content-run preview arbitration
- thumbnail click handling through an injected slide-selection callback
- preserving thumbnail rail scroll position

Keep `refreshState`, `loadSlide`, `syncSelectedSlideToActiveList`, and top-level factory composition in `app.ts` until the preview boundary is stable. These functions still define the cross-workbench refresh order and are the safest place to see the whole state transition.

## Required Refactors

1. Add `studio/client/runtime-status-workbench.ts` and load it before `app.js`.
2. Move runtime diagnostics first:
   `describeWorkflowProgress`, `renderWorkflowHistory`, `renderSourceRetrieval`, `formatCharCount`, `renderPromptBudget`, and API Explorer render delegation if needed.
3. Move runtime stream behavior:
   `applyRuntimeUpdate`, `applyWorkflowEvent`, `applyCreationDraftUpdate`, and `connectRuntimeStream`.
4. Move LLM status behavior:
   `renderStatus`, `setLlmPopoverOpen`, `toggleLlmPopover`, and `checkLlmProvider`.
5. Add fixture checks that `app.ts` composes `runtime-status-workbench.ts` and no longer owns runtime diagnostics or stream parsing.
6. Add `studio/client/navigation-shell.ts` and load it before `app.js`.
7. Move page and drawer shell behavior:
   current-page preference helpers, drawer preference helpers, `renderPages`, `setCurrentPage`, `setChecksPanelOpen`, drawer registry configuration, drawer open helpers, and global shell event mounting.
8. Add fixture checks that `app.ts` composes `navigation-shell.ts` and no longer owns page visibility, drawer registry, or shell global event binding.
9. Reassess `renderPreviews` after the first two modules land. If its dependencies are stable, add `studio/client/preview-workbench.ts` and move active preview plus thumbnail rail rendering.
10. Keep `refreshState` and `loadSlide` in `app.ts` unless a later ADR defines an application state coordinator.

## Product And Architecture Rules

- Do not change page names, URL hash behavior, drawer mutual exclusion, or persisted page/drawer preferences.
- Runtime stream updates must remain best-effort and resilient to malformed events.
- Operation status text must continue to reflect workflow progress without blocking user actions.
- LLM diagnostics must stay reachable through the existing popover and debug drawer.
- Active preview and thumbnail rail must continue to use the shared DOM renderer first, with rendered image fallback when structured DOM data is unavailable.
- Variant preview, custom layout preview, live content-run state, and inline editing must keep their current precedence.
- `refreshState` must continue to fetch `/api/state`, `/api/v1`, and the active presentation resource before rendering dependent workbenches.
- `loadSlide` must keep abortable request protection and must clear stale transient variants and assistant selection when appropriate.

## Validation

Each implementation slice should run:

- `npm run typecheck`
- `npm run validate:dead-code`
- `npm run validate:client-fixture`
- `npm run validate:browser` when runtime stream, page routing, drawers, event binding, or preview rendering changes

Run `npm run quality:gate` before moving this ADR to implemented.

## Non-Goals

- Do not introduce a browser bundler in this ADR; ADR 0036 still owns that decision.
- Do not change server endpoints, runtime stream payloads, or hypermedia resources.
- Do not change slide rendering semantics, preview precedence, validation behavior, or write boundaries.
- Do not hide all cross-workbench dependencies behind a generic event bus. Prefer explicit injected callbacks until a concrete event-bus problem exists.
- Do not move `refreshState` or `loadSlide` prematurely. They are still the app-level state transition spine.

## Open Questions

- Should `runtime-status-workbench.ts` own `checkLlmProvider`?
  - Proposed answer: Yes. The action only mutates runtime/LLM checking state and re-renders LLM status, so it belongs with runtime diagnostics rather than the app shell.
- Should drawer configuration live in `navigation-shell.ts` even though some drawers call feature workbenches?
  - Proposed answer: Yes. The drawer registry is shell behavior. Feature-specific callbacks such as `customLayoutWorkbench.renderEditor` and `renderCreationThemeStage` should be injected into the navigation shell.
- Should `renderPreviews` move in the same slice as navigation?
  - Proposed answer: No. Preview rendering is the most cross-cutting remaining function. Move runtime and navigation first, then extract preview rendering only after the dependency list stops changing.
