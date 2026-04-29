# ADR 0036: Browser Client Build Pipeline

## Status

Proposed direction.

## Context

ADR 0035 splits the browser studio client into smaller browser-native TypeScript files while keeping the runtime framework-free and static-script based. That is the right near-term migration path because the current studio server can serve `.ts` files as `.js`, packaging already transpiles the client tree, and each extraction can be reviewed as a behavior-preserving slice.

As the split continues, the static-script approach will create new maintenance pressure:

- script load order becomes another dependency graph to maintain by hand
- globals such as `StudioClientCore`, `StudioClientState`, and `StudioClientDrawers` replace normal module imports
- feature modules are harder to test in isolation because dependencies are ambient browser globals
- dead imports, unused exports, and accidental global name collisions are harder to detect
- package and desktop builds must keep mirroring every new browser-loaded file correctly

The question is whether to introduce a bundler such as Vite.

## Decision Direction

Do not introduce Vite or another browser bundler during the current ADR 0035 extraction.

Continue the plain TypeScript script split until the high-risk parts of `studio/client/app.ts` have clear module boundaries. Revisit a bundler after those boundaries are real enough that build tooling can preserve them instead of hiding a large refactor behind configuration changes.

When the static-script model becomes the limiting factor, prefer Vite as the first build-pipeline candidate because it supports fast development, TypeScript module syntax, simple library/application builds, and a small configuration surface.

## Adoption Trigger

Introduce a browser build pipeline only when at least one of these is true:

- feature modules need normal `import`/`export` relationships to stay understandable
- script-order bugs or namespace-global collisions appear in real work
- browser module tests need explicit dependency imports instead of whole-page smoke coverage
- packaging or desktop builds start carrying brittle static-file mirroring logic
- code splitting or asset handling becomes necessary for a concrete shipped feature

Do not add Vite only because it is conventional. Add it when it removes current maintenance risk.

## Target Shape

If adopted, the browser client should move to:

- `studio/client/main.ts` as the browser entrypoint
- normal TypeScript `import`/`export` module boundaries
- Vite output under a generated client build directory
- the studio server serving built client assets in packaged mode
- a development path that still supports `npm run studio:start` without a separate manual build step
- desktop/package smoke tests that verify bundled assets are included

The move should not introduce React, Vue, or another UI framework by default. A bundler is a build pipeline decision, not a UI runtime decision.

## Constraints

- Preserve the DOM-first renderer as the authoritative preview/export path.
- Preserve the current server API and write boundaries.
- Keep generated candidates session-only until explicit apply.
- Keep browser validation and render validation in the quality gate.
- Keep desktop packaging and package smoke tests green in the same change that introduces the build pipeline.
- Avoid build artifacts in source control unless a separate packaging constraint requires them.

## Migration Plan

1. Finish the low-risk ADR 0035 module split far enough that the entrypoint is mostly composition.
2. Add a Vite proof slice that bundles the existing module graph without changing behavior.
3. Update the studio server static-asset resolution to serve built assets while preserving local development ergonomics.
4. Update package build logic so packaged and desktop distributions include the built browser client.
5. Replace namespace globals with explicit imports.
6. Add at least one isolated browser-client module test or fixture that benefits from module imports.
7. Run `npm run quality:gate`, package smoke validation, and desktop smoke validation before accepting the migration.

## Non-Goals

- Do not use this ADR to introduce a frontend framework.
- Do not change slide rendering, validation, export, or apply semantics.
- Do not use bundling as a reason to rewrite the whole browser client at once.
- Do not add server-side rendering or hydration.

## Validation

A bundler adoption slice must run:

- `npm run typecheck`
- `npm run validate:browser`
- `npm run validate:render`
- `npm run package:smoke`
- `npm run desktop:smoke`
- `npm run quality:gate`

If package or desktop smoke tests require browser binaries or platform-specific prerequisites, document any skipped validation explicitly in the implementing change.

## Open Questions

- Should development use Vite middleware/proxy, or should `studio:start` run a lightweight build/watch process behind the existing server?
- Should packaged builds serve only bundled assets, or keep the current source-file fallback for easier local debugging?
- Should Vite adoption wait until most feature modules are extracted, or should it happen once shared core/state/drawer modules prove the split pattern?
