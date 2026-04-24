# Browser Studio Status

This file tracks the live implementation snapshot for the browser studio.

Use [`ROADMAP.md`](./ROADMAP.md) for architecture and the next practical maintenance focus.

Durable studio decisions can also be captured under `docs/adr/` when they are more stable than the current implementation snapshot. The current workflow-control decisions are recorded in [`docs/adr/0001-studio-deck-plan-and-validation-controls.md`](./docs/adr/0001-studio-deck-plan-and-validation-controls.md), and the current pragmatic UI review direction is recorded in [`docs/adr/0002-pragmatic-ui-review.md`](./docs/adr/0002-pragmatic-ui-review.md).

Current implementation is now DOM-first. Supported JSON slide families render through a shared DOM runtime in the studio and through a standalone `/deck-preview` document, studio-triggered PDF export plus preview PNG generation run through Playwright on that same DOM renderer, studio geometry/text validation for those slide families uses DOM inspection, and the CLI PDF build plus quality-gate path now uses the same DOM renderer and DOM validation stack. The optional baseline render gate still exists, but it now compares the current DOM-built PDF against approved raster snapshots under `studio/baseline/<presentation-id>/`.

## Current State

The browser studio baseline is complete.

- The local studio runs through `studio/server/` and `studio/client/`.
- The studio and scripts are TypeScript sources executed through Node's type-stripping runtime, and `npm run typecheck` is part of the local and CI quality gates.
- Presentations are registry-backed: `studio/state/presentations.json` selects the active presentation, and each deck keeps slides plus deck-local state under `presentations/<id>/`.
- Slide-spec JSON is the source content model for supported `cover`, `toc`, `content`, and `summary` slides.
- The shared DOM renderer powers browser preview, the compact horizontal thumbnail selector, compare views, per-presentation preview PNGs, per-presentation workflow preview artifacts, PDF export, and CLI builds.
- Deck and slide context, design constraints, validation settings, visual theme values, and manual snapshots persist with the active presentation; assistant sessions and the presentation registry remain repo-local studio state; generated slide candidates stay session-only until applied.
- The browser can create a new presentation from title, audience, tone, objective, constraints, and theme brief; the server bootstraps a small structured slide scaffold before the user expands it.
- Presentation selection uses visual first-slide cards with the presentation name, compact metadata facts, active state, search/filter, duplication, and deletion controls.
- Slide-level workflows, manual slide add/remove controls, deck-planning workflows, assistant-triggered actions, session-only candidates, safe apply flows, and compare views are available from the browser.
- Supported structured slides allow direct text edits and valid JSON spec edits to update the active DOM preview immediately while saving through the server-controlled slide-spec path without a render pass.
- Structured JSON editing and compare source blocks use lightweight syntax highlighting for keys, strings, numbers, and literals.
- The browser UI uses a compact sticky top navigation with the project name first, page controls, current slide identity, and check state kept available without a large pitch header.
- Slide variant generation sits directly below the active preview and selector, and now uses a compact workbench with explicit generation modes, a candidate-count control defaulting to five, progress steps, selected-candidate review state, and visual theme candidates that preview font and color changes before apply.
- Generation diagnostics are collapsed by default and group LLM provider state, current operation text, and recent workflow events behind one inspectable panel.
- Deck checks are available from a compact masthead control that opens an inspectable check console and focused report without becoming a primary workspace page.
- Check settings and rule severity overrides use explicit show/hide disclosure controls so advanced validation configuration stays discoverable without being visible by default.
- Deck planning is consolidated into a compact planning console with palette controls, design guardrails, and deck-plan details hidden until inspection.
- Local deck-planning candidates carry shared deck-context patches and generated content scaffolds use title/body evidence items rather than placeholder metric bars.
- Deck-plan diffs report presentation-scoped slide paths so review copy matches the active storage layout.
- Slide candidate review and visual comparison share one workspace: direct-select rows drive the adjacent current-versus-candidate preview and diff pane, while the compare pane stays hidden until candidates exist.
- Selected-slide context is collapsed by default into a compact disclosure, leaving the active preview and workflow surfaces higher on the page.
- Workflow chat uses compact drawer copy, shorter empty state and message labels, and shorter canned workflow replies.
- Workflow chat can attach selected text from the active slide preview as turn context, shown as a compact selection chip before send and on the saved user message.
- The structured draft drawer uses a wider editor-first sheet with save anchored below the JSON editor and snapshot capture tucked behind a disclosure; Spec and Chat drawer tabs use narrower closed rails on desktop and short bottom handles on mobile, and the slide selector uses a compact preview-only strip with index badges to keep the active slide and current action dominant.
- Studio writes are server-controlled and limited to approved presentation folders, repo-local state, and generated studio artifacts.
- Geometry, text, render, deck-plan, Studio layout, and media-validation fixtures run through the same quality gate used by the CLI; complete media mode also catches visuals that leave the slide viewport, crowd the slide progress area, or have captions/source lines that are detached, above, or horizontally misaligned from the visual.
- Browser workflow validation covers presentation create, duplicate, and delete through the UI and cleans up temporary decks after the run.

## Maintenance Focus

- Keep future UI changes aligned with the pragmatic review direction: prioritize the active presentation, active slide, current workflow, compact status, and inspectable secondary controls.
- Keep generated artifacts, archive publishing, visual baselines, and workflow coverage tied to the active presentation as multiple-deck workflows expand.
- Keep new deck-planning modes tied to shared deck-context patches when they change narrative direction, theme, constraints, or other deck-level decisions.
- Deepen DOM media validation only when new media-heavy slide families expose concrete screenshot, chart, diagram, or legibility gaps beyond the current size, bounds, spacing, labeling, loading, and caption/source attachment checks.
- Correct stale documentation opportunistically if it refers to removed rendering, validation, or authoring paths as active implementation.

## Phase Snapshot

| Phase | Status | Outcome |
| --- | --- | --- |
| 1. Studio Shell And Runtime Bridge | complete | Local browser studio shell and server bridge exist. |
| 2. Preview And Status Pipeline | complete | Preview, build, and validation feedback run through the studio. |
| 3. Persistent Context Model | complete | Deck and slide context persist in repo-local state. |
| 4. Structured Workflow Operations | complete | Slide, wording, theme, structure, and deck workflows run through guarded actions. |
| 5. Slide Variant System | complete | Variants are persistent, previewable, comparable, and safely applicable. |
| 6. File Editing Boundary | complete | Studio writes are centralized and constrained to approved paths. |
| 7. Validation And Diff UX | complete | Validation and compare surfaces show structured summaries and decision cues. |
| 8. First End-To-End Milestone | complete | The original edit, ideate, preview, apply, and validate slice is complete. |
