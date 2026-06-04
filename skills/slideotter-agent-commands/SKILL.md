---
name: slideotter-agent-commands
description: Use when operating slideotter from an external coding agent or chat command flow, especially to create decks, improve slides, import logos, validate, repair, or export while preserving slideotter's candidate/review/apply boundaries and avoiding separate slideotter model keys.
---

# Slideotter Agent Commands

Use this skill when the user wants an external agent to help operate slideotter instead of relying only on Studio's configured LLM provider.

## Core Rule

Agent-command mode must use slideotter's guarded workflow. Do not write generated slide specs directly when a candidate, material, validation, or apply path exists.

Prefer:

- staged drafts
- imported materials with provenance
- slide or deck candidates
- validation reports
- repair candidates
- normal exports

Avoid:

- direct generated edits to accepted slide files
- hotlinked remote assets
- silent logo imports
- provider-secret workarounds
- alternate React/Vue/HTML deck sources

## Commands

### Create Deck

Use when the user wants a new deck from a brief.

1. Prefer Studio staged creation or the local `/api/v1/presentations/draft` flow when the server is running.
2. Preserve brief, source, material, target length, tone, and theme context.
3. Keep outline approval explicit before slide drafting.
4. If coding offline, write only through existing presentation services or clearly documented user-approved file edits.
5. Validate with `npm run validate:presentation-workflow` or broader checks when behavior changes.

### Improve Slide

Use when the user asks to revise a current slide.

1. Inspect the active slide, deck context, source/material scope, and validation state.
2. Create a variant/candidate when possible.
3. Do not overwrite accepted slide state unless the user explicitly requests a direct edit.
4. Run current-slide validation or the relevant test/fixture after applying.

### Apply Review Comments

Use when comments, notes, or critique should become deck changes.

1. Group comments by slide and affected field or region.
2. Convert each actionable comment into a scoped candidate or mechanical repair.
3. Leave ambiguous comments unresolved and ask one targeted question.
4. Apply only after user approval.

### Find Logo

Use when a slide or outline explicitly needs a brand logo.

1. Use the SVGL material-provider flow from ADR 0054.
2. Search by explicit brand/product name.
3. Ask the user to approve the chosen result before import.
4. Import as a presentation-local material with provenance.
5. Attach through existing media controls or materialized slide candidates.

### Validate Deck

Use when the user asks whether a deck is ready.

1. Run the narrowest relevant validation first.
2. Use `npm run quality:gate` before declaring presentation work done.
3. Summarize failures by severity, slide, and likely repair path.
4. Do not hide render or baseline drift.

### Repair Checks

Use when validation reports actionable failures.

1. Prefer existing assisted check remediation.
2. Keep repairs mechanical where possible.
3. Create candidates for editorial or risky changes.
4. Re-run the failed validation after applying repairs.

### Export Deck

Use when the user wants an artifact.

1. Use `npm run build` or `slideotter build` for PDF.
2. Use `slideotter export pptx` for PowerPoint handoff.
3. Use archive commands only when the user wants the archive refreshed.
4. Report the generated artifact path and validation status.

### Explain Deck State

Use when the user asks what exists or what is active.

1. Inspect active presentation, slide list, deck context, sources, materials, variants, and validation status.
2. Explain current state without mutating files.
3. Point to the next safe command when useful.

## Validation

For docs-only skill edits, run:

```bash
npm run validate:docs
node --test --test-concurrency=1 tests/agent-skills.test.ts
```

For implementation or slide changes, run the relevant focused checks and finish with `npm run quality:gate` when presentation output or runtime behavior changed.
