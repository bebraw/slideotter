# Browser Studio Roadmap

This roadmap records the active direction for slideotter's browser studio. It should stay short: use it for intent, durable product boundaries, and the next practical maintenance slice.

Use the focused docs for details that change often or already have a better home:

- [`STUDIO_STATUS.md`](./STUDIO_STATUS.md) for the live implementation snapshot, completed phase status, and current gaps
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the system map, storage model, rendering flow, validation flow, artifacts, and extension points
- [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) for setup, local commands, generated files, and dependency notes
- [`docs/adr/`](./docs/adr/) for durable product, workflow, and architecture decisions
- [`docs/adr/implemented/0015-dom-first-rendering-and-validation.md`](./docs/adr/implemented/0015-dom-first-rendering-and-validation.md) for the shared DOM renderer, export, validation, and baseline-rendering boundary
- [`docs/adr/implemented/0004-staged-presentation-creation.md`](./docs/adr/implemented/0004-staged-presentation-creation.md) for the staged deck creation and theme workbench direction
- [`docs/adr/implemented/0018-rich-slide-families-and-layout-library-baseline.md`](./docs/adr/implemented/0018-rich-slide-families-and-layout-library-baseline.md) for the implemented divider, quote, photo, photo-grid, media-item, and reusable-layout baseline
- [`docs/adr/implemented/0005-rich-generated-layout-definitions.md`](./docs/adr/implemented/0005-rich-generated-layout-definitions.md) for the implemented generated reusable layout-definition workflow
- [`docs/adr/implemented/0006-user-data-home-and-app-packaging.md`](./docs/adr/implemented/0006-user-data-home-and-app-packaging.md) for the installed `slideotter` command with user data under `~/.slideotter`
- [`docs/adr/implemented/0007-browser-presentation-mode.md`](./docs/adr/implemented/0007-browser-presentation-mode.md) for the implemented browser presentation view with full-screen-friendly playback and keyboard navigation
- [`docs/adr/implemented/0008-two-dimensional-presentations.md`](./docs/adr/implemented/0008-two-dimensional-presentations.md) for implemented core-slide paths with optional vertical topic detours in presentation mode
- [`docs/adr/proposed/0009-graph-style-presentations.md`](./docs/adr/proposed/0009-graph-style-presentations.md) for choose-your-own-adventure style decks with explicit branch navigation
- [`docs/adr/implemented/0010-llm-replacement-for-deterministic-workflows.md`](./docs/adr/implemented/0010-llm-replacement-for-deterministic-workflows.md) for replacing deterministic authoring workflows with validated LLM-planned candidates
- [`docs/adr/implemented/0011-lm-studio-model-selection-ui.md`](./docs/adr/implemented/0011-lm-studio-model-selection-ui.md) for choosing loaded local LM Studio models from the browser studio
- [`docs/adr/implemented/0012-progressive-slide-generation-preview.md`](./docs/adr/implemented/0012-progressive-slide-generation-preview.md) for making completed generated slides visible while drafting continues
- [`docs/adr/implemented/0013-hypermedia-application-apis.md`](./docs/adr/implemented/0013-hypermedia-application-apis.md) for HATEOAS-style application APIs that support headless and agentic studio usage
- [`docs/adr/proposed/0014-statecharts-for-graph-presentations.md`](./docs/adr/proposed/0014-statecharts-for-graph-presentations.md) for declarative state management on top of graph-style presentations
- [`docs/adr/proposed/0019-cloudflare-cloud-hosting.md`](./docs/adr/proposed/0019-cloudflare-cloud-hosting.md) for adding a Cloudflare-hosted deployment model beside the local app
- [`docs/adr/proposed/0020-plugin-system.md`](./docs/adr/proposed/0020-plugin-system.md) for keeping core minimal while users add optional tool extensions
- [`docs/adr/implemented/0021-pptx-output.md`](./docs/adr/implemented/0021-pptx-output.md) for implemented image-based PowerPoint handoff output while keeping PDF/DOM as canonical
- [`docs/adr/implemented/0022-selection-scoped-chat-commands.md`](./docs/adr/implemented/0022-selection-scoped-chat-commands.md) for making rendered-slide selection define the scope of chat workflow commands
- [`docs/adr/implemented/0023-post-creation-theme-control.md`](./docs/adr/implemented/0023-post-creation-theme-control.md) for the optional Slide Studio Theme control after initial slide creation
- [`docs/adr/implemented/0024-inline-current-slide-variant-generation.md`](./docs/adr/implemented/0024-inline-current-slide-variant-generation.md) for the implemented inline variant generation workbench with a left-side candidate rail
- [`docs/adr/implemented/0025-assisted-check-remediation.md`](./docs/adr/implemented/0025-assisted-check-remediation.md) for turning validation failures into user-chosen repair candidates
- [`docs/adr/implemented/0026-custom-layout-authoring-and-preview.md`](./docs/adr/implemented/0026-custom-layout-authoring-and-preview.md) for guarded custom layout editing with real-slide preview and validation before save/apply
- [`docs/adr/implemented/0027-custom-html-svg-support.md`](./docs/adr/implemented/0027-custom-html-svg-support.md) for sanitized custom SVG visual artifacts rendered through the shared preview/export path
- [`docs/adr/implemented/0028-token-efficient-llm-generation.md`](./docs/adr/implemented/0028-token-efficient-llm-generation.md) for keeping LLM prompts workflow-scoped, measured, and compact without weakening grounding or apply boundaries
- [`docs/adr/implemented/0029-token-efficient-project-coding.md`](./docs/adr/implemented/0029-token-efficient-project-coding.md) for making agent-assisted project coding use bounded, task-specific repository context
- [`docs/adr/proposed/0030-cloudflare-collaboration.md`](./docs/adr/proposed/0030-cloudflare-collaboration.md) for adding workspace sharing, versioned edits, comments, and live sessions on top of the Cloudflare-hosted model
- [`docs/adr/implemented/0031-slide-studio-live-presentation-creation.md`](./docs/adr/implemented/0031-slide-studio-live-presentation-creation.md) for the implemented post-outline handoff into live progressive generation inside Slide Studio
- [`docs/adr/implemented/0032-presentation-outline-plans-and-derived-decks.md`](./docs/adr/implemented/0032-presentation-outline-plans-and-derived-decks.md) for implemented reusable presentation-scoped outline plans that can derive new decks, stage live drafts, or propose current-deck changes
- [`docs/adr/implemented/0033-electron-wrapper.md`](./docs/adr/implemented/0033-electron-wrapper.md) for the macOS Electron wrapper around the packaged local studio without changing storage, rendering, or write boundaries
- [`docs/adr/implemented/0034-live-slide-validation-and-repair-controls.md`](./docs/adr/implemented/0034-live-slide-validation-and-repair-controls.md) for current-slide validation feedback and direct repair controls inside layout and media editing workflows
- [`docs/adr/implemented/0035-browser-client-modularization.md`](./docs/adr/implemented/0035-browser-client-modularization.md) for the implemented browser-client split across state, element, workflow, drawer, preview, validation, status, and feature-action modules
- [`docs/adr/implemented/0036-browser-client-build-pipeline.md`](./docs/adr/implemented/0036-browser-client-build-pipeline.md) for the implemented Vite browser-client build pipeline and generated asset serving boundary
- [`docs/adr/implemented/0037-server-owned-theme-workbench.md`](./docs/adr/implemented/0037-server-owned-theme-workbench.md) for server-owned theme generation, fallback, and candidate construction through LLM-first workflows
- [`docs/adr/implemented/0038-custom-layout-workbench-modularization.md`](./docs/adr/implemented/0038-custom-layout-workbench-modularization.md) for the implemented custom layout workbench split and server-owned layout-definition draft construction boundary
- [`docs/adr/implemented/0039-presentation-creation-workbench-modularization.md`](./docs/adr/implemented/0039-presentation-creation-workbench-modularization.md) for the implemented staged presentation creation workbench and presentation-library split
- [`docs/adr/implemented/0040-variant-review-and-slide-editing-workbench-modularization.md`](./docs/adr/implemented/0040-variant-review-and-slide-editing-workbench-modularization.md) for the implemented variant review workbench split
- [`docs/adr/implemented/0041-current-slide-and-deck-planning-workbench-modularization.md`](./docs/adr/implemented/0041-current-slide-and-deck-planning-workbench-modularization.md) for the implemented current-slide editing, deck-planning, and source-library workbench split
- [`docs/adr/implemented/0042-studio-shell-runtime-and-preview-orchestration.md`](./docs/adr/implemented/0042-studio-shell-runtime-and-preview-orchestration.md) for the implemented `app.ts` shell split around runtime diagnostics, page/drawer navigation, and preview orchestration
- [`docs/adr/implemented/0043-assistant-workbench-modularization.md`](./docs/adr/implemented/0043-assistant-workbench-modularization.md) for the implemented workflow assistant rendering and message-application split
- [`docs/adr/implemented/0044-strict-typescript-typing.md`](./docs/adr/implemented/0044-strict-typescript-typing.md) for the implemented strict TypeScript and zero explicit `any` guards
- [`docs/adr/implemented/0045-browser-client-contracts-and-rendering-hygiene.md`](./docs/adr/implemented/0045-browser-client-contracts-and-rendering-hygiene.md) for implemented browser-client state, element, API, workbench, command-mounting, and DOM-rendering hygiene
- [`docs/adr/implemented/0016-reversible-deck-length-scaling.md`](./docs/adr/implemented/0016-reversible-deck-length-scaling.md) for the implemented skip/restore deck-length model; [`docs/DECK_LENGTH_SCALING_PLAN.md`](./docs/DECK_LENGTH_SCALING_PLAN.md) remains the detailed reference
- [`docs/adr/implemented/0017-source-grounded-generation.md`](./docs/adr/implemented/0017-source-grounded-generation.md) for implemented presentation-scoped source retrieval and material-aware grounding; [`docs/SOURCE_GROUNDING_ROADMAP.md`](./docs/SOURCE_GROUNDING_ROADMAP.md) remains the detailed reference

## Working Agreement

Keep this file useful for choosing the next slice of work.

- Update [`STUDIO_STATUS.md`](./STUDIO_STATUS.md) with meaningful studio implementation changes.
- Update [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) when system structure, storage, rendering, validation, or artifact flow changes.
- Add a short ADR under [`docs/adr/`](./docs/adr/) for durable product or workflow decisions that should outlive one implementation slice.
- When an ADR moves from plan to shipped behavior, move it from `docs/adr/proposed/` to `docs/adr/implemented/` in the same change.
- Keep "Next Focus" concrete. Avoid parking long-range ideas here unless they affect the next few changes.

## Product Intent

The browser studio exists to make structured presentation work faster, more reviewable, and less error-prone. It should help authors:

- create and select local presentations
- maintain deck context, sources, materials, and constraints beside each presentation
- preview the active slide and deck through the same renderer used for export
- generate, compare, and apply slide or deck changes explicitly
- validate layout, text, media, and visual output before keeping changes

It is not a PowerPoint replacement, a freeform WYSIWYG editor, or a general chatbot. The studio should remain a guarded authoring workbench around structured slide specs and explicit workflow actions.

## Current Direction

The active architecture is DOM-first and presentation-scoped.

- The shared DOM runtime is authoritative for browser preview, thumbnails, compare views, PDF export, PNG artifacts, and validation.
- Slide-spec JSON remains the source content model for supported slide families.
- The server owns file writes, validation, generation, and apply boundaries.
- Generated candidates stay proposals until the user explicitly applies them; new decks now pass through an editable outline approval step before slide files are written.
- The browser now has a dedicated `/present` route for full-screen-friendly slide playback, including two-dimensional core-path and detour navigation, and future presentation-only behavior should build on that surface rather than on the authoring workspace.
- User-created slide sets, presentation state, sources, materials, snapshots, deck context, baselines, and reusable user libraries live under `~/.slideotter` in app mode; the bundled slideotter tutorial presentation remains in the application repository as product documentation and a development fixture.
- LLMs should plan and propose structured content, not execute runtime behavior or write arbitrary project files.

Do not reintroduce a second long-lived rendering path beside the shared DOM runtime.

## Next Focus

The next useful work should come from real studio usage, especially across multiple presentations and media-heavy decks.

1. Continue staged creation hardening from ADR 0031 by refining live progressive slide generation inside Slide Studio, especially retry, partial acceptance, and placeholder review ergonomics.
2. Extend reusable layout definitions only when real decks expose a concrete layout request that the current `slotRegionLayout` and `photoGridArrangement` definitions cannot represent.
3. Evolve source retrieval from observed generation misses. Current retrieval is intentionally lightweight keyword matching over presentation-scoped source chunks. Add embeddings, ranking controls, citation placement, or global source staging only when real decks show where the simpler model fails.
4. Extend media validation when new slide families or decks reveal specific gaps beyond the current size, bounds, loading, distortion, upscaling, spacing, labeling, caption/source attachment, and progress-area checks.
5. Extend live current-slide validation and direct mechanical repair controls from ADR 0034 only where real decks expose gaps. The implemented baseline now covers custom-layout validation, favorite-ready gating, compact-spacing repair drafts, media fit/fill/recenter controls, 3x3 focal points, and current-slide validation feedback beside media controls.
6. Extend assisted check remediation from ADR 0025 only where real decks expose additional low-risk mechanical fixes or clearly labeled editorial candidate needs. The implemented baseline now turns actionable check rows into reviewed media fit/fill and compact-spacing candidates.
7. Continue browser-client modularization only when a remaining `app.ts` composition concern creates concrete maintenance risk; runtime diagnostics, page/drawer navigation, preview rendering, and assistant behavior already live in dedicated modules.
8. Extend custom visual support from ADR 0027 only when real decks need constrained static HTML, import/export round trips, richer validation, or generated SVG proposals beyond the implemented static-SVG artifact baseline.
9. Improve project-coding context from ADR 0029 when repeated agent or maintainer work shows the same subsystem orientation cost.
10. Add Cloudflare collaboration from ADR 0030 only after the hosted workspace, auth, storage, and job boundaries from ADR 0019 are clear enough to support versioned shared writes.
11. Harden the Electron wrapper from ADR 0033 from real macOS desktop usage, especially icons, signing/notarization, release documentation, and packaged export validation.
12. Keep deck-planning changes tied to shared deck-context patches when they alter narrative direction, theme, constraints, target length, or other deck-level decisions.
13. Extend two-dimensional presentations from ADR 0008 only when real talks need richer detour authoring, generated optional-depth suggestions, or explicit full-deck export controls beyond the implemented manual detour and core-path export baseline.
14. Keep documentation and demo copy aligned with the DOM-first, per-presentation runtime whenever older guidance is touched.

## UX Principles

The studio UI should stay centered on the active presentation, active slide, and current workflow.

- Keep app chrome quiet and compact so rendered slide canvases remain dominant.
- Keep secondary controls inspectable instead of always expanded.
- Prefer direct preview, compare, apply, and validation loops over dashboard-style status surfaces.
- Keep assistant behavior routed through scoped workflow actions and visible apply boundaries.
- Preserve slide theme fidelity: app light/dark chrome must not change the rendered deck theme.

## Watch Areas

- Full-deck rebuild latency can still make larger workflows feel slower than intended.
- New workflow modes must preserve the explicit write boundary and preview-before-apply model.
- A freeform visual editor would fight the structured slide-spec model unless the DOM runtime first grows a clearer editing abstraction.
- Source-grounded generation should remain inspectable without making diagnostics the primary authoring surface.
- Documentation drift is likely when old rendering, validation, or global deck-state paths are mentioned as active behavior.
