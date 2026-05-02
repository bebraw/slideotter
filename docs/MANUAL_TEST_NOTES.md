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

- Selecting a presentation leads to slide studio instantly which feels jarring. Maybe double click is better?
  - Addressed: selecting an inactive presentation now keeps the user in the library; opening Slide Studio is explicit through Open or repeated card click.
- Selecting a presentation swaps the presentation cards around. They should remain in place instead.
  - Addressed: selecting a presentation now preserves the library's existing presentation order instead of moving the active deck to the front.

### Staged Presentation Creation

Notes:

- I set up a presentation about grilling with a kamado

Issues:

- It wasn't clear how images are included to individual slides
  - Addressed: staged creation now labels uploads/search as image materials and each outline slide as image guidance.
- The reference for the generated image source was very long and distracting
  - Addressed: imported image materials keep full source metadata internally but use compact URL-free captions for slide display.
- There was content overflow on the fourth slide in the layout
  - Addressed: generated content slides now use tighter card-copy budgets by default.
- It's not clear how to create a 2D presentation
  - Addressed: the manual slide form now names core-slide vs 2D-detour creation explicitly.

### Slide Editing

Notes:

-

Issues:

- The first slide contained a meta text in style "Use this slide as the opening frame for the presentation sequence.". We shouldn't show meta texts like this to the user.
  - Addressed: generated note cleanup now treats internal slide-role instructions as scaffold leaks before writing slide specs.
- While waiting for variants to be generated, there was no visible progress anywhere
  - Addressed: variant generation now opens the controls, updates the progress strip, shows a candidate-rail waiting state, and sets immediate operation status.
- Changing the current slide layout during preview can break the rendered slide. The slide content became clipped/off-canvas while selecting layout controls.
  - Addressed: opening the layout drawer now reserves preview space so layout changes do not push the rendered slide off-canvas.
- Changing the current slide layout spacing control does not appear to have any immediate visual impact.
  - Addressed: custom layout spacing now changes visible region, panel, list, and item spacing immediately.
- The "Preview layout" button feels redundant now that layout controls update the preview instantly.
  - Addressed: the action is now "Validate layout" and no longer implies previews are manual-only.
- Slide Studio should persist the current visible slide in the URL as a query parameter so reloads and shared links restore the same slide.
  - Addressed: selected slide state is persisted and restored through the `slide` query parameter.
- Inline edits update the visible slide, but the structured draft JSON does not reflect the changed contents immediately.
  - Addressed: inline contenteditable input now synchronizes into the structured draft before save.
- Theme description generation should infer and update the font too, not only colors.
  - Addressed: theme generation now infers font family tokens from the brief or extracted site theme.
- Theme description generation did not pick up the colors correctly when using `https://survivejs.com/`.
  - Addressed: URL theme extraction now uses site CSS colors deterministically when fetch succeeds.
- A slide-list section showing "Slide 1 / Slide 2 / Slide 3" with slide types feels completely redundant.
  - Addressed: the duplicate content-run/slide-list rail was removed.
- Drawer rail icons should show the section name on hover with a subtle horizontal show/hide animation.
  - Addressed: drawer toggles now expose animated hover labels.
- Layout Studio feels like it should be integrated into the Slide Studio layout panel instead of living as a separate top-level page.
  - Addressed: Layout Studio now lives inside the Slide Studio layout drawer.
- The add structured slide form in the slide rail does not leave enough reachable space when opened after scrolling; lower fields can be clipped from view.
  - Addressed: opening manual add/remove forms hides the thumbnail rail and keeps the form actions reachable.
- Selecting a variant candidate scrolls the candidate options list upward; selecting/previewing should not move the list.
  - Addressed: candidate rail scroll position is preserved across variant rerenders.
- Drawer rail hover labels should not appear for an already-open sidebar.
  - Addressed: hover labels are suppressed while their sidebar is open.
- Deck Surface shows a redundant slide outline/list; it should focus on theme controls and the actual slide preview.
  - Addressed: Deck Surface now renders only the current slide preview.
- It's not clear how the editing flow should work for 2D slidesets.
  - Addressed: 2D editing is now framed as adding core slides or vertical detours from the manual slide form.

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

- I cannot go back to the first slide to the last by pressing left
  - Addressed: horizontal presentation mode navigation now wraps from first to last and last to first.
- I have no idea how this would work with our 2D slides
  - Addressed: presentation mode now shows subtle vertical indicators when a 2D detour is available above or below the current slide.

### PDF And PPTX Export

Notes:

-

Issues:

- I was not able to find the functionality in the UI
  - Addressed: Export PDF and Export PPTX are now top-level Studio header actions.

### Debug Drawer And API Explorer

Notes:

-

Issues:

-

## Observations

Use this section for anything that does not fit one flow.

-

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
