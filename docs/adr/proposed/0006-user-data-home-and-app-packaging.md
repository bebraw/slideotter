# ADR 0006: User Data Home And App Packaging

## Status

Partially implemented.

Runtime path resolution, explicit user-data mode, `SLIDEOTTER_HOME`/`--data-dir`, user-data initialization, and the source-mode `slideotter` command are implemented. Package `dist/` output, packaged CI smoke tests, and docs that make the installed command the primary workflow remain follow-up work.

## Context

slideotter is still implemented as a repository-local tool. The browser studio, build scripts, validation scripts, generated output, presentation registry, and mutable state all assume the repository root is the working root. That is acceptable for development, but it blocks the product from behaving like an installed local application.

The desired product boundary is clearer now:

- the installed package should provide code, static UI assets, and bundled examples
- user-created slide sets, reusable libraries, generated output, app state, archives, and provider configuration should be user data
- user data should live under `~/.slideotter`
- the bundled slideotter tutorial presentation can stay in the application repository because it doubles as product documentation and a development fixture

This ADR records the storage and packaging direction. It does not implement the package yet; it defines the boundaries that future migration slices should follow.

## Decision

Turn slideotter into an installable app command named `slideotter`, with mutable user-owned data rooted under `~/.slideotter`.

The command should run from any directory, serve the installed studio UI and runtime assets from the package, and read/write user presentations from the user data root. The installed app code should be read-only at runtime. The old repo-local mode can remain temporarily during migration, but new user-created presentations and reusable libraries should move toward `~/.slideotter`.

## Target Experience

From any directory:

```bash
slideotter
```

The command should:

1. locate or initialize the user data directory
2. start the local studio server
3. serve the installed studio UI and runtime assets
4. read and write user presentations under `~/.slideotter/presentations/`
5. write generated output under `~/.slideotter/output/`

Expected follow-up commands:

```bash
slideotter init
slideotter studio
slideotter build
slideotter validate
slideotter archive
```

`slideotter` with no subcommand should behave like `slideotter studio`.

## Current Repo-Coupled Assumptions

The current implementation assumes the repository root is the only working root:

- `studio/server/services/paths.ts` derives `repoRoot` from `__dirname`.
- content lives under repo-local `presentations/`.
- global state lives under repo-local `studio/state/`.
- generated studio output lives under repo-local `studio/output/`.
- generated PDFs live under repo-local `slides/output/`.
- archives live under repo-local `archive/`.
- `.env` and `.env.local` are loaded from the repo root.
- `scripts/render-diagrams.ts` reads `slides/assets/diagrams/` from the repo root.
- `build.ts` shells back into `scripts/render-diagrams.ts` through the repo root.
- `write-boundary.ts` protects repo-derived roots instead of the user data root.

These assumptions are fine for development but are the main blocker for a global command.

## Proposed User Data Layout

Use a user-home data directory for mutable slideotter data:

```text
~/.slideotter/
├── presentations/
│   └── <presentation-id>/
│       ├── materials/
│       ├── presentation.json
│       ├── slides/
│       └── state/
├── libraries/
│   ├── layouts/
│   └── themes/
├── state/
├── output/
├── baseline/
└── archive/
```

Rationale:

- `~/.slideotter/presentations/` owns user-created slide sets, materials, presentation metadata, and deck-local state.
- `~/.slideotter/libraries/` owns reusable user assets such as favorite themes and JSON layout definitions.
- `~/.slideotter/state/`, `output/`, `baseline/`, and `archive/` own app state, generated previews, visual baselines, and archived exports.
- The installed package provides code, static UI assets, and the bundled slideotter tutorial presentation only.
- The bundled tutorial presentation can remain in the application repository because it doubles as product documentation and an internal fixture. User-created slide sets should not be written into the installed package.

For migration, the repo can keep accepting the current `presentations/`, `studio/state`, `studio/output`, and `studio/baseline` paths until the user-home resolver is stable.

## Path Model

Introduce a runtime path resolver instead of static module-level constants.

Suggested model:

- `appRoot`: installed package root, used for bundled client assets and built server code
- `userDataRoot`: defaults to `~/.slideotter`
- `contentRoot`: defaults to `userDataRoot`
- `appStateDir`: defaults to `~/.slideotter/state`
- `appOutputDir`: defaults to `~/.slideotter/output`
- `baselineRootDir`: defaults to `~/.slideotter/baseline`
- `presentationsDir`: defaults to `~/.slideotter/presentations`
- `librariesDir`: defaults to `~/.slideotter/libraries`
- `archiveDir`: defaults to `~/.slideotter/archive`
- `slidesOutputDir`: defaults to `~/.slideotter/output`

Implementation shape:

1. Add `studio/server/services/runtime-config.ts`.
2. Parse CLI flags and environment into a runtime config object.
3. Replace direct imports from `paths.ts` with calls that read the initialized runtime config.
4. Keep `paths.ts` as the compatibility export layer at first, but make it derive from runtime config rather than `__dirname`.

## CLI Packaging

Add a package binary:

```json
{
  "bin": {
    "slideotter": "./bin/slideotter.mjs"
  }
}
```

The binary should:

1. parse subcommands and flags
2. resolve `appRoot` from the installed package location
3. resolve `userDataRoot` from `--data-dir`, `SLIDEOTTER_HOME`, or `~/.slideotter`
4. initialize runtime config before loading server services
5. delegate to server/build/validation commands

Avoid loading `studio/server/index.ts` before user data paths are configured. The current module graph reads paths at import time, so this sequencing matters.

## Command Plan

### `slideotter init`

Create the user data directory if it does not exist:

- `~/.slideotter/config.json`
- `~/.slideotter/presentations/`
- `~/.slideotter/libraries/layouts/`
- `~/.slideotter/libraries/themes/`
- `~/.slideotter/state/presentations.json`

Seed either:

- an empty starter presentation, or
- a user-editable copy of the bundled tutorial deck when `--template tutorial` is passed

### `slideotter studio`

Start the browser studio using:

- installed `studio/client` as static assets
- `~/.slideotter/presentations/`
- `~/.slideotter/state/`
- `~/.slideotter/output/`

Useful flags:

```bash
slideotter studio --host 127.0.0.1 --port 4173 --open
```

### `slideotter build`

Build the active presentation into:

```text
~/.slideotter/output/<presentation-id>.pdf
```

### `slideotter validate`

Run the deterministic validation stack against the selected presentation and user data root.

Consider two modes:

- `slideotter validate --fast`
- `slideotter validate --render`

### `slideotter archive`

Copy the active output PDF into:

```text
~/.slideotter/archive/<presentation-id>.pdf
```

## Write Boundary Changes

`write-boundary.ts` should stop protecting the repository root and protect the user data root instead.

Allowed write targets should become:

- `~/.slideotter/presentations/<id>/slides/slide-*.json`
- `~/.slideotter/presentations/<id>/materials/**`
- `~/.slideotter/presentations/<id>/state/*.json`
- `~/.slideotter/presentations/<id>/presentation.json`
- `~/.slideotter/libraries/**`
- `~/.slideotter/state/*.json`
- `~/.slideotter/output/**`
- `~/.slideotter/baseline/**`
- `~/.slideotter/archive/*.pdf`

This keeps the installed app code read-only and makes the user data root the primary mutable surface.

## Environment And Configuration

Load environment files from the user data root, not the installed package:

1. shell environment
2. `~/.slideotter/.env.local`
3. `~/.slideotter/.env`

Keep provider secrets in user data. Do not read provider secrets from the installed package directory.

`~/.slideotter/config.json` should start small:

```json
{
  "version": 1,
  "userData": {
    "presentationsDir": "presentations",
    "librariesDir": "libraries",
    "stateDir": "state",
    "outputDir": "output",
    "baselineDir": "baseline",
    "archiveDir": "archive"
  }
}
```

## Build And Bundle Strategy

The project currently runs TypeScript files directly through Node. A distributable CLI should not rely on repo-only TypeScript execution.

Recommended steps:

1. Add a build step that emits server and script code to `dist/`.
2. Copy `studio/client/` assets into `dist/client/`.
3. Keep package data templates under `templates/`.
4. Keep browser-transpiled client TypeScript behavior until the client has a dedicated build.
5. Make CI run both source-mode tests and packaged smoke tests.

Package smoke test:

```bash
npm pack
tmpdir=$(mktemp -d)
cd "$tmpdir"
npm install /path/to/slideotter-*.tgz
npx slideotter init --template tutorial
npx slideotter build
npx slideotter validate --fast
```

## Migration Slices

1. Done: introduce runtime config and user data path resolution while keeping existing repo behavior unchanged.
2. Done: move mutable studio state to `~/.slideotter/state` when user-data mode is enabled.
3. Done: move generated studio and slide output to `~/.slideotter/output` when user-data mode is enabled.
4. Done: move user-created presentations to `~/.slideotter/presentations` when user-data mode is enabled, while keeping the bundled slideotter tutorial presentation in the application repository.
5. Done: add `~/.slideotter/config.json` initialization and `slideotter init`.
6. Done: add `bin/slideotter.mjs` and route `studio`, `build`, `validate`, and `archive` through it in source mode.
7. Remaining: add package build output under `dist/`.
8. Remaining: add packaged smoke tests to CI.
9. Remaining: update docs to make `slideotter` the primary workflow and repo scripts the development workflow.

## Consequences And Risks

- The server module graph currently initializes paths too early. Fix this before adding the CLI binary.
- Browser static assets must be served from the installed package, not from user data.
- User data discovery should be conservative. Default to `~/.slideotter`, and allow an explicit `--data-dir` or `SLIDEOTTER_HOME` override for tests and unusual setups.
- Baseline files are user artifacts. They belong under `~/.slideotter/baseline`, not the installed package.
- The bundled slideotter tutorial presentation can remain in the installed app as documentation and a fixture. The app should not mutate that bundled copy; editable copies belong under `~/.slideotter/presentations/`.
- The old repo-local mode should remain available until the package smoke test is stable.
