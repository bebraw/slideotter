# Browser Studio Status

This file tracks the live implementation snapshot for the browser studio.

Use [`ROADMAP.md`](./ROADMAP.md) for architecture, rollout order, and the next build slice.

Durable studio decisions can also be captured under `docs/adr/` when they are more stable than the current implementation snapshot. The current workflow-control decisions are recorded in [`docs/adr/0001-studio-deck-plan-and-validation-controls.md`](./docs/adr/0001-studio-deck-plan-and-validation-controls.md).

Current implementation is now DOM-first. Supported JSON slide families render through a shared DOM runtime in the studio and through a standalone `/deck-preview` document, studio-triggered PDF export plus preview PNG generation run through Playwright on that same DOM renderer, studio geometry/text validation for those slide families uses DOM inspection, and the CLI PDF build plus quality-gate path now uses the same DOM renderer and DOM validation stack. The optional baseline render gate still exists, but it now compares the current DOM-built PDF against approved raster snapshots under `studio/baseline/`.

## Snapshot

Implemented:

- local Node studio server under `studio/server/`
- static browser client under `studio/client/`
- deck rebuild and preview rendering against the live DOM runtime
- geometry, text, and optional render validation through the studio API
- persisted deck and slide context in `studio/state/deck-context.json`
- shared deck metadata and progress chrome that now read live deck context and active slide totals instead of relying only on hardcoded defaults
- saved deck author, company, explicit subject, and language metadata in deck context that now drive shared DOM document metadata and language settings instead of hardcoded defaults
- saved design constraints in deck context for minimum font size, spacing floors, and maximum words per slide, wired into studio validation and the CLI quality gate
- saved validation settings in deck context for per-rule warning vs error severity plus fast vs complete media-validation mode
- saved visual theme values in deck context that now drive the shared deck palette for slide chrome, panel surfaces, neutral card surfaces, and explicit progress-bar colors
- shared deck settings now live under `studio/server/services/`
- capture/apply variant snapshots, with structured slide variants stored alongside slide JSON
- a quiet studio UI pass with sans-serif typography, white canvas treatment, and divider-based layout instead of card containers
- explicit slide workflows: `Ideate Slide`, `Drill Wording`, `Redo Layout`, `Ideate Theme`, and `Ideate Structure`
- a separated workflow surface where variant generation and variant comparison live in distinct views
- a fold-out right-side workflow assistant rail with a compact closed handle, overlay-open behavior, and a persistent open or closed state instead of an in-flow chat block
- a separate deck-planning page for deck brief editing and deck-structure ideation instead of an inline deck context block
- a fold-out left-side structured-draft rail with a compact closed handle, overlay-open behavior, and a persistent open or closed state instead of an inline JSON editor block
- a separate validation page for deck checks, validation actions, and the latest report instead of an inline or docked report block
- the old manual rebuild button and build-status chip removed from the masthead because deck-context saves and workflow actions already rebuild the live deck
- side-by-side compare view with current-vs-candidate previews, source-change summaries, and apply-or-validate actions
- shared DOM slide renderer for `cover`, `toc`, `content`, and `summary`, used by the studio preview surfaces and the standalone `/deck-preview` document
- DOM-rendered current slide preview, thumbnail rail, variant cards, and compare panes for supported structured slides instead of relying on passed-around preview images
- Playwright-backed studio PDF export and preview PNG generation from the same DOM renderer used by the browser preview surface
- Playwright-backed studio geometry/text validation for supported slide families, with studio validation now failing explicitly when the DOM path cannot validate a supported slide
- DOM validation now also covers content-gap floors, contrast, vertical-balance checks, and complete-mode media checks for supported slide families, in addition to bounds, panel padding, minimum font size, and words-per-slide
- CLI `npm run build` now writes the deck PDF through the same Playwright-backed DOM renderer via repo-level scripts
- CLI geometry and text validation entrypoints now also live under repo-level scripts and use the same DOM validation path as the studio
- studio-side preview strips, contact sheets, and page manifests now use `studio/server/services/page-artifacts.js` instead of importing those generic helpers from the baseline utility layer
- approved raster baseline snapshots now live under `studio/baseline/`, with raster diff helpers and CLI wrappers alongside the DOM runtime
- obsolete slide drawing, PDF rendering, text-measurement, config, and validation runtime files have been removed, along with the unused `pdfkit` and `pptxgenjs` dependency chain
- dry-run ideation mode that renders transient variants without saving them to the variant store
- explicit before-and-after source diff panes plus operation-specific change summaries in the compare area
- per-slide workflow locking so overlapping ideation requests do not race on the working slide source
- schema-backed slide-spec materialization for `cover`, `toc`, `content`, and `summary`
- source-to-slide-spec extraction and browser JSON editing for the same four slide families
- server-side LLM client, prompt builder, and structured-output schema modules
- generation mode selection with `auto`, `local`, and `llm` plus clean local fallback
- provider-aware LLM setup for both OpenAI and LM Studio, including live verification and working LM Studio structured-output parsing
- assistant session persistence plus browser chat that can answer, trigger workflows, and run validation
- the included four-slide demo deck ported to JSON slide specs and rendered directly from that structured content
- deck-level presentation-structure ideation through both the browser UI and the assistant
- deck-plan apply that can promote retitles, reordering, inserted slide scaffolds, scaffolded slide replacement, guarded slide archival, and composed deck plans
- deck-planning candidates that can batch-author the full live deck by rewriting multiple slide specs in one guarded dry-run and apply flow
- deck-plan preview and apply plumbing that can now carry a candidate-level shared deck-context patch alongside slide-file mutations, so shared deck settings can participate in the same guarded flow
- stronger pre-apply deck-plan summaries, current/proposed sequence previews, affected-slide preview hints, transient deck-level before-and-after strip summaries, and structured deck-plan diff summaries
- deck-plan compare cards that now show shared deck-setting diffs alongside slide-file diffs, so candidate-wide tone, brief, constraint, and theme changes are inspectable before apply
- deck-plan cards now also expose a per-candidate toggle for whether shared deck settings should apply, while keeping auto-apply as the default path
- the first deck-authoring plans now use that path for real shared deck updates, including tone, subject, theme brief, and visible palette shifts in preview
- key sequence, boundary, decision, operator, compressed, composed, and deck-authoring structure plans now use the same shared deck patch path too, so deck-level flows steer shared context consistently instead of only slide-file shape
- grouped deck-plan impact sections so larger candidates read by action type instead of only as one flat plan list
- slide-level compare summaries that now include structured field-change counts, content-area summaries, and grouped before-and-after change stacks for supported JSON slide types
- browser-visible workflow progress states through an SSE-backed shared runtime stream instead of request polling
- SSE runtime updates that now include explicit workflow events and a short client-visible progress trail instead of only full-state snapshots
- centralized studio write-boundary enforcement for slide files under `slides/slide-*`, repo-local state files under `studio/state/*.json`, and generated artifacts under `studio/output/**`
- validation-page controls for per-rule severity plus fast vs complete media-validation mode, persisted with deck context and honored by the live DOM validation path for current rules
- complete media-validation mode now inspects rendered images, SVGs, canvases, videos, figure-like media nodes, and caption/source text for small visuals, unloaded or dimensionless raster media, upscaled or distorted raster media, missing readable media labels, and tight caption/source spacing
- a media-validation fixture now runs in `npm run validate`, so complete-mode media rule behavior is covered even before the active demo deck includes media-heavy slides

Current gaps:

- shared deck-context steering is now in place for the current local deck-plan modes; future deck-plan modes should keep carrying candidate-level deck patches when their narrative direction changes shared settings
- DOM validation now has first-pass media-specific checks and fixture coverage in complete mode, but media-heavy slide families may still need sharper screenshot, chart, or diagram-specific legibility heuristics once those slides exist in the DOM runtime
- deeper historical guidance should continue to be corrected opportunistically if it presents removed runtime paths as active implementation guidance

## Planned Rework

Next major direction:

- keep slide-spec JSON as the source content model for supported slides
- keep repo-aware deck-level workflows aligned so new plan modes patch shared deck context when they change more than slide files and order
- deepen DOM validation only where new slide families or media-heavy slides still require checks beyond the now-configurable bounds, content gaps, padding, font size, word count, contrast, vertical rhythm, and first-pass media rules
- keep documentation aligned with the DOM-first runtime as older surfaces are touched

## Phase Snapshot

### Phase 1: Studio Shell And Runtime Bridge

Status: complete

### Phase 2: Preview And Status Pipeline

Status: complete

### Phase 3: Persistent Context Model

Status: complete

### Phase 4: Structured Workflow Operations

Status: partial

Implemented so far:

- `Ideate Slide` workflow action for the selected slide
- `Ideate Structure` workflow action for the selected slide through both the browser UI and the assistant
- `Ideate Theme` workflow action for the selected slide through both the browser UI and the assistant
- deck-level presentation-structure ideation through both the browser UI and the assistant, with safe apply back to the saved outline, per-slide structure metadata, promoted slide titles, slide reordering, inserted slide scaffolds, scaffolded slide replacement, guarded slide archival, richer composed deck plans, whole-deck batch-authoring passes, stronger pre-apply deck-plan summaries, affected-slide preview hints, transient deck-level before-and-after strip summaries, structured diff summaries, and shared deck metadata plus live slide totals
- `Drill Wording` workflow action through the assistant and server API
- generated multi-option source variants from stored deck and slide context
- schema-backed slide-spec generation and materialization for `cover`, `toc`, `content`, and `summary`
- source-to-slide-spec extraction for the same four slide families
- feature-flagged generation mode selection so `Ideate Slide` can run through local rules today and an LLM path when configured
- assistant session history and browser chat surface for workflow-triggering requests
- preview images for generated variants without overwriting the working slide
- side-by-side compare view, source-change summary, structured field-diff summary, and apply-plus-validate flow for one chosen variant

Still needed:

- continued discipline that new deck-level workflow operations steer shared deck context when they change narrative direction, not only slide files and order

### Phase 5: Slide Variant System

Status: partial

Implemented so far:

- capture current slide source as a named snapshot
- apply a stored variant back into the working slide
- generate `Ideate Slide` variants with preview images stored under studio output
- compare the current slide and one selected variant inside the workflow area before apply
- store supported slide variants directly in slide JSON so alternate options remain part of the deck content model

Still needed:

- clearer visual decision support for larger changes beyond the current field-level summaries

### Phase 6: File Editing Boundary

Status: complete

Implemented so far:

- write behavior is centralized in the studio server
- current edits are limited to slide source files, shared deck state, and repo-local studio artifacts
- structured slide JSON distinguishes active content from preserved named variants in the same document
- deck-level compose actions stay file-safe by using insert, replace, retitle, reorder, and guarded archival instead of destructive delete flows
- studio writes now pass through an explicit boundary that only allows `slides/slide-*`, `studio/state/*.json`, and `studio/output/**`

### Phase 7: Validation And Diff UX

Status: partial

Implemented so far:

- geometry, text, and render validation are exposed separately
- validation results are shown in the UI
- source diffs, operation-specific summaries, and grouped structured compare summaries exist for slide-level workflows
- deck-plan summaries, affected-slide hints, transient before-and-after strip summaries, grouped action sections, and structured diff summaries exist for deck-level workflows

Still needed:

- clearer diff-oriented visual feedback for larger changes

### Phase 8: First End-To-End Milestone

Status: in progress

What already works:

1. edit deck and slide context in the app
2. run slide-level workflows or deck-structure workflows
3. preview results and compare alternatives
4. apply one result
5. run validation

What still needs polish:

1. keep future deck-level composition flows tied to shared deck context when they change narrative direction
2. richer diff and summary support across more workflow types
3. sharper media-specific DOM validation for future media-heavy slides and the remaining stale-guidance cleanup
