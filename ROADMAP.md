# Browser Studio Roadmap

This roadmap records the active direction for slideotter's browser studio. It should stay short: use it for intent, durable product boundaries, and the next practical maintenance slice.

Use the focused docs for details that change often or already have a better home:

- [`STUDIO_STATUS.md`](./STUDIO_STATUS.md) for the live implementation snapshot, completed phase status, and current gaps
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the system map, storage model, rendering flow, validation flow, artifacts, and extension points
- [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) for setup, local commands, generated files, and dependency notes
- [`docs/adr/`](./docs/adr/) for durable product, workflow, and architecture decisions
- [`docs/adr/implemented/0004-staged-presentation-creation.md`](./docs/adr/implemented/0004-staged-presentation-creation.md) for the staged deck creation and theme workbench direction
- [`docs/adr/proposed/0005-section-dividers-and-rich-slide-families.md`](./docs/adr/proposed/0005-section-dividers-and-rich-slide-families.md) for first-class dividers, quote slides, photo slides, reusable generated layouts, shareable JSON layout definitions, and user-saved favorite layouts
- [`docs/adr/proposed/0006-user-data-home-and-app-packaging.md`](./docs/adr/proposed/0006-user-data-home-and-app-packaging.md) for turning slideotter into an installed command with user data under `~/.slideotter`
- [`docs/adr/implemented/0007-browser-presentation-mode.md`](./docs/adr/implemented/0007-browser-presentation-mode.md) for the implemented browser presentation view with full-screen-friendly playback and keyboard navigation
- [`docs/adr/proposed/0008-two-dimensional-presentations.md`](./docs/adr/proposed/0008-two-dimensional-presentations.md) for core-slide paths with optional vertical topic detours in presentation mode
- [`docs/adr/proposed/0009-graph-style-presentations.md`](./docs/adr/proposed/0009-graph-style-presentations.md) for choose-your-own-adventure style decks with explicit branch navigation
- [`docs/DECK_LENGTH_SCALING_PLAN.md`](./docs/DECK_LENGTH_SCALING_PLAN.md) for reversible deck length scaling
- [`docs/SOURCE_GROUNDING_ROADMAP.md`](./docs/SOURCE_GROUNDING_ROADMAP.md) for source-grounded generation

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
- The browser now has a dedicated `/present` route for full-screen-friendly slide playback, and future presentation-only behavior should build on that surface rather than on the authoring workspace.
- User-created slide sets, presentation state, sources, materials, snapshots, deck context, baselines, and reusable user libraries should move under `~/.slideotter`; the bundled slideotter tutorial presentation can remain in the application repository as product documentation and a development fixture.
- LLMs should plan and propose structured content, not execute runtime behavior or write arbitrary project files.

Do not reintroduce a second long-lived rendering path beside the shared DOM runtime.

## Next Focus

The next useful work should come from real studio usage, especially across multiple presentations and media-heavy decks.

1. Continue the staged creation rollout from ADR 0004 by deepening the post-content theme workbench beyond the current multi-slide sample preview and apply-summary handoff: richer theme candidate generation, stronger side-by-side comparison, and clearer apply-to-deck review for larger decks.
2. Continue ADR 0005 beyond the now-implemented divider, quote, photo, photo-grid, deck-local/favorite layout library, library-backed layout candidates, and `mediaItems` data model: add generated layout-definition workflows so common requests such as split-photo slides map to validated structured specs and shareable JSON layout definitions.
3. Evolve source retrieval from observed generation misses. Current retrieval is intentionally lightweight keyword matching over presentation-scoped source chunks. Add embeddings, ranking controls, citation placement, or global source staging only when real decks show where the simpler model fails.
4. Extend media validation when new slide families or decks reveal specific gaps beyond the current size, bounds, loading, distortion, upscaling, spacing, labeling, caption/source attachment, and progress-area checks.
5. Keep deck-planning changes tied to shared deck-context patches when they alter narrative direction, theme, constraints, target length, or other deck-level decisions.
6. Keep documentation and demo copy aligned with the DOM-first, per-presentation runtime whenever older guidance is touched.

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
