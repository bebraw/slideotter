# Browser Studio Status

This file tracks the live implementation snapshot for the browser studio.

Use [`ROADMAP.md`](./ROADMAP.md) for architecture and the next practical maintenance focus.

Durable studio decisions can also be captured under `docs/adr/` when they are more stable than the current implementation snapshot. The current workflow-control decisions are recorded in [`docs/adr/0001-studio-deck-plan-and-validation-controls.md`](./docs/adr/0001-studio-deck-plan-and-validation-controls.md).

Current implementation is now DOM-first. Supported JSON slide families render through a shared DOM runtime in the studio and through a standalone `/deck-preview` document, studio-triggered PDF export plus preview PNG generation run through Playwright on that same DOM renderer, studio geometry/text validation for those slide families uses DOM inspection, and the CLI PDF build plus quality-gate path now uses the same DOM renderer and DOM validation stack. The optional baseline render gate still exists, but it now compares the current DOM-built PDF against approved raster snapshots under `studio/baseline/`.

## Current State

The browser studio baseline is complete.

- The local studio runs through `studio/server/` and `studio/client/`.
- Slide-spec JSON is the source content model for supported `cover`, `toc`, `content`, and `summary` slides.
- The shared DOM renderer powers browser preview, thumbnails, compare views, preview PNGs, PDF export, and CLI builds.
- Deck and slide context, design constraints, validation settings, visual theme values, assistant sessions, and structured variants persist in repo-local studio state or slide JSON.
- Slide-level workflows, deck-planning workflows, assistant-triggered actions, dry-run candidates, safe apply flows, and compare views are available from the browser.
- Supported structured slides allow direct text edits from the active DOM preview while still saving through the server-controlled slide-spec path.
- The browser UI uses a compact sticky top navigation with the project name first and page controls kept available without a large pitch header.
- Slide variant generation now uses a compact workbench with explicit generation modes, dry-run/provider controls, progress steps, candidate counts, and selected-candidate review state.
- The validation page is consolidated into a check console plus compact settings section, with rule-severity overrides behind a disclosure and reports focused on actionable details.
- Deck planning is consolidated into a compact planning console with visible palette swatches, tucked-away design guardrails, and deck-plan details hidden until inspection.
- Studio writes are server-controlled and limited to approved slide files, repo-local state, and generated studio artifacts.
- Geometry, text, render, deck-plan, and media-validation fixtures run through the same quality gate used by the CLI.

## Maintenance Focus

- Keep new deck-planning modes tied to shared deck-context patches when they change narrative direction, theme, constraints, or other deck-level decisions.
- Deepen DOM media validation only when new media-heavy slide families expose concrete screenshot, chart, diagram, or legibility gaps.
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
