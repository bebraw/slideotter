# ADR 0044: Strict TypeScript Typing

## Status

Proposed.

## Context

The repository already runs `npm run typecheck` in the quality gate, but `tsconfig.json` still sets `noImplicitAny` to `false`. That leaves a large historical backlog of implicit parameter, return, and array types across the browser client, server services, scripts, and tests.

A direct compiler flip is not currently safe. Running `npm run typecheck -- --noImplicitAny true --pretty false` reports thousands of errors, with the largest clusters in server operations, server routing, presentation generation, browser workbenches, and high-risk service tests. Replacing those with explicit `any` annotations would make the compiler pass while preserving the same weak contracts.

Explicit `any` is also present in first-party TypeScript. Those usages are concentrated around state payloads, DOM event targets, API resources, generated candidate payloads, LLM responses, and test helpers.

## Decision

Move the codebase toward `noImplicitAny: true` and zero explicit `any`, but do it by typed subsystem slices rather than blanket annotations.

The migration rules are:

- Do not add new explicit `any` usages. Use narrow domain interfaces, `unknown` plus local guards, DOM types, or shared payload types instead.
- Keep `npm run typecheck:strict` as the migration command for the full backlog until it can replace the regular typecheck path.
- Track the current explicit `any` count with an AST-based baseline so quality gates fail if new explicit `any` nodes are introduced.
- Track the current strict compiler diagnostics with a `noImplicitAny` baseline so quality gates fail if the implicit-any backlog grows.
- Reduce the explicit-any baseline only when a slice removes real unsafe types.
- Reduce the strict compiler baseline only when a slice removes real strict diagnostics.
- Flip `tsconfig.json` to `"noImplicitAny": true` only after the implicit backlog is small enough to remove without adding weak substitute aliases.
- Prefer extracting shared studio payload and slide-spec types before typing the largest server/workflow modules.

## Migration Order

1. Browser client shell and workbench contracts: state, elements, DOM preview, workbench dependencies, event targets, and API response payloads.
2. Shared slide, layout, theme, validation, material, source, variant, and deck-plan payload types used by both server services and browser code.
3. Server service boundaries: route request bodies, operation options, LLM response shapes, generation artifacts, and write-boundary inputs.
4. Test and validation helpers, using the shared service payload types instead of local weak shapes.
5. Turn on `noImplicitAny` in `tsconfig.json`, remove the explicit-any baseline file, and keep the zero-explicit-any guard.

## Consequences

- The codebase gets an immediate guard against increasing explicit `any` usage.
- The codebase gets an immediate guard against increasing the strict `noImplicitAny` backlog.
- The full strict compiler flip remains visible and runnable, but it does not block unrelated work until the typed slices land.
- Type improvements should remove unsafe shapes rather than hide them behind project-wide permissive aliases.
- ADR implementation is complete only when `noImplicitAny` is enabled in the main `tsconfig.json` and the explicit-any baseline reaches zero.

## Validation

During the migration, use:

- `npm run typecheck`
- `npm run typecheck:strict` to inspect remaining implicit-any blockers
- `npm run validate:type-safety`
- `npm run quality:gate`
