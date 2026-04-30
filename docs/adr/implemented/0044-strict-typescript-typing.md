# ADR 0044: Strict TypeScript Typing

## Status

Implemented.

## Context

The repository already runs `npm run typecheck` in the quality gate, but `tsconfig.json` previously overrode parts of strict mode with `noImplicitAny: false`, `strictNullChecks: false`, and `useUnknownInCatchVariables: false`. That left a large historical backlog of implicit parameter, return, nullability, indexed-access, optional-property, and array types across the browser client, server services, scripts, and tests.

At the start of the migration, a direct zero-diagnostic compiler flip was not safe. Running the strict project compiler reported thousands of errors, with the largest clusters in server operations, server routing, presentation generation, browser workbenches, and high-risk service tests. Replacing those with explicit `any` annotations would have made the compiler pass while preserving the same weak contracts.

Explicit `any` was also present in first-party TypeScript. Those usages were concentrated around state payloads, DOM event targets, API resources, generated candidate payloads, LLM responses, and test helpers.

## Decision

Move the codebase toward a zero-diagnostic strict TypeScript build and zero explicit `any`, but do it by typed subsystem slices rather than blanket annotations.

The migration rules are:

- Do not add new explicit `any` usages. Use narrow domain interfaces, `unknown` plus local guards, DOM types, or shared payload types instead.
- Keep the main `tsconfig.json` on strict compiler settings: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride`.
- Keep `npm run typecheck` as a zero-diagnostic strict compiler gate.
- Keep `npm run validate:type-safety` as a zero-explicit-`any` and zero-strict-diagnostic gate.
- Prefer extracting shared studio payload and slide-spec types before typing the largest server/workflow modules.

## Migration Order

1. Browser client shell and workbench contracts: state, elements, DOM preview, workbench dependencies, event targets, and API response payloads.
2. Shared slide, layout, theme, validation, material, source, variant, and deck-plan payload types used by both server services and browser code.
3. Server service boundaries: route request bodies, operation options, LLM response shapes, generation artifacts, and write-boundary inputs.
4. Test and validation helpers, using the shared service payload types instead of local weak shapes.
5. Keep the direct zero-strict-diagnostic and zero-explicit-`any` guards after removing the historical baseline files.

## Consequences

- The codebase gets an immediate guard against explicit `any` usage.
- The codebase gets an immediate guard against strict compiler diagnostics.
- The project compiler options are strict now, and historical diagnostics are fully paid down.
- Type improvements should remove unsafe shapes rather than hide them behind project-wide permissive aliases.
- The explicit-any and strict compiler migrations are complete when both guards pass without baseline files.

## Implementation Progress

- `tsconfig.json` now enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` without weaker strict-mode overrides.
- `npm run typecheck` and `npm run validate:type-safety` guard both explicit `any` and strict compiler diagnostics.
- The browser-client core helper, element registry, state, preference, app-theme, LLM status, slide-preview, assistant, preview, navigation, drawer, validation-report, API explorer, runtime-status, presentation-library, workflow runner, and theme workbench modules now have typed contracts.
- Diagram, documentation-link, geometry, render, text, media fixture, slide-spec fixture, slide-media fixture, deck-plan fixture, dead-code, hypermedia smoke, and slide migration scripts now have typed helper contracts.
- The active deck context reader, server build preview manifest helper, and generation diagnostic writer now type their boundaries.
- The explicit-any guard now reports 0 explicit `any` nodes.
- The strict compiler guard now reports 0 diagnostics.
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
- The preview workbench now uses typed preview-slide, variant-preview, live-run, render-option, and collaborator contracts instead of permissive dependency `any` types.
- Studio layout validation now satisfies the strict project compiler with typed Playwright page, viewport, masthead navigation, rectangle, and thumbnail-scroll metrics.
- Presentation workflow validation now satisfies the strict project compiler with typed Playwright page, LLM mock request, workspace state, layout, slide, source, and JSON response contracts.
- Slide editor DOM selection and material-option callbacks now avoid explicit `any` while the larger slide editor strict contract remains a dedicated follow-up slice.
- Variant review now avoids explicit `any` in DOM step updates, card event target checks, capture payloads, favorite button attributes, and apply options while the larger strict variant-review contract remains a follow-up slice.
- High-risk service tests now type generated presentation-plan fixture helpers and deck-plan mutation fixtures instead of using local explicit `any`.
- LLM client now uses typed provider config, structured-response options/results, prompt budgets, progress events, streamed payloads, model listing, and error-message boundaries.
- DOM validation now uses typed browser-evaluated geometry, text, media, caption, issue, color, and validation-option boundaries.
- LLM prompt and schema helpers now use typed prompt options, projected deck/slide context, and JSON schema builder boundaries.
- DOM export now uses typed preview-state, slide-entry, and Playwright browser helper boundaries.
- Slide spec extraction and materialization now use typed validation, media, card, source-rewrite, and structured slide-spec boundaries.
- Runtime status and custom layout workbenches now use typed runtime, layout, control, preview, export/import, and error-message boundaries.
- Navigation shell dependencies now use typed drawer, preference, API explorer, page, and UI-state boundaries.
- Assistant workbench now uses typed assistant session, selection, action, response payload, and state boundaries.
- Deck planning workbench no longer uses broad DOM event or restore-button `any` casts.
- Studio app orchestration now types its browser helper options, DOM renderer access, workbench handles, validation-rule selects, theme fields, and outline event targets.
- Presentation creation workbench now avoids explicit `any` for staged access context, editable-outline save options, creation-submit options, field restoration, and DOM control queries.
- Studio server routing now types SSE subscribers, presentation payload extras, creation request normalization, locked-outline options, and start-server options.
- Presentation generation now avoids explicit `any` in generation fields, progress options, material media, semantic repair requests, deck-plan responses, and stopped-run errors.
- Presentation storage now avoids explicit `any` in outline normalization, default context/meta creation, runtime theme saving, outline plan options, presentation creation, regeneration, and duplication boundaries.
- Operations service now avoids explicit `any` in workflow option objects, layout intents, slot options, theme and layout candidate generation, variant materialization, slide ideation workflows, deck-structure ideation, and deck-structure apply options.
- Studio app state now uses the shared `StudioClientState.State` contract, with explicit deck context, presentation, theme, layout, slide, variant, runtime, and workflow payload shapes instead of a central app-level `any`.
- Studio client requests now default to `unknown`, and direct app request call sites use explicit response payload contracts.
- Studio app orchestration now satisfies the strict project compiler through shared client state, runtime, preview, assistant, and request payload contracts.
- LLM configuration tests now use typed mocked chat requests and progress events.
- Home screenshot capture now uses typed spawned server, polling, environment, signal, and delay helpers.
- Service coverage gate now uses typed V8 coverage ranges, functions, scripts, line offsets, and summaries.
- Progressive content-run tests now use typed mocked LLM requests, deck plans, content-run state payloads, and polling helpers.
- Slide DOM rendering now uses typed theme, slide-spec, media, card, slot-region layout, document payload, and renderer API contracts.
- Slide editor workbench now uses typed dependency, inline-edit, material, slide-spec payload, selection, path, and JSON helper contracts.
- Variant review workbench now uses typed variant, selection-scope, structured comparison, source diff, decision support, request payload, and workflow runner contracts.
- Presentation creation workbench now uses typed staged access, creation draft, deck-plan, outline, content-run, request payload, and DOM control contracts.
- Deck planning workbench now uses typed deck-length, deck-structure, outline-plan, source, diff-preview, request payload, and shared state contracts.
- High-risk service tests now type presentation lifecycle, theme-candidate, outline-plan, slide lifecycle, and deck-length fixtures.
- Studio server entrypoint now types runtime/SSE state, workflow events, HTTP response helpers, request body parsing, and static asset serving.
- High-risk service tests now satisfy the strict project compiler with typed LLM mock requests, generation results, source/material fixtures, variant order assertions, and remote image imports.
- Studio server entrypoint now uses typed unknown-error handling and selection-scope request guards.
- Presentation generation now types its plan, material candidate, semantic repair, schema, deck-plan validation, and slide materialization helper boundaries under the strict project compiler.
- Presentation generation now satisfies the strict project compiler with typed generated slide specs, retrieval snippets, source budgets, deck-plan repair, content-run state, and per-slide material/source contexts.
- Studio server routing now types layout route request/response boundaries, workspace skipped-slide filtering, layout import/save payloads, visual-theme guards, and presentation creation starter media/search payloads.
- Studio server routing now types staged presentation outline helpers, deck-plan slide locks, creation-field normalization, compact source summaries, and outline draft route boundaries.
- Studio server routing now types outline-plan CRUD, proposal, staging, derivation, and approval route boundaries with explicit outline/deck-plan payload guards.
- Studio server routing now types remaining route handler signatures and URL-derived slide id guards across draft content, theme, presentation, source/material, deck, variant, assistant, custom layout, and hypermedia routes.
- Studio server routing now satisfies the strict project compiler with typed content-run helpers, manual slide factories, deck-structure patch counting, theme-progress callbacks, variant lookup, and guarded material asset route captures.
- Presentation storage now satisfies the strict project compiler with typed outline-plan, deck-plan derivation, presentation summary, clone/delete, and slide-regeneration boundaries.
- Operations service local generation helpers now type progress, text normalization, local candidate shaping, theme/LLM candidate generation, custom layout authoring, and early layout-definition boundaries.
- Operations service structure-generation helpers now type layout-library candidates, structure context, local structure/family candidates, deck-structure context, and deck-wide slide rewrite helpers.
- Operations service deck-structure helpers now type outline extraction, deck-structure context, rewrite slide factories, deck-patch diffs, plan stats, and preview hints.
- Operations service now satisfies the strict project compiler with typed deck-plan definitions, LLM deck-structure candidates, variant materialization, preview rendering, and slide ideation workflow boundaries.
- Type-safety validation now enforces zero explicit `any` nodes and zero strict compiler diagnostics directly, without baseline files.
- The strict compiler guard reports 0 diagnostics.

## Validation

During the migration, use:

- `npm run typecheck`
- `npm run typecheck:strict` to inspect remaining raw strict compiler blockers
- `npm run validate:type-safety`
- `npm run quality:gate`
