# ADR 0038: Custom Layout Workbench Modularization

## Status

Implemented.

## Context

Before this ADR, `studio/client/app.ts` owned a large amount of custom layout behavior:

- custom layout draft requests and JSON editor state
- custom layout editor rendering and map rendering
- Layout Studio list and selected-layout preview state
- custom layout preview calls and session-only candidate wiring
- layout-library import/export/apply controls

This creates several maintainability risks:

- Layout schema rules can drift between browser draft construction and server validation in `studio/server/services/layouts.ts`.
- `app.ts` remains responsible for both UI orchestration and layout-definition domain logic.
- Small custom layout UI changes require navigating unrelated slide, variant, presentation, and runtime code.
- Workbench rendering and preview flows were harder to test while embedded in unrelated client orchestration.

ADR 0026 keeps custom layouts as guarded JSON layout definitions rendered through the shared DOM runtime. This ADR makes custom layout authoring a focused workbench and moves layout-definition draft construction to a server-owned tested boundary.

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

- `studio/server/services/layouts.ts`: pure helpers for constructing normalized draft `slotRegionLayout` definitions from constrained inputs such as slide family, profile, spacing, and minimum font size. A dedicated `layout-drafts.ts` file remains an optional organization cleanup, not a behavior requirement.
- `studio/server/index.ts`: expose a small `/api/layouts/custom/draft` endpoint so draft construction stays separate from preview candidate creation.
- `studio/client/custom-layout-workbench.ts`: own custom layout editor rendering, layout map rendering, Layout Studio selection, draft JSON loading, preview actions, and layout import/export control wiring.
- `studio/client/app.ts`: compose the workbench and provide only shared dependencies such as state, elements, request, preview rendering, variant refresh hooks, and selected-slide helpers.

The existing layout persistence and apply boundaries remain unchanged. Custom layouts still preview as session-only candidates and become durable only through explicit save/apply actions.

## Required Refactors

1. Move draft layout construction out of `app.ts`. (Done.)
   Replace `createCustomLayoutSlots`, `createCoverLayoutRegions`, `createContentLayoutRegions`, and most of `createCustomLayoutDefinitionFromControls` with server-owned or shared pure helpers.

2. Remove hidden DOM mutation during draft construction. (Done.)
   Replace `createLayoutStudioDefinitionFromControls`, which temporarily mutates custom-layout controls, with a pure input object passed to the draft helper.

3. Extract browser custom layout workbench behavior. (Done.)
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

1. Add server-side draft helpers and tests for content and cover `slotRegionLayout` definitions. (Done.)
2. Expose a standalone `/api/layouts/custom/draft` endpoint that returns the normalized draft definition without creating a preview candidate. (Done.)
3. Replace browser draft construction with a request or shared helper call. (Done.)
4. Add fixture coverage that `app.ts` no longer owns slot/region factory functions. (Done.)

This slice removes the riskiest client/server drift without changing the visible custom layout editor.

## Follow-Up Slices

1. Extract `custom-layout-workbench.ts` and load it before `app.js`. (Done.)
2. Move layout map rendering and Layout Studio list rendering into the workbench. (Done.)
3. Move custom layout preview, quick preview, and Layout Studio preview actions into the workbench. (Done.)
4. Move layout-library import/export/apply event wiring into the workbench while leaving variant-card save buttons in `app.ts`, where variant rendering owns the button instances. (Done.)

## Validation

Completed validation:

- `npm run typecheck`
- `npm run validate:client-fixture`
- targeted layout-definition tests
- `npm run validate:browser`
- `npm run quality:gate`

## Open Questions

- Answer: Draft construction should use a standalone `/api/layouts/custom/draft` endpoint. Drafting answers what normalized layout definition the constrained controls produce; preview answers what candidate that definition produces on slide content. Keeping those paths separate avoids preview side effects during live draft refresh and keeps tests focused.
- Answer: Draft helpers should remain server-owned for now. A dedicated `studio/server/services/layout-drafts.ts` is the next organization cleanup, but shared browser/server modules should wait until a browser build pipeline exists and there is real duplication to remove.
- Answer: Layout Studio and the slide-local custom layout editor should start as one `custom-layout-workbench.ts`. They share draft controls, map rendering, selected-slide rules, JSON parsing, preview calls, and status handling. Split them later only if the extracted module still has clear independent responsibilities.
