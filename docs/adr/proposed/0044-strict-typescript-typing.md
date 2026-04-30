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
- The explicit-any baseline is 150.
- The hypermedia smoke client now satisfies the strict project compiler with explicit resource, link, action, and error guards.
- The deck-plan and slide-media fixture validators now satisfy the strict project compiler with exact optional fixture shapes.
- Slide migration, archive update, documentation link, and dead-code validation scripts now satisfy the strict project compiler.
- Runtime-config and selection-scope tests now type their local helpers and action descriptors under the strict project compiler.
- Layout definition tests now type their normalized slot and region assertion helpers under the strict project compiler.
- API negative tests now type their local HTTP helpers, presentation summaries, and mocked LLM request guards under the strict project compiler.
- Hypermedia API tests now type versioned resource, link, action, schema, candidate, and response helpers under the strict project compiler.
- Assistant workbench, slide preview, and workflow runner client modules now handle strict DOM, exact optional render options, and optional payload defaults.
- API explorer, drawer controller, and theme workbench client modules now satisfy strict indexed access and unknown-error checks.
- Design constraints, DOM preview, and validation server services now use typed option, error, and deck-context boundaries.
- Environment, session, and page artifact server utilities now use typed file, JSON, message, and image composition helpers.
- Runtime configuration now uses typed path, initialization, and runtime mode contracts.
- Theme candidate generation now uses typed visual-theme, candidate, and request-field contracts.
- Write-boundary and baseline-render utilities now type path, file, removal, metadata, and raw image comparison helpers.
- Variant storage now uses typed variant records, source parsing, structured slide specs, and update/apply boundaries.
- Deck context state now uses typed deck, slide-context, structure-plan, and variant-store boundaries.
- Image search now uses typed provider, option, restriction, and normalized remote-result boundaries.
- Material storage now uses typed store, parsed-image, remote import, and generation-context boundaries.
- Deck theme normalization now uses typed color, contrast, font-family, and visual-theme boundaries.
- Source storage and retrieval now use typed source-store, inline-source, snippet, prompt-budget, and fetch boundaries.
- Slide storage now uses typed slide options, slide info, structured-sort metadata, slide specs, and archive/skip operations.
- Assistant routing now uses typed message, selection, slide summary, validation, and workflow-result boundaries.
- Selection scope helpers now use typed field paths, selection entries, selection groups, stale checks, and scoped patch merges.
- Theme generation now uses typed RGB, semantic color anchor, visual-theme, and LLM theme response boundaries.
- Layout storage and exchange now use typed layout, definition, slot, region, runtime, import/export, and photo-grid ordering boundaries.
- Deck length planning now uses typed slide, slide-spec, length-action, semantic-action, planning-option, and apply/restore boundaries.
- Hypermedia resources now use typed links, actions, stale-version errors, runtime workflow state, schema keys, and variant/presentation resource boundaries.
- LLM client now uses typed provider config, structured-response options/results, prompt budgets, progress events, streamed payloads, model listing, and error-message boundaries.
- DOM validation now uses typed browser-evaluated geometry, text, media, caption, issue, color, and validation-option boundaries.
- LLM prompt and schema helpers now use typed prompt options, projected deck/slide context, and JSON schema builder boundaries.
- DOM export now uses typed preview-state, slide-entry, and Playwright browser helper boundaries.
- Slide spec extraction and materialization now use typed validation, media, card, source-rewrite, and structured slide-spec boundaries.
- The strict compiler baseline is 1,858.

## Validation

During the migration, use:

- `npm run typecheck`
- `npm run typecheck:strict` to inspect remaining raw strict compiler blockers
- `npm run validate:type-safety`
- `npm run quality:gate`
