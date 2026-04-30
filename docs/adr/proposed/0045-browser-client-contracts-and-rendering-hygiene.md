# ADR 0045: Browser Client Contracts And Rendering Hygiene

## Status

Proposed.

## Context

ADR 0035 through ADR 0043 split the browser client out of the original `app.ts` monolith into feature workbenches for presentation creation, theme control, custom layout authoring, variant review, current-slide editing, deck planning, runtime diagnostics, navigation, preview orchestration, and assistant behavior.

That split improved file ownership, and ADR 0044 later removed the repo-wide strict TypeScript backlog. The client still has contract and rendering hygiene work that is worth tracking separately:

- Workbench dependency objects still vary in how narrowly they describe callbacks, API payloads, and peer workbench references.
- `request<T>()` and `postJson<TBody, TResponse>()` are generic, but many callers still use broad payload shapes instead of endpoint-family contracts.
- `app.ts` still owns broad command mounting for unrelated feature areas.
- Many repeated UI fragments are rendered with `innerHTML`; most call sites escape dynamic text today, but the broad surface makes future regressions easy.

ADR 0044 covers the repo-wide strict TypeScript migration. This ADR narrows the next browser-client maintenance direction so typing work lands in useful seams instead of replacing weak implicit types with equally weak explicit annotations.

## Decision

Keep `app.ts` as the composition shell, but strengthen browser-client boundaries in this order:

1. Type the shared client state and element registry.
   - Export `StudioClientState.State` from `state.ts`.
   - Export `StudioClientElements.Elements` from `elements.ts`.
   - Replace `const state: any` and `Record<string, any>` in `app.ts` and workbench dependencies with those shared types.
2. Add typed workbench contracts.
   - Each `create*Workbench` function should expose a local dependency type and a returned API type.
   - Workbenches should depend on small callback interfaces instead of whole peer workbench objects when only one or two methods are needed.
3. Type client API payloads by endpoint family.
   - Add shared client-side interfaces for `/api/state`, `/api/context`, `/api/slides/:id`, validation, runtime, workflow candidate responses, theme responses, and assistant responses.
   - Keep `request<T>()` and `postJson<TBody, TResponse>()` generic, with callers choosing endpoint-specific response types.
4. Move remaining command mounting to owning modules.
   - Creation-outline controls should mount from `presentation-creation-workbench.ts`.
   - Theme controls should mount from `theme-workbench.ts`.
   - Validation and deck-context controls may stay in `app.ts` until they get their own typed shell or workbench.
5. Reduce `innerHTML` for repeated dynamic UI.
   - Prefer `createDomElement` or small typed render helpers for repeated cards, lists, action rows, and message blocks.
   - Keep `innerHTML` only for static skeletons or markup produced by trusted renderer helpers that deliberately return escaped HTML.

## Rules

- Do not introduce broad aliases such as `JsonAny`, `ClientAny`, or `WorkbenchAny` to make the strict-typing migration appear complete.
- Preserve the server write boundary. Client types describe payloads; they do not authorize client-side writes.
- Keep Vite module imports explicit. Do not restore global namespace loading as a way to avoid dependency types.
- DOM helpers must distinguish text content, attributes, dataset values, and trusted markup.
- When converting `innerHTML`, keep the UI behavior and visual structure stable unless the slice is explicitly a design change.

## Implementation Slices

1. Add shared client state and element registry types, then update `app.ts`, `preview-workbench.ts`, `navigation-shell.ts`, `runtime-status-workbench.ts`, and `assistant-workbench.ts`.
2. Add generic `request<T>()` and `postJson<TBody, TResponse>()`, then type the most common payloads: state refresh, slide load, context save, build, and validation.
3. Type the workflow candidate payloads used by variant review, assistant actions, deck structure, and theme generation.
4. Move creation-outline event mounting out of `app.ts` once presentation creation exposes typed mount callbacks.
5. Replace high-churn repeated `innerHTML` list rendering in presentation cards, assistant messages, variant cards, deck-plan cards, and source/material lists with typed DOM helpers.
6. Keep the ADR 0044 zero-explicit-`any` and zero-strict-diagnostic guards passing after each slice.

## Implementation Progress

- Shared core helpers now have typed DOM lookup, request option, busy-state, escaping, source-formatting, and DOM-construction contracts.
- `StudioClientElements.Elements` and `StudioClientElements.StudioElement` now describe the element registry used by `app.ts`.
- `app.ts`, `preview-workbench.ts`, `navigation-shell.ts`, `runtime-status-workbench.ts`, and `assistant-workbench.ts` now consume the typed element registry.
- `request<T>()` and `postJson<TBody, TResponse>()` now default to `unknown` and support caller-provided response contracts.
- Presentation creation now owns its outline, stage, content-run, and create/open command mounting instead of wiring those controls from `app.ts`.
- Theme workbench now owns theme-field input/change mounting instead of wiring those controls from `app.ts`.
- Presentation library cards and empty states now render through typed DOM builders instead of dynamic `innerHTML`.
- Assistant suggestions, messages, empty states, and selection chips now render through typed DOM builders instead of dynamic `innerHTML`.
- Slide editor material cards and empty states now render through typed DOM builders instead of dynamic `innerHTML`.
- Deck Planning source-library cards and empty states now render through typed DOM builders instead of dynamic `innerHTML`.
- Deck Planning outline-plan cards and empty states now render their repeated card shell through typed DOM builders.
- Deck Planning length-plan summaries, action cards, and restore cards now render through typed DOM builders instead of dynamic `innerHTML`.
- Variant review cards and empty states now render through typed DOM builders instead of dynamic `innerHTML`.
- API explorer resource summaries, state previews, link rows, and action rows now render through typed DOM builders instead of dynamic `innerHTML`.
- Validation summary cards now render through typed DOM builders instead of dynamic `innerHTML`.
- Preview thumbnail buttons now render through typed DOM builders instead of dynamic `innerHTML`.
- Slide preview fallback images now render through typed DOM builders instead of dynamic `innerHTML`; DOM slide output remains trusted renderer markup.
- Runtime workflow-history, source-retrieval, and prompt-budget diagnostics now render repeated cards through typed DOM builders instead of dynamic `innerHTML`.
- Theme review, candidate, preview, favorite, and saved-theme option rendering now use typed DOM builders instead of dynamic `innerHTML`.
- Presentation creation stage command mounting now binds to `[data-creation-stage]` buttons from the owning workbench, restoring stage navigation under browser validation.
- Custom layout library options, layout maps, layout-studio cards, and unsupported-state notes now render through typed DOM builders instead of dynamic `innerHTML`.
- Slide editor manual slide and material select options now render through typed DOM builders instead of dynamic `innerHTML`.
- Runtime LLM status notes now render through typed DOM builders instead of dynamic `innerHTML`.
- Presentation creation source-outline and source-evidence panels now render through typed DOM builders instead of dynamic `innerHTML`.
- Presentation creation editable outline cards now render through typed DOM builders instead of dynamic `innerHTML`.
- Presentation creation content-run status, rail, actions, and placeholder preview now render through typed DOM builders instead of dynamic `innerHTML`.
- ADR 0044 now has zero explicit `any` nodes and zero strict compiler diagnostics, so browser-client slices must keep those guards passing directly.

## Consequences

- Client modularization becomes enforceable by TypeScript instead of only by file boundaries.
- The strict-typing migration gets a practical browser-client path that removes real weak contracts.
- API shape drift should become visible at compile time for common client paths.
- UI rendering becomes less dependent on every individual call site remembering to escape dynamic text.
- The migration will require small repeated edits across feature modules, so slices should stay narrow and validated with `npm run validate:browser` when behavior changes.

## Validation

Use:

- `npm run typecheck`
- `npm run validate:type-safety`
- `npm run validate:client-fixture`
- `npm run validate:browser` when event binding, API payload handling, or rendered UI changes
- `npm run quality:gate` before moving this ADR to implemented
