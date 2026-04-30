# ADR 0044: Strict TypeScript Typing

## Status

Proposed.

## Context

The repository already runs `npm run typecheck` in the quality gate, but `tsconfig.json` previously overrode parts of strict mode with `noImplicitAny: false`, `strictNullChecks: false`, and `useUnknownInCatchVariables: false`. That left a large historical backlog of implicit parameter, return, nullability, indexed-access, optional-property, and array types across the browser client, server services, scripts, and tests.

A direct zero-diagnostic compiler flip is not currently safe. Running the strict project compiler reports thousands of errors, with the largest clusters in server operations, server routing, presentation generation, browser workbenches, and high-risk service tests. Replacing those with explicit `any` annotations would make the compiler pass while preserving the same weak contracts.

Explicit `any` is also present in first-party TypeScript. Those usages are concentrated around state payloads, DOM event targets, API resources, generated candidate payloads, LLM responses, and test helpers.

## Decision

Move the codebase toward a zero-diagnostic strict TypeScript build and zero explicit `any`, but do it by typed subsystem slices rather than blanket annotations.

The migration rules are:

- Do not add new explicit `any` usages. Use narrow domain interfaces, `unknown` plus local guards, DOM types, or shared payload types instead.
- Keep the main `tsconfig.json` on strict compiler settings: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride`.
- Keep `npm run typecheck` baseline-gated while the historical strict diagnostics are paid down.
- Track the current explicit `any` count with an AST-based baseline so quality gates fail if new explicit `any` nodes are introduced.
- Track the current strict compiler diagnostics with a project compiler baseline so quality gates fail if the backlog grows.
- Reduce the explicit-any baseline only when a slice removes real unsafe types.
- Reduce the strict compiler baseline only when a slice removes real strict diagnostics.
- Prefer extracting shared studio payload and slide-spec types before typing the largest server/workflow modules.

## Migration Order

1. Browser client shell and workbench contracts: state, elements, DOM preview, workbench dependencies, event targets, and API response payloads.
2. Shared slide, layout, theme, validation, material, source, variant, and deck-plan payload types used by both server services and browser code.
3. Server service boundaries: route request bodies, operation options, LLM response shapes, generation artifacts, and write-boundary inputs.
4. Test and validation helpers, using the shared service payload types instead of local weak shapes.
5. Remove the strict compiler baseline once the project reaches zero strict diagnostics, remove the explicit-any baseline file, and keep the zero-explicit-any guard.

## Consequences

- The codebase gets an immediate guard against increasing explicit `any` usage.
- The codebase gets an immediate guard against increasing the strict compiler backlog.
- The project compiler options are strict now, but the historical diagnostics are baseline-gated until typed slices remove them.
- Type improvements should remove unsafe shapes rather than hide them behind project-wide permissive aliases.
- ADR implementation is complete only when the strict compiler baseline and explicit-any baseline both reach zero.

## Implementation Progress

- `tsconfig.json` now enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` without weaker strict-mode overrides.
- `npm run typecheck` and `npm run validate:type-safety` guard both explicit `any` and strict compiler diagnostics.
- The browser-client core helper, element registry, state, preference, app-theme, LLM status, slide-preview, assistant, preview, navigation, drawer, validation-report, API explorer, runtime-status, presentation-library, workflow runner, and theme workbench modules now have typed contracts.
- Diagram, documentation-link, geometry, render, text, media fixture, slide-spec fixture, slide-media fixture, deck-plan fixture, dead-code, hypermedia smoke, and slide migration scripts now have typed helper contracts.
- The active deck context reader, server build preview manifest helper, and generation diagnostic writer now type their boundaries.
- The explicit-any baseline is 228.
- The hypermedia smoke client now satisfies the strict project compiler with explicit resource, link, action, and error guards.
- The deck-plan and slide-media fixture validators now satisfy the strict project compiler with exact optional fixture shapes.
- Slide migration, archive update, documentation link, and dead-code validation scripts now satisfy the strict project compiler.
- The strict compiler baseline is 2,750.

## Validation

During the migration, use:

- `npm run typecheck`
- `npm run typecheck:strict` to inspect remaining raw strict compiler blockers
- `npm run validate:type-safety`
- `npm run quality:gate`
