# Browser Studio Status

This file tracks the live implementation snapshot for the browser studio.

Use [`ROADMAP.md`](./ROADMAP.md) for architecture and the next practical maintenance focus.

Durable studio decisions can also be captured under `docs/adr/` when they are more stable than the current implementation snapshot. Implemented decisions live under [`docs/adr/implemented/`](./docs/adr/implemented/) and proposed implementation plans live under [`docs/adr/proposed/`](./docs/adr/proposed/). When a proposed ADR becomes shipped behavior, move it into `implemented/` in the same change. Current workflow-control decisions are recorded in [`docs/adr/implemented/0001-studio-deck-plan-and-validation-controls.md`](./docs/adr/implemented/0001-studio-deck-plan-and-validation-controls.md), the pragmatic UI review direction is recorded in [`docs/adr/implemented/0002-pragmatic-ui-review.md`](./docs/adr/implemented/0002-pragmatic-ui-review.md), the material-library workflow is recorded in [`docs/adr/implemented/0003-presentation-material-library.md`](./docs/adr/implemented/0003-presentation-material-library.md), the staged creation flow is captured in [`docs/adr/implemented/0004-staged-presentation-creation.md`](./docs/adr/implemented/0004-staged-presentation-creation.md), the implemented browser presentation mode is captured in [`docs/adr/implemented/0007-browser-presentation-mode.md`](./docs/adr/implemented/0007-browser-presentation-mode.md), the proposed first-class divider and layout-library work is captured in [`docs/adr/proposed/0005-section-dividers-and-rich-slide-families.md`](./docs/adr/proposed/0005-section-dividers-and-rich-slide-families.md), the proposed user-data/app-packaging direction is captured in [`docs/adr/proposed/0006-user-data-home-and-app-packaging.md`](./docs/adr/proposed/0006-user-data-home-and-app-packaging.md), the proposed two-dimensional presentation model is captured in [`docs/adr/proposed/0008-two-dimensional-presentations.md`](./docs/adr/proposed/0008-two-dimensional-presentations.md), and the proposed graph-style presentation model is captured in [`docs/adr/proposed/0009-graph-style-presentations.md`](./docs/adr/proposed/0009-graph-style-presentations.md).

Current implementation is now DOM-first. Supported JSON slide families render through a shared DOM runtime in the studio and through standalone `/deck-preview` and `/present` documents, studio-triggered PDF export plus preview PNG generation run through Playwright on that same DOM renderer, studio geometry/text validation for those slide families uses DOM inspection, and the CLI PDF build plus quality-gate path now uses the same DOM renderer and DOM validation stack. The optional baseline render gate still exists, but it now compares the current DOM-built PDF against approved raster snapshots under `studio/baseline/<presentation-id>/`.

## Current State

The browser studio baseline is complete.

- The local studio runs through `studio/server/` and `studio/client/`.
- The studio and scripts are TypeScript sources executed through Node's type-stripping runtime, and `npm run typecheck` is part of the local and CI quality gates.
- Presentations are registry-backed: `studio/state/presentations.json` lists available decks, ignored runtime state in `studio/state/runtime.json` selects the active presentation, and each deck keeps slides plus deck-local state under `presentations/<id>/`.
- Slide-spec JSON is the source content model for supported `cover`, `divider`, `toc`, `content`, and `summary` slides.
- The shared DOM renderer powers browser preview, the compact horizontal thumbnail selector, compare views, `/present` presentation mode, per-presentation preview PNGs, per-presentation workflow preview artifacts, PDF export, and CLI builds; presentation mode now also exits cleanly with `Escape`, closing a presenter-opened window when possible and otherwise returning to the studio shell.
- Deck and slide context, design constraints, validation settings, visual theme values, and manual snapshots persist with the active presentation; shared deck readers now resolve through the active presentation context; assistant sessions and the presentation registry remain repo-local studio state; generated slide candidates stay session-only until applied.
- Presentation material metadata and uploaded image files persist with the active presentation; Slide Studio can upload, attach, and detach image materials, and structured slide specs can carry one optional media attachment rendered by the DOM slide runtime.
- Presentation source notes, excerpts, and URLs persist with the active presentation; Deck Planning can store them and generation retrieves matching snippets as grounded draft material before falling back to model knowledge or local rules.
- The included `slideotter` project presentation is a thirty-six-slide onboarding deck with first-class divider slides and varied layouts covering the problem, authoring loop, presentation selection, context, structured slides, materials, generation, review, validation, archive, codebase orientation, staged creation, and roadmap.
- Demo slide copy and generated deck-plan scaffolds point authors at the active presentation's own state paths instead of stale global deck-state paths.
- The browser can create a new presentation from title, audience, tone, objective, constraints, target length, and theme brief; the server generates the initial structured slide set before the user expands it.
- New presentation creation is staged through a locked flow indicator: authors complete the brief, generate an editable outline, then approve it to materialize structured slides from the locked outline one slide at a time. The creation draft survives restarts in ignored runtime state, generation locks the brief snapshot while running, broad Brief fields can expose concrete examples behind compact help affordances, later brief or source changes mark the outline stale, and outline review accepts wording edits, slide-specific source notes, extra source material for regeneration, and a compact live source outline before slide files are written.
- Outline review supports lock-aware refinement: authors can keep strong outline slides during full regeneration and regenerate a single weak outline slide without discarding the rest of the structure.
- After staged creation materializes slides, Studio moves the author to the flow's Theme stage, where saved favorites and local theme variants render against a small multi-slide DOM sample set, with a visible apply summary for the selected palette and font before the chosen theme is applied to the active deck context. During slide drafting, the server publishes per-slide progress and writes the accumulated deck after each successful slide so partial output remains available if a later LLM call fails.
- Theme normalization enforces WCAG-oriented contrast guardrails for text-like colors and keeps progress fill distinguishable from its track, while the LLM prompt asks generated visual treatment to preserve AA contrast.
- The creation flow exposes a reusable theme library in ignored runtime state so favorite theme settings can be saved and reused by later deck drafts.
- Presentation selection uses visual first-slide cards with the presentation name, compact metadata facts, active state, a prominent create action, search/filter, regeneration, duplication, and deletion controls.
- New presentation setup captures a target slide count, initial generation mode, font, core palette, audience, tone, objective, constraints, theme brief, outline-stage starter sources, an optional starter image, and optional open-license image search through Openverse or Wikimedia Commons; the server saves starter or searched material with the new deck before generation, then the configured LLM or local rules can attach semantically matching image material to structured slides while the saved target feeds the Deck Planning length scaler.
- Initial presentation generation now requires titled key points, rejects leaked schema labels, strips ellipsis-truncated text, filters unsupplied reference URLs, blocks bibliographic-looking invented citations, and keeps weak-model outputs from writing obviously placeholder-like slide text or internal scaffold labels.
- Slide-level workflows, manual content or divider slide add/remove controls, deck-planning workflows, assistant-triggered actions, session-only candidates, safe apply flows, and compare views are available from the browser.
- Supported structured slides allow direct text edits and valid JSON spec edits to update the active DOM preview immediately while saving through the server-controlled slide-spec path without a render pass.
- Structured slide specs can carry an optional validated layout treatment, and local content-layout candidates now use those treatments while preserving existing layout choices on generated candidates unless a candidate explicitly changes them.
- Structured JSON editing and compare source blocks use lightweight syntax highlighting for keys, strings, numbers, and literals.
- The browser UI uses a compact sticky top navigation with the project name first, page controls, current slide identity, and check state kept available without a large pitch header.
- Slide Studio uses tabs for the current slide, slide context, and variant generation so the preview, context fields, and candidate workflow do not compete for the same viewport.
- Slide variant generation uses a compact workbench with explicit generation modes, a candidate-count control defaulting to five, progress steps, selected-candidate review state, a visible live operation line, and visual theme candidates that preview font and color changes before apply.
- Generation diagnostics are collapsed by default and group source retrieval plus recent workflow events behind one inspectable panel.
- LLM-backed workflows publish provider substatus through runtime events, including request submission, streamed LM Studio response chunks, and structured JSON parsing.
- LM Studio structured generation retries one invalid or truncated streamed JSON response with a compact retry prompt and larger output budget, and initial presentation slide drafting reserves a larger output budget for complete structured JSON.
- Generation diagnostics also show the source snippets retrieved for the last generated deck, including the bounded source prompt budget, so source grounding remains inspectable without becoming primary UI.
- Deck checks are available from a compact masthead control that opens an inspectable check console and focused report without becoming a primary workspace page.
- Check settings and rule severity overrides use explicit show/hide disclosure controls so advanced validation configuration stays discoverable without being visible by default.
- Deck planning is consolidated into a compact planning console with palette controls, design guardrails, and deck-plan details hidden until inspection.
- Deck Planning can scale the active presentation to a target slide count through deterministic or semantic keep/skip/restore/insert plans; scaling down marks slide specs as skipped rather than deleting them, skipped slides can be restored individually or in bulk, and semantic growth can add structured detail slides when restored slides are not enough.
- Local deck-planning candidates carry shared deck-context patches, use presentation-scoped path labels, and generate content scaffolds with title/body evidence items rather than placeholder metric bars.
- Deck-plan diffs report presentation-scoped slide paths so review copy matches the active storage layout.
- Slide candidate review and visual comparison share one workspace: direct-select rows drive the adjacent current-versus-candidate preview and diff pane, while the compare pane stays hidden until candidates exist.
- Selected-slide context is a direct tabbed editor view rather than a nested disclosure.
- Workflow chat uses compact drawer copy, shorter empty state and message labels, shorter canned workflow replies, and Chat/Log tabs so history does not crowd the main action surface.
- Workflow chat can attach selected text from the active slide preview as turn context, shown as a compact selection chip before send and on the saved user message.
- The structured draft drawer uses a wider editor-first sheet with save anchored below the JSON editor and snapshot capture tucked behind a disclosure; Spec and Chat drawer tabs use narrower closed rails on desktop and short bottom handles on mobile, and the slide selector uses a compact preview-only strip with index badges to keep the active slide and current action dominant.
- Studio writes are server-controlled and limited to approved presentation folders, repo-local state, and generated studio artifacts.
- Geometry, text, render, deck-plan, Studio layout, and media-validation fixtures run through the same quality gate used by the CLI; complete media mode also catches visuals that leave the slide viewport, crowd the slide progress area, or have captions/source lines that are detached, above, horizontally misaligned from the visual, or too close to the progress area.
- The quality gate validates presentation slide specs directly, including known layout treatments, so schema drift is caught before browser rendering.
- Browser workflow validation covers presentation create, material upload/attach, reversible deck length scaling, duplicate, and delete through the UI and cleans up temporary decks after the run.
- Initial presentation materialization keeps generated summaries, notes, card bodies, guardrails, and resource text short enough for dense DOM slide layouts.

## Maintenance Focus

- Keep future UI changes aligned with the pragmatic review direction: prioritize the active presentation, active slide, current workflow, compact status, and inspectable secondary controls.
- Keep generated artifacts, archive publishing, visual baselines, and workflow coverage tied to the active presentation as multiple-deck workflows expand.
- Use the proposed staged creation ADR when splitting the current all-at-once presentation creation form into smaller brief, structure, content, theme, and enrichment steps.
- Use the rich slide-family ADR when adding quote slides, photo slides, split-photo layouts, reusable layout libraries, shareable JSON layout definitions, or generation that changes slide family.
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
