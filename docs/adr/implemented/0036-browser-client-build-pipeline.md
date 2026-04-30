# ADR 0036: Browser Client Build Pipeline

## Status

Implemented.

## Context

ADR 0035 split the browser studio client into smaller browser-native TypeScript files while keeping the runtime framework-free and static-script based. That was the right migration path because each extraction could be reviewed as a behavior-preserving slice.

As the split continues, the static-script approach will create new maintenance pressure:

- script load order becomes another dependency graph to maintain by hand
- globals such as `StudioClientCore`, `StudioClientState`, and `StudioClientDrawers` replace normal module imports
- feature modules are harder to test in isolation because dependencies are ambient browser globals
- dead imports, unused exports, and accidental global name collisions are harder to detect
- package and desktop builds must keep mirroring every new browser-loaded file correctly

After ADRs 0037-0043, the high-risk feature modules have clear enough boundaries that the static-script model is now more expensive than useful.

## Decision Direction

Use Vite as the browser client build pipeline.

The browser studio now loads through `studio/client/main.ts`, which imports `styles.css`, the shared DOM renderer side effect, and `app.ts`. Feature modules use normal TypeScript `import`/`export` boundaries. Vite writes generated assets under `studio/client-dist/`, and the studio server serves that generated directory for app pages.

## Adoption Trigger

Introduce a browser build pipeline only when at least one of these is true:

- feature modules need normal `import`/`export` relationships to stay understandable
- script-order bugs or namespace-global collisions appear in real work
- browser module tests need explicit dependency imports instead of whole-page smoke coverage
- packaging or desktop builds start carrying brittle static-file mirroring logic
- code splitting or asset handling becomes necessary for a concrete shipped feature

Do not add Vite only because it is conventional. Add it when it removes current maintenance risk.

## Target Shape

The browser client moved to:

- `studio/client/main.ts` as the browser entrypoint
- normal TypeScript `import`/`export` module boundaries
- Vite output under `studio/client-dist/`
- the studio server serving built client assets in repo and packaged mode
- `npm run studio:start` and `npm run studio:dev` starting a Vite watch process behind the existing server
- package builds including `dist/studio/client-dist/` plus only the server-needed `slide-dom.js` and `styles.css` helper files under `dist/studio/client/`

The move should not introduce React, Vue, or another UI framework by default. A bundler is a build pipeline decision, not a UI runtime decision.

## Constraints

- Preserve the DOM-first renderer as the authoritative preview/export path.
- Preserve the current server API and write boundaries.
- Keep generated candidates session-only until explicit apply.
- Keep browser validation and render validation in the quality gate.
- Keep desktop packaging and package smoke tests green in the same change that introduces the build pipeline.
- Avoid build artifacts in source control unless a separate packaging constraint requires them.

## Migration Plan

1. Finished the low-risk module split far enough that the entrypoint is mostly composition.
2. Added a Vite build that bundles the existing module graph without changing browser behavior.
3. Updated the studio server static-asset resolution to serve built assets from `studio/client-dist/`.
4. Updated package build logic so packaged and desktop distributions include the built browser client.
5. Replaced namespace globals with explicit TypeScript imports.
6. Updated browser-client fixture coverage to verify module entrypoint, imports, and generated-client serving boundaries.
7. Ran `npm run quality:gate`, package smoke validation, and desktop smoke validation.

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
  - Answer: Start with a lightweight Vite build/watch process behind the existing server. Keep the studio server as the single app entrypoint and API owner. Avoid Vite middleware/proxy until there is a concrete need for HMR-level integration; the current server already owns runtime state, APIs, static assets, and desktop/package behavior.
- Should packaged builds serve only bundled assets, or keep the current source-file fallback for easier local debugging?
  - Answer: Packaged builds should serve only bundled assets. Source-file fallback is useful in repo development, but packaged/app mode should exercise the same artifact shape users receive. Keep debugging through source maps rather than serving raw source files from packaged distributions.
- Should Vite adoption wait until most feature modules are extracted, or should it happen once shared core/state/drawer modules prove the split pattern?
  - Answer: Wait until most feature modules are extracted and `app.ts` is mostly composition. The split pattern is now proven, but adopting Vite too early would mix build migration with feature-boundary cleanup. Trigger Vite when the remaining static-script cost is script ordering, namespace globals, packaging mirroring, or module-test friction rather than unfinished modularization.
