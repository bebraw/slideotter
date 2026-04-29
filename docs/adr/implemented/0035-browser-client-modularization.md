# ADR 0035: Browser Client Modularization

## Status

Implemented.

## Context

The browser studio client is currently concentrated in `studio/client/app.ts`. That file owns global state, DOM element lookup, page routing, drawer state, slide preview rendering, variant review, presentation creation, layout tooling, deck planning, validation, API calls, and event binding.

This kept the early studio easy to ship because all behavior was visible in one place. It is now a maintenance risk:

- unrelated features share one mutable `state` object
- most DOM references are untyped and assumed to exist
- long-running API calls can update state after the user has moved to another slide or workflow
- repeated workflow handlers update previews, runtime, variants, status, and review state by hand
- drawer open/close behavior is duplicated across several setter/render pairs
- event binding sits at the bottom of the file as a large imperative block

The goal is not to introduce a frontend framework. The studio still benefits from a small browser-native TypeScript client. The problem is ownership and repeatability, not the absence of React, Vue, or another runtime.

## Decision Direction

Modularize the browser client around feature ownership while keeping the current server API, DOM-first renderer, and plain TypeScript runtime.

`studio/client/app.ts` should become a thin composition entrypoint that:

- initializes typed DOM references
- initializes shared application state
- wires feature modules together
- starts the initial state refresh

Feature modules should own their local rendering, event binding, and state transitions where possible. Shared helpers should cover common API, busy-state, stale-response, candidate-workflow, and drawer behavior.

## Target Shape

Split the current browser client incrementally into modules such as:

- `client/state.ts`: shared state shape, initialization, narrow update helpers, and selectors
- `client/elements.ts`: typed required and optional DOM lookup helpers
- `client/api.ts`: `request`, workflow request wrappers, and stale-response or abort helpers
- `client/drawers.ts`: drawer registry, mutual exclusion, persistence, body classes, and ARIA updates
- `client/dom-preview.ts`: DOM slide preview rendering, selection capture, and inline text editing
- `client/variants.ts`: candidate rail, compare view, apply flow, and shared candidate workflow payload handling
- `client/deck-planning.ts`: deck length, deck-structure candidates, outline plans, and plan apply flow
- `client/presentation-create.ts`: staged creation, outline editing, theme selection, and live content run UI
- `client/layout-tools.ts`: layout library, custom layout authoring, and layout studio controls
- `client/validation.ts`: check controls and check report rendering

The split should follow current behavior boundaries. It should not change storage, rendering, validation, or apply semantics.

## Required Refactors

Start with low-risk extractions that reduce duplication before moving large feature bodies:

1. Add typed DOM lookup helpers.
   Required elements should fail fast with a clear startup error. Optional elements should be explicitly typed as nullable so feature modules handle absence intentionally.

2. Add a common workflow runner.
   Shared helpers should cover busy-button state, request execution, error surfacing, and final render refresh. Candidate-producing slide workflows should use one path for updating `previews`, `runtime`, transient variants, saved variants, selected variant, and variant review state.

3. Add stale-response guards for slide and workflow requests.
   `loadSlide` and long-running generation calls should ignore or abort outdated responses when the selected slide or active workflow changes before the response returns.

4. Replace duplicated drawer setters with a drawer registry.
   Opening one mutually exclusive drawer should close the others, persist only the drawers that have preferences, and update body classes/ARIA in one place.

5. Move feature event binding beside feature rendering.
   Each module should expose a small `mount...()` function that binds its controls and returns nothing. The entrypoint should call these mounts once.

6. Move feature rendering into modules after shared helpers exist.
   Avoid a broad mechanical split before common state and workflow helpers are in place; otherwise duplication will simply move into several files.

## Product And Architecture Rules

- Keep the browser client framework-free unless a separate ADR changes that.
- Keep the shared DOM renderer authoritative for slide previews.
- Keep generated candidates session-only until explicitly applied.
- Keep all persistent writes behind server APIs.
- Do not introduce client-side schema authority that can drift from server validation.
- Do not weaken the current compare-before-apply model.
- Preserve keyboard, drawer, and browser workflow behavior during the split.

## First Implementation Slice

The first useful slice should be small enough to review safely:

1. Fix deck-structure generation to send the requested candidate count.
2. Add `applySlideWorkflowPayload(payload, slideId)` for slide candidate workflows.
3. Replace `ideateSlide`, `ideateTheme`, `ideateStructure`, and `redoLayout` with one shared `runSlideCandidateWorkflow` helper.
4. Add a stale-response token to `loadSlide`.
5. Add tests or browser workflow coverage for candidate count and rapid slide selection if practical.

This slice reduces real duplication and closes an observed behavior bug before a larger file split.

## Validation

Each slice should run:

- `npm run typecheck`
- `npm test`
- `npm run quality:gate`

If a slice changes rendered output, refresh the relevant baseline with `npm run baseline:render` before rerunning the gate.

## Resolved Questions

- Feature modules should share one app state object initially, but should access and mutate it through explicit selectors and update helpers rather than open-ended direct writes. This keeps the split incremental while creating clearer ownership boundaries.
- Stale workflow handling should use both `AbortController` and request sequence tokens. Abort controllers cancel superseded requests where possible; sequence tokens prevent late responses from mutating state when cancellation is unavailable or races with completion.
- DOM rendering should move gradually. Keep template strings for simple static markup, but use small element builders for repeated dynamic markup and user/model-sourced content where escaping or event binding mistakes are most likely.
