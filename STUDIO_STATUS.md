# Browser Studio Status

This file tracks the live implementation snapshot for the browser studio.

Use [`ROADMAP.md`](./ROADMAP.md) for architecture and the next practical maintenance focus.

Durable studio decisions can also be captured under `docs/adr/` when they are more stable than the current implementation snapshot. Implemented decisions live under [`docs/adr/implemented/`](./docs/adr/implemented/) and proposed implementation plans live under [`docs/adr/proposed/`](./docs/adr/proposed/). When a proposed ADR becomes shipped behavior, move it into `implemented/` in the same change.

Current implemented decisions cover workflow controls, pragmatic UI, materials, staged creation, user-data packaging, browser presentation mode, progressive generation preview, DOM-first rendering, reversible deck length scaling, source-grounded generation, the rich slide-family/layout-library baseline, post-creation theme control, token-efficient project coding, and live Slide Studio presentation creation. Current proposed decisions cover richer future layout-family direction, two-dimensional and graph-style presentations, LLM replacement of remaining deterministic workflows, LM Studio model selection, hypermedia APIs, statecharts for graph presentations, Cloudflare cloud hosting, a plugin system for optional extensions, PPTX handoff output, selection-scoped chat commands, inline current-slide variant generation, assisted check remediation, custom layout authoring with preview, custom HTML/SVG visual support, token-efficient LLM generation, Cloudflare collaboration, and presentation outline plans for derived decks. See [`docs/adr/README.md`](./docs/adr/README.md) for the full index.

Current implementation is now DOM-first. Supported JSON slide families render through a shared DOM runtime in the studio and through standalone `/deck-preview` and `/present` documents, studio-triggered PDF export plus preview PNG generation run through Playwright on that same DOM renderer, studio geometry/text validation for those slide families uses DOM inspection, and the CLI PDF build plus quality-gate path now uses the same DOM renderer and DOM validation stack. The optional baseline render gate still exists, but it now compares the current DOM-built PDF against approved raster snapshots under `studio/baseline/<presentation-id>/`.

## Current State

The browser studio baseline is complete.

- The local studio runs through `studio/server/` and `studio/client/`.
- The studio and repo scripts are TypeScript sources executed through Node's type-stripping runtime, and `npm run typecheck` is part of the local and CI quality gates. The packaged `slideotter` command is built into `dist/` as JavaScript so it runs after installation from a tarball.
- Presentations are registry-backed: repo mode keeps the registry in `studio/state/presentations.json`, ignored runtime state in `studio/state/runtime.json` selects the active presentation, and each deck keeps slides plus deck-local state under `presentations/<id>/`; app mode resolves mutable state, presentations, output, baselines, libraries, and archives under `~/.slideotter` via `SLIDEOTTER_HOME` or the `slideotter --data-dir` option.
- Slide-spec JSON is the source content model for supported `cover`, `divider`, `quote`, `photo`, `toc`, `content`, and `summary` slides.
- The shared DOM renderer powers browser preview, the compact horizontal thumbnail selector, compare views, `/present` presentation mode, per-presentation preview PNGs, per-presentation workflow preview artifacts, PDF export, and CLI builds; presentation mode now also exits cleanly with `Escape`, closing a presenter-opened window when possible and otherwise returning to the studio shell.
- Deck and slide context, design constraints, validation settings, visual theme values, and manual snapshots persist with the active presentation; shared deck readers now resolve through the active presentation context; assistant sessions and the presentation registry remain under the active runtime state root; generated slide candidates stay session-only until applied.
- Presentation material metadata and uploaded image files persist with the active presentation; Slide Studio can upload, attach, and detach image materials, and structured slide specs can carry one optional media attachment rendered by the DOM slide runtime.
- Presentation source notes, excerpts, and URLs persist with the active presentation; Deck Planning can store them and generation retrieves matching snippets as grounded draft material before falling back to model knowledge or local rules.
- The included `slideotter` project presentation is a thirty-six-slide onboarding deck with first-class divider slides and varied layouts covering the problem, authoring loop, presentation selection, context, structured slides, materials, generation, review, validation, archive, codebase orientation, staged creation, and roadmap.
- Demo slide copy and generated deck-plan scaffolds point authors at the active presentation's own state paths instead of stale global deck-state paths.
- The browser can create a new presentation from title, audience, tone, objective, constraints, target length, and theme brief; the server generates the initial structured slide set before the user expands it.
- New presentation creation is staged through a locked flow indicator: authors complete the brief, generate an editable outline, then approve it to materialize structured slides from the locked outline one slide at a time. The creation draft survives restarts in ignored runtime state, generation locks the brief snapshot while running, broad Brief fields can expose concrete examples behind compact help affordances, later brief or source changes mark the outline stale, and outline review accepts wording edits, slide-specific source notes, extra source material for regeneration, and a compact live source outline before slide files are written.
- Outline review supports lock-aware refinement: authors can keep strong outline slides during full regeneration and regenerate a single weak outline slide without discarding the rest of the structure.
- After staged creation approves an outline, Studio moves the author directly into Slide Studio and creates a live deck with outline-backed placeholders. The persistent Theme rail tab opens the optional Theme drawer, where saved favorites, explicit theme candidates, palette/font controls, a three-slide real-deck preview, and an impact summary update deck-level theme state without rewriting slide content. During slide drafting, the server publishes per-slide progress, replaces each placeholder after the generated slide validates, writes the accumulated deck after each successful slide, and seeds per-slide context from the approved outline and generated slide plan so partial output remains available if a later LLM call fails.
- Theme normalization enforces WCAG-oriented contrast guardrails for text-like colors and keeps progress fill distinguishable from its track, while the LLM prompt asks generated visual treatment to preserve AA contrast.
- The creation flow exposes a reusable theme library in ignored runtime state so favorite theme settings can be saved and reused by later deck drafts.
- Presentation selection uses visual first-slide cards with the presentation name, compact metadata facts, active state, a prominent create action, search/filter, regeneration, duplication, and deletion controls.
- New presentation setup captures a target slide count, font, core palette, audience, tone, objective, constraints, theme brief, outline-stage starter sources, an optional starter image, and optional open-license image search through Openverse or Wikimedia Commons; the server saves starter or searched material with the new deck before LLM generation, then attaches semantically matching image material to structured slides while the saved target feeds the Deck Planning length scaler.
- Initial presentation generation now requires titled key points, rejects leaked schema labels, strips ellipsis-truncated text, filters unsupplied reference URLs, blocks bibliographic-looking invented citations, and keeps weak-model outputs from writing obviously placeholder-like slide text or internal scaffold labels.
- Slide-level workflows, manual content or divider slide add/remove controls, deck-planning workflows, assistant-triggered actions, session-only candidates, safe apply flows, and compare views are available from the browser.
- Drill Wording now uses the configured LLM to produce same-family structured wording candidates; local validation still owns materialization, preview rendering, and apply.
- Manual quote slide creation is available from Slide Studio, and quote specs render through the shared DOM runtime with a dominant quote, optional attribution, optional source, and optional context.
- Manual photo slide creation is available from Slide Studio using an existing presentation material, and photo specs render one dominant image with attached caption/source text.
- Manual photo-grid slide creation is available from Slide Studio using two to four existing presentation materials, and photo-grid specs render grouped image sets with attached captions.
- Deck-local layout definitions persist in `presentations/<id>/state/layouts.json`; Slide Studio can save and reapply current built-in layout treatments as reusable JSON library items.
- Favorite layouts persist in ignored runtime state so saved layout treatments can be reused across presentations, applied to compatible slides, and removed from the library.
- Saved layouts have portable single-layout and layout-pack JSON exchange document shapes plus visible Studio copy/paste controls for deck-local and favorite libraries, with duplicate imported ids normalized before save.
- Redo Layout can propose compatible deck-local and favorite layouts as session-only candidates, so saved layout definitions flow through the same compare/apply review as generated layout variants.
- Redo Layout candidates can now be saved directly into the deck-local layout library or favorite layout library before applying the candidate.
- Photo-grid Redo Layout candidates now carry schema-backed reusable arrangement definitions so generated split-photo layouts can be saved, exported, imported, and reapplied through the layout library.
- Redo Layout uses the configured LLM for intent-only family-changing candidates; local validated transforms build the actual slide specs from target-family, dropped-field, preserved-field, emphasis, and rationale metadata before preview/apply.
- Custom layout authoring is not yet implemented; ADR 0026 proposes constrained layout editing with real-slide preview, validation, and separate save/apply boundaries.
- Custom HTML/SVG support is not yet implemented; ADR 0027 proposes sanitized static visual artifacts rendered through the shared DOM preview/export path.
- Structured slide specs now carry optional `mediaItems` arrays with per-item image metadata, and the first-class `photoGrid` family renders validated two-to-four image sets with attached captions while preserving the existing single-image `photo` path.
- Ideate Structure now includes explicit family-changing candidates for common conversions such as text-heavy slides to quote/divider and media-backed slides to photo/photo-grid, with compare review calling out the old and new slide family before apply.
- Supported structured slides allow direct text edits and valid JSON spec edits to update the active DOM preview immediately while saving through the server-controlled slide-spec path without a render pass.
- Structured slide specs can carry an optional validated layout treatment, and local content-layout candidates now use those treatments while preserving existing layout choices on generated candidates unless a candidate explicitly changes them.
- Structured JSON editing and compare source blocks use lightweight syntax highlighting for keys, strings, numbers, and literals.
- The browser UI uses a compact sticky top navigation with the project name first, page controls, current slide identity, and check state kept available without a large pitch header.
- Slide Studio uses tabs for the current slide and variant generation, with the selected slide context editor available through a left-side Context drawer; ADR 0024 proposes integrating variant generation directly into the Current slide view and removing those tabs, while ADR 0031 now makes Slide Studio the live surface for post-outline presentation generation.
- Slide variant generation uses a compact workbench with action-specific generation, a candidate-count control defaulting to five, progress steps, selected-candidate review state, a visible live operation line, and visual theme candidates that preview font and color changes before apply.
- Generation diagnostics are collapsed by default and group source retrieval plus recent workflow events behind one inspectable panel.
- LLM-backed workflows publish provider substatus through runtime events, including request submission, streamed LM Studio response chunks, and structured JSON parsing.
- LM Studio structured generation retries one invalid or truncated streamed JSON response with a compact retry prompt and larger output budget, and initial presentation slide drafting reserves a larger output budget for complete structured JSON.
- Generation diagnostics also show the source snippets retrieved for the last generated deck, including the bounded source prompt budget, so source grounding remains inspectable without becoming primary UI.
- Deck checks are available from a compact masthead control that opens an inspectable check console and focused report without becoming a primary workspace page.
- Check remediation is not yet implemented; ADR 0025 proposes turning actionable validation failures into scoped repair candidates that the user chooses before apply.
- Check settings and rule severity overrides use explicit show/hide disclosure controls so advanced validation configuration stays discoverable without being visible by default.
- Deck planning is consolidated into a compact planning console with palette controls, design guardrails, and deck-plan details hidden until inspection.
- Deck Planning can scale the active presentation to a target slide count through deterministic or semantic keep/skip/restore/insert plans; scaling down marks slide specs as skipped rather than deleting them, skipped slides can be restored individually or in bulk, and semantic growth can add structured detail slides when restored slides are not enough.
- Reusable presentation outline plans are not yet implemented; ADR 0032 proposes generating editable outline plans from existing decks and using approved plans to derive new presentations or propose current-deck changes.
- Local deck-planning candidates carry shared deck-context patches, use presentation-scoped path labels, and generate content scaffolds with title/body evidence items rather than placeholder metric bars.
- Deck-plan diffs report presentation-scoped slide paths so review copy matches the active storage layout.
- Slide candidate review and visual comparison share one workspace: direct-select rows drive the adjacent current-versus-candidate preview and diff pane, while the compare pane stays hidden until candidates exist.
- Selected-slide context is a direct tabbed editor view rather than a nested disclosure.
- Workflow chat uses compact drawer copy, shorter empty state and message labels, shorter canned workflow replies, and Chat/Log tabs so history does not crowd the main action surface.
- Workflow chat can attach selected text from the active slide preview as turn context, shown as a compact selection chip before send and on the saved user message.
- The structured draft drawer uses a wider editor-first sheet with save anchored below the JSON editor and snapshot capture tucked behind a disclosure; Spec and Chat drawer tabs use narrower closed rails on desktop and short bottom handles on mobile, and the slide selector uses a compact preview-only strip with index badges to keep the active slide and current action dominant.
- Studio writes are server-controlled and limited to approved presentation folders, active state, generated output, baselines, libraries, and archive paths; in user-data mode the write boundary rejects writes into installed app assets and protects `~/.slideotter` as the mutable surface.
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
