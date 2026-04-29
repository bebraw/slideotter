# ADR 0038: Custom Layout Workbench Modularization

## Status

Proposed implementation plan.

## Context

`studio/client/app.ts` still owns a large amount of custom layout behavior:

- client-side construction of `slotRegionLayout` draft slots, regions, reading order, typography, and constraints
- custom layout editor rendering and map rendering
- Layout Studio list and selected-layout preview state
- custom layout preview calls and session-only candidate wiring
- layout-library import/export/apply controls

This creates several maintainability risks:

- Layout schema rules can drift between browser draft construction and server validation in `studio/server/services/layouts.ts`.
- `app.ts` remains responsible for both UI orchestration and layout-definition domain logic.
- Small custom layout UI changes require navigating unrelated slide, variant, presentation, and runtime code.
- Browser-generated draft definitions are harder to test than server-owned pure helpers.

ADR 0026 keeps custom layouts as guarded JSON layout definitions rendered through the shared DOM runtime. This ADR narrows the next maintenance slice: make custom layout authoring a focused workbench and move layout-definition draft construction to a server-owned or shared tested boundary.

## Decision Direction

Extract custom layout authoring from `app.ts` into a focused workbench module, and stop treating the browser as the authoritative constructor of layout-definition JSON.

The client should own:

- reading control values
- rendering the custom layout editor, map, and Layout Studio list
- preserving draft UI state
- sending explicit preview/apply/save requests
- showing candidate outcomes returned by the server

The server or shared layout service should own:

- supported slide-family slot definitions
- profile-to-region construction
- default constraints, media treatment, reading order, and typography mapping
- validation and normalization before preview, save, import, or apply

## Target Shape

Add or evolve these modules:

- `studio/server/services/layout-drafts.ts`: pure helpers for constructing normalized draft `slotRegionLayout` definitions from constrained inputs such as slide family, profile, spacing, and minimum font size.
- `studio/server/index.ts`: expose a small draft endpoint, or extend `/api/layouts/custom/preview` to accept constrained draft inputs and return the normalized definition it previewed.
- `studio/client/custom-layout-workbench.ts`: own custom layout editor rendering, layout map rendering, Layout Studio selection, draft JSON loading, preview actions, and layout import/export control wiring.
- `studio/client/app.ts`: compose the workbench and provide only shared dependencies such as state, elements, request, preview rendering, variant refresh hooks, and selected-slide helpers.

The existing layout persistence and apply boundaries remain unchanged. Custom layouts still preview as session-only candidates and become durable only through explicit save/apply actions.

## Required Refactors

1. Move draft layout construction out of `app.ts`.
   Replace `createCustomLayoutSlots`, `createCoverLayoutRegions`, `createContentLayoutRegions`, and most of `createCustomLayoutDefinitionFromControls` with server-owned or shared pure helpers.

2. Remove hidden DOM mutation during draft construction.
   Replace `createLayoutStudioDefinitionFromControls`, which temporarily mutates custom-layout controls, with a pure input object passed to the draft helper.

3. Extract browser custom layout workbench behavior.
   Move custom layout editor rendering, map rendering, Layout Studio list rendering, draft JSON parsing/loading, preview mode state, quick preview, and Layout Studio preview actions into `custom-layout-workbench.ts`.

4. Keep the JSON editor path.
   Advanced users can still paste/edit JSON, but the server must normalize and validate it before preview/save/apply.

5. Keep preview-before-apply behavior.
   Custom layout previews continue to produce normal session-only candidates, with existing variant comparison and apply boundaries.

## Product And Architecture Rules

- Custom layout definitions remain declarative JSON, not arbitrary CSS, HTML, SVG, JavaScript, or renderer plugins.
- The server remains authoritative for layout definition normalization, validation, persistence, and apply.
- The browser may render live local previews for responsiveness, but those previews are advisory until the server validates and returns a candidate.
- Draft construction must not hardcode deck-specific visible copy.
- New supported slide families must add server-side draft/validation coverage before browser controls expose them.
- Import/export document shapes continue to flow through existing layout library APIs.

## First Implementation Slice

1. Add server-side draft helpers and tests for content and cover `slotRegionLayout` definitions.
2. Update the custom layout preview endpoint to return the normalized definition it accepted.
3. Replace browser draft construction with a request or shared helper call.
4. Add fixture coverage that `app.ts` no longer owns slot/region factory functions.

This slice removes the riskiest client/server drift without changing the visible custom layout editor.

## Follow-Up Slices

1. Extract `custom-layout-workbench.ts` and load it before `app.js`.
2. Move layout map rendering and Layout Studio list rendering into the workbench.
3. Move custom layout preview, quick preview, and Layout Studio preview actions into the workbench.
4. Move layout-library import/export/apply event wiring into a layout workbench when it can be cleanly separated from variant save/apply hooks.
5. Move ADR 0038 to implemented after `app.ts` no longer owns custom layout draft construction or custom layout editor rendering.

## Validation

Each slice should run:

- `npm run typecheck`
- `npm run validate:client-fixture`
- targeted layout-definition tests
- `npm run validate:browser` when client script loading or custom layout UI behavior changes

Run `npm run quality:gate` before marking the ADR implemented.

## Open Questions

- Should draft construction be exposed through a standalone `/api/layouts/custom/draft` endpoint, or folded into `/api/layouts/custom/preview`?
- Should draft helpers live in `studio/server/services/layout-drafts.ts` only, or in a shared pure module once a browser build pipeline exists?
- Should Layout Studio and the slide-local custom layout editor remain one workbench module, or split after the draft construction boundary is server-owned?
