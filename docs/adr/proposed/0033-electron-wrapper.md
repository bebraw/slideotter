# ADR 0033: Electron Wrapper

## Status

Proposed implementation plan.

## Context

slideotter is currently a local browser studio served by the Node runtime. The app already has a durable local packaging boundary: installed code is read-only, mutable user data lives under `~/.slideotter`, and the `slideotter` command can start the studio from outside the repository.

That model works for developers and command-line-friendly users, but it still asks normal desktop users to install Node tooling, run a command, watch a terminal, and open a browser URL. The app should feel like a local desktop application while preserving the same server-controlled writes, DOM-first rendering path, user-data storage, and browser presentation mode.

An Electron wrapper is the smallest desktop packaging step that can reuse the existing studio UI and server runtime without creating a second application.

## Decision Direction

Add an Electron desktop wrapper around the existing local studio.

Electron should launch the same packaged server runtime, open the existing studio client in a desktop window, and keep all deck authoring behavior inside the current HTTP API, DOM renderer, validation, and write-boundary model.

The wrapper is a shell, not a fork of the product. The browser studio remains the canonical UI and the Node server remains the canonical write and workflow boundary.

## Product Rules

- Opening the desktop app should show the studio without requiring a visible terminal.
- The desktop app should use the same presentations, sources, materials, libraries, baselines, archives, and runtime settings as the packaged `slideotter` command.
- User data must stay under the existing user-data root unless the user explicitly chooses another data directory.
- The desktop app should expose basic lifecycle controls: launch, quit, reload, open data folder, and open current presentation output when available.
- The desktop window should preserve the existing browser-studio layout and routes, including `/present` presentation mode.
- Presentation mode may open in a separate desktop window, but it must use the same `/present` document and keyboard behavior as browser presentation mode.
- Server startup, provider configuration errors, and port conflicts should produce clear in-app or native-dialog feedback.
- Closing the last app window should stop the bundled server unless a future background mode is explicitly added.
- The wrapper should not add hidden sync, cloud storage, or collaboration behavior.

## Architecture

The desktop package should contain:

- Electron main process
- packaged studio server code
- packaged studio client assets
- optional bundled tutorial/template assets
- package metadata and icons

At launch, the Electron main process should:

1. Resolve the user-data root using the same runtime-config rules as the CLI.
2. Start the existing studio server on an ephemeral local port.
3. Open a `BrowserWindow` pointed at the local studio URL.
4. Stop the server when the app quits.

The server should still own:

- file writes
- presentation registry and active runtime state
- material and source storage
- LLM provider calls
- generated candidates
- preview, export, and validation workflows
- write-boundary enforcement

The renderer process should not write presentation files directly. Any desktop-only actions should call explicit server endpoints or Electron main-process commands with narrow intent.

## Packaging Boundary

Electron packaging should build on ADR 0006's user-data and app-packaging model.

The desktop app should not write mutable presentation state into the installed application bundle. It should treat the bundle as read-only and use the same `~/.slideotter` structure as the CLI unless configured otherwise.

The package should avoid requiring a global Node installation at runtime. If native dependencies such as Playwright browser binaries, canvas, or image processing packages are needed, the desktop package must either include them or perform a clear first-run installation/check with actionable error messages.

## App Menu And Native Integration

Keep native integration modest in the first slice:

- `File > Open Data Folder`
- `File > Open Archive Folder`
- `View > Reload`
- `View > Toggle Developer Tools`
- `Help > About slideotter`

Do not add native file editing, drag-and-drop imports, system tray behavior, auto-update, or protocol handlers in the first implementation unless they are needed to make packaging viable.

## Security Rules

- Load only the local studio origin in the main window.
- Disable Node integration in renderer windows.
- Use context isolation.
- Do not expose broad filesystem APIs to the renderer.
- Keep any preload bridge narrow and command-oriented.
- Keep local server binding to loopback.
- Preserve the existing server write boundary for all presentation mutations.
- Do not store provider secrets in the app bundle.

## Relationship To Existing ADRs

ADR 0006 is the foundation. The Electron wrapper should reuse its installed-code versus user-data split and should not create a parallel storage model.

ADR 0007's browser presentation mode remains the presentation runtime. Electron may wrap it in a desktop window, but it should not create a separate presentation renderer.

ADR 0015's DOM-first rendering boundary remains unchanged. Electron should host the same DOM runtime used by browser preview, validation, PDF export, and presentation mode.

ADR 0019's Cloudflare hosting direction remains separate. Electron is a local desktop wrapper, not a hosted workspace or sync layer.

ADR 0020's plugin direction may eventually affect desktop packaging, but the first wrapper should package core behavior only.

ADR 0030's collaboration direction should not be implemented through Electron-specific local networking. Collaboration should wait for the hosted workspace and shared-write model.

## Validation

Add coverage for:

- packaged Electron startup resolves the same user-data root as the CLI
- server starts on loopback and opens the studio URL
- app startup does not require repo-local paths
- closing the app stops the bundled server
- `/present` opens and navigates in the desktop package
- browser workflow validation can run against the packaged desktop server where feasible
- package smoke test verifies the installed app can start, load the studio shell, and report a healthy API state
- write-boundary tests still reject writes into installed app assets

Manual release validation should include:

- first launch on a clean machine profile
- launch with existing `~/.slideotter` data
- LLM provider configuration failure messaging
- PDF export and render validation from the packaged app
- presentation mode on a projector-sized secondary display

## Migration Plan

1. Add an Electron main-process entrypoint that starts the existing server on an ephemeral loopback port.
2. Reuse the current client assets and server build output from package generation.
3. Add minimal app menus for reload, developer tools, and user-data folder access.
4. Add package scripts for desktop development and desktop smoke testing.
5. Add icons and installer metadata after the wrapper can launch and pass smoke checks.
6. Extend packaged smoke tests to cover app startup, API health, and write-boundary behavior.
7. Document desktop install, data location, provider setup, and known limitations.

## Non-Goals

- No rewrite of the browser studio in native UI.
- No direct renderer-process filesystem writes.
- No second rendering engine.
- No cloud sync or collaboration.
- No automatic updates in the first implementation slice.
- No system tray or background daemon behavior.
- No replacement of the `slideotter` CLI.

## Open Questions

- Which Electron packager should be used for the first distributable build?
- Should the desktop app expose a data-directory picker on first launch, or keep that as an advanced setting?
- Should presentation mode open as a separate always-on-top window or as a normal app window?
- How should packaged Playwright/browser dependencies be handled across macOS, Windows, and Linux?
- Should the app support opening `.slideotter` workspace files later, or keep all workspace selection inside the existing presentation registry?
