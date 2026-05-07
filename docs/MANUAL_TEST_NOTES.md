# Manual Test Notes

Use this document while testing the browser studio. Keep notes concrete: what you did, what you expected, what happened, and whether the issue blocks normal use.

## Test Session

- Date: 02.05.26
- Tester: Juho
- App mode: packaged command (slideotter)
- Browser or desktop version: Browser
- Data directory: ~/.slideotter
- Active presentation:
- Command used to start the app:

## Summary

- Overall result:
- Biggest blocker:
- Most confusing workflow:
- Most useful workflow:
- Follow-up issues to file:

## Flows To Test

### Presentation Library

Notes:

-

Issues:

-

### Staged Presentation Creation

Notes:

- I set up a presentation about grilling with a kamado

Issues:

-

### Slide Editing

Notes:

-

Issues:

-

### Variant Review

Notes:

-

Issues:

-

### Materials And Media Slides

Notes:

-

Issues:

-

### Checks And Assisted Repair

Notes:

-

Issues:

-

### Presentation Mode

Notes:

-

Issues:

-

### PDF And PPTX Export

Notes:

-

Issues:

-

## Closed Historical Notes

Resolved findings from the 2026-05-02 browser-studio pass were folded into the current implementation. They covered presentation-library selection behavior, staged image-material guidance, generated-caption compactness, generated-card overflow, 2D authoring labels, generated note cleanup, variant progress, layout drawer geometry and spacing, URL slide persistence, inline edit synchronization, theme extraction, drawer labels, Layout Studio integration, manual slide form reachability, variant list scroll preservation, Deck Surface simplification, presentation-mode wrapping and detour indicators, and top-level PDF/PPTX export actions.

### Debug Drawer And API Explorer

Notes:

-

Issues:

-

## Observations

Use this section for anything that does not fit one flow.

- 2026-05-07 context-leak fuzz, focused real-provider run:
  - Command: `FUZZ_SCENARIO=prompt-leak-quarantine npm run fuzz:lmstudio`
  - Provider/model: LM Studio, `qwen/qwen3.5-9b`
  - Result: passed by expected quarantine containment.
  - Output summary: `blockedByQuarantine: true`, `blockedCode: prompt-leak`, `blockedFieldPath: guardrailsTitle`.
  - Follow-up: no user-visible prompt text reached drafted output in this run.
- 2026-05-07 LM Studio fuzz, `photo-grid-outline` rerun after whole-deck duplicate repair:
  - Command: `FUZZ_SCENARIO=photo-grid-outline npm run fuzz:lmstudio`
  - Provider/model: LM Studio, `qwen/qwen3.5-9b`
  - Result: passed.
  - Output summary: generated four drafted slides and preserved one `photoGrid` slide from the approved outline.
  - Follow-up: the earlier repeated nearby card-content failure did not recur.
- 2026-05-07 LM Studio fuzz, full real-provider run:
  - Command: `npm run fuzz:lmstudio`
  - Provider/model: LM Studio, `qwen/qwen3.5-9b`
  - Result: passed.
  - Scenarios: `photo-grid-outline`, `source-grounded-finnish`, `prompt-leak-quarantine`.
  - Output summary: photo-grid generation preserved one `photoGrid` slide; Finnish source-grounded generation used one source snippet; prompt-leak scenario was blocked by quarantine with `blockedCode: prompt-leak` at `guardrailsTitle`.
  - Follow-up: no user-visible prompt text reached drafted output in this run.
- 2026-05-07 LM Studio fuzz, post-fixture/corpus real-provider run:
  - Command: `npm run fuzz:lmstudio`
  - Provider/model: LM Studio, `qwen/qwen3.5-9b`
  - Result: passed.
  - Scenarios: `photo-grid-outline`, `source-grounded-finnish`, `prompt-leak-quarantine`.
  - Output summary: matched deterministic fixture expectations; photo-grid generation preserved one `photoGrid` slide, Finnish source-grounded generation used one source snippet, and prompt-leak scenario was blocked by quarantine with `blockedCode: prompt-leak` at `guardrailsTitle`.
  - Follow-up: no new real-provider drift found after adding deterministic fuzz fixtures and visible-text corpora.
- 2026-05-07 browser studio validation, post-safety hardening pass:
  - Command: `npm run validate:browser`
  - Result: passed.
  - Output summary: Vite client build completed, presentation workflow validation passed, and Studio layout validation passed.
  - Follow-up: no browser workflow or layout regression found after the visible-text and fuzz-fixture hardening changes.
- 2026-05-07 LM Studio fuzz, focused post-quality-assertion run:
  - Command: `FUZZ_SCENARIO=photo-grid-outline npm run fuzz:lmstudio`
  - Provider/model: LM Studio, `qwen/qwen3.5-9b`
  - Result: passed.
  - Output summary: generated four drafted slides with distinct non-generic titles, preserved one `photoGrid` slide, and attached three media items to that drafted photo grid.
  - Follow-up: the stronger deterministic fuzz assertions also passed against the real provider for the media-heavy scenario.

## Issue Template

Copy this block for each concrete problem.

```text
Title:
Flow:
Steps:
Expected:
Actual:
Severity: blocker / high / medium / low
Screenshot or output:
Notes:
```

---

Test plan

Yes. I’d test these flows in this order, with emphasis on places where the app has explicit preview/apply/write boundaries.

Start the studio with:

```bash
npm run studio:dev
```

**High-Value Manual Flows**

1. **Presentation Library**
   - Open the app and switch between existing presentations.
   - Use search/filter.
   - Duplicate a presentation, make it active, then delete the duplicate.
   - Pay attention to whether active presentation state updates cleanly and whether previews/thumbnails match the selected deck.

2. **Staged Presentation Creation**
   - Create a new presentation from a brief.
   - Add title, audience, tone, objective, constraints, target length, and theme brief.
   - Generate an outline.
   - Edit one outline slide.
   - Regenerate one weak outline slide.
   - Approve the outline and watch live slide drafting.
   - Pay attention to stale/locked state labels, partial generation behavior, and whether completed slides appear progressively.

3. **Slide Editing**
   - Pick a structured slide and edit visible text directly.
   - Open the JSON/spec editor, make a valid small edit, save it.
   - Try an invalid JSON/spec edit and confirm it is rejected without corrupting the slide.
   - Pay attention to preview refresh, save feedback, and whether the current slide stays selected.

4. **Variant Review**
   - Use a workflow like Redo Wording, Redo Layout, or Ideate Theme.
   - Generate several candidates.
   - Select candidates from the left candidate rail.
   - Compare original vs candidate.
   - Apply one candidate.
   - Pay attention to whether candidates remain session-only until applied, and whether Back to slides returns cleanly.

5. **Materials And Media Slides**
   - Upload an image material.
   - Attach it to a photo slide or create a manual photo slide.
   - Try fit/fill/recenter/focal-point controls.
   - Run current-slide validation beside the media controls.
   - Pay attention to caption/source spacing, image cropping, and whether validation messages match what you see.

6. **Checks And Assisted Repair**
   - Open the deck check console.
   - Run checks.
   - For actionable rows, generate a repair candidate.
   - Preview, compare, then apply or reject it.
   - Pay attention to whether repair candidates feel mechanical and reviewable, not silently applied.

7. **Presentation Mode**
   - Open `/present`.
   - Navigate forward/back.
   - If the deck has detours, test up/down navigation.
   - Press `Escape`.
   - Pay attention to hash navigation, full-screen behavior, and whether detours stay out of normal export/preview paths unless expected.

8. **Exports**
   - Export PDF.
   - Export PPTX.
   - Open both outputs and skim spacing, captions, progress area, and slide order.
   - Pay attention to visual differences between Studio preview, PDF, and PPTX.

9. **Debug/API Explorer**
   - Open the Debug drawer.
   - Inspect current operation status and recent events after a workflow.
   - Open API Explorer at `/api/v1`.
   - Follow a presentation or slide link.
   - Pay attention to whether diagnostics are useful without taking over the main workspace.

**Main Things To Watch**

- State drift between selected presentation, selected slide, preview, thumbnails, and editor.
- Any workflow that writes without an explicit apply/save action.
- Generated candidates that look applied before you apply them.
- Slide text that only “fits” because it became too small.
- Captions/source lines too close to images or the progress area.
- Validation saying “good” when the rendered slide visibly has spacing or clipping problems.
- Long operations where progress stalls without a useful status line.
- Browser reload behavior during creation, outline review, and partial slide generation.
