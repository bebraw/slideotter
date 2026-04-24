# Appification Plan

This plan describes how to turn slideotter from a repo-local tool into an app command that can be run as `slideotter` from any directory.

The goal is not to implement the package yet. The goal is to identify the boundaries that have to move so the eventual CLI can treat the current working directory as the active presentation workspace while keeping the installed app code read-only.

## Target Experience

From any project directory:

```bash
slideotter
```

The command should:

1. locate or initialize a slideotter workspace in the current directory
2. start the local studio server
3. serve the installed studio UI and runtime assets
4. read and write presentations in the current workspace
5. write generated output into the current workspace

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
- `write-boundary.ts` protects repo-derived roots instead of a user workspace root.

These assumptions are fine for development but are the main blocker for a global command.

## Proposed Workspace Layout

Use an explicit workspace format:

```text
my-deck-project/
├── slideotter.config.json
├── presentations/
│   └── <presentation-id>/
│       ├── materials/
│       ├── presentation.json
│       ├── slides/
│       └── state/
├── archive/
├── slides/
│   ├── assets/
│   │   └── diagrams/
│   └── output/
└── .slideotter/
    ├── state/
    ├── output/
    └── baseline/
```

Rationale:

- `presentations/`, `archive/`, and `slides/` stay human-visible because they are project artifacts.
- `.slideotter/` contains app state, generated previews, workflow history, and visual baselines.
- The installed package provides code and static UI assets only.
- The workspace owns all mutable deck data.

For backwards compatibility during migration, the repo can keep accepting the current `studio/state`, `studio/output`, and `studio/baseline` paths when no workspace config exists.

## Path Model

Introduce a runtime path resolver instead of static module-level constants.

Suggested model:

- `appRoot`: installed package root, used for bundled client assets and built server code
- `workspaceRoot`: user project root, usually `process.cwd()` or the nearest parent with `slideotter.config.json`
- `contentRoot`: defaults to `workspaceRoot`
- `appStateDir`: defaults to `workspaceRoot/.slideotter/state`
- `appOutputDir`: defaults to `workspaceRoot/.slideotter/output`
- `baselineRootDir`: defaults to `workspaceRoot/.slideotter/baseline`
- `presentationsDir`: defaults to `workspaceRoot/presentations`
- `archiveDir`: defaults to `workspaceRoot/archive`
- `slidesDir`: defaults to `workspaceRoot/slides`
- `slidesOutputDir`: defaults to `workspaceRoot/slides/output`

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
3. resolve `workspaceRoot` from `--workspace`, `SLIDEOTTER_WORKSPACE`, or nearest `slideotter.config.json`
4. initialize runtime config before loading server services
5. delegate to server/build/validation commands

Avoid loading `studio/server/index.ts` before workspace paths are configured. The current module graph reads paths at import time, so this sequencing matters.

## Command Plan

### `slideotter init`

Create a minimal workspace:

- `slideotter.config.json`
- `presentations/slideotter/presentation.json`
- `presentations/slideotter/slides/`
- `presentations/slideotter/state/`
- `.slideotter/state/presentations.json`

Seed either:

- an empty starter presentation, or
- a copy of the bundled demo deck when `--template demo` is passed

### `slideotter studio`

Start the browser studio using:

- installed `studio/client` as static assets
- workspace `presentations/`
- workspace `.slideotter/state`
- workspace `.slideotter/output`

Useful flags:

```bash
slideotter studio --host 127.0.0.1 --port 4173 --open
```

### `slideotter build`

Build the active presentation into:

```text
slides/output/<presentation-id>.pdf
```

### `slideotter validate`

Run the deterministic validation stack against the workspace.

Consider two modes:

- `slideotter validate --fast`
- `slideotter validate --render`

### `slideotter archive`

Copy the active output PDF into:

```text
archive/<presentation-id>.pdf
```

## Write Boundary Changes

`write-boundary.ts` should stop protecting the repository root and protect the workspace root instead.

Allowed write targets should become:

- `presentations/<id>/slides/slide-*.json`
- `presentations/<id>/materials/**`
- `presentations/<id>/state/*.json`
- `presentations/<id>/presentation.json`
- `.slideotter/state/*.json`
- `.slideotter/output/**`
- `.slideotter/baseline/**`
- `slides/output/**`
- `archive/*.pdf`

This keeps the installed app code read-only and makes the user's current workspace the only mutable surface.

## Environment And Configuration

Load environment files from the workspace, not the installed package:

1. shell environment
2. `workspaceRoot/.env.local`
3. `workspaceRoot/.env`

Keep provider secrets workspace-local. Do not read provider secrets from the installed package directory.

`slideotter.config.json` should start small:

```json
{
  "version": 1,
  "workspace": {
    "presentationsDir": "presentations",
    "stateDir": ".slideotter/state",
    "outputDir": ".slideotter/output",
    "baselineDir": ".slideotter/baseline",
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
npx slideotter init --template demo
npx slideotter build
npx slideotter validate --fast
```

## Migration Slices

1. Introduce runtime config and workspace path resolution while keeping existing repo behavior unchanged.
2. Move mutable studio state from `studio/state` to `.slideotter/state` behind compatibility fallbacks.
3. Move generated studio output from `studio/output` to `.slideotter/output`.
4. Add `slideotter.config.json` discovery and `slideotter init`.
5. Add `bin/slideotter.mjs` and route `studio`, `build`, `validate`, and `archive` through it.
6. Add package build output under `dist/`.
7. Add packaged smoke tests to CI.
8. Update docs to make `slideotter` the primary workflow and repo scripts the development workflow.

## Risks And Decisions

- The server module graph currently initializes paths too early. Fix this before adding the CLI binary.
- Browser static assets must be served from the installed package, not from the workspace.
- Workspace discovery should be conservative. If no config is found, use the current directory only after `slideotter init` or an explicit `--workspace`.
- Baseline files are user project artifacts. They belong in the workspace, not the installed package.
- Demo decks should be templates. The installed app should not mutate its bundled demo.
- The old repo-local mode should remain available until the package smoke test is stable.
