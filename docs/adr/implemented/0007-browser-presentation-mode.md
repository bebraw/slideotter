# ADR 0007: Browser Presentation Mode

## Status

Implemented.

## Context

slideotter can already preview slides in the browser studio and export PDFs, but there is no dedicated mode for presenting a deck directly from the browser. The studio preview is an authoring surface with surrounding controls, while a live presentation needs a distraction-free view that can be used in browser full-screen mode.

The shared DOM renderer is already the authoritative path for browser preview, thumbnails, PDF export, and validation. A presentation mode should build on that renderer instead of creating a separate rendering path.

## Decision

Add a separate browser presentation view for running the active presentation.

The first version should be intentionally small:

- show one rendered slide at a time
- make the slide fill the available browser viewport while preserving the deck aspect ratio
- support next and previous navigation with arrow keys
- support direct entry from the studio for the active presentation
- avoid showing speaker notes, authoring controls, candidate state, validation panels, or editing UI

The expected usage is that authors open presentation mode, put the browser into full-screen mode, and advance through the deck with the keyboard.

## Route And Entry Point

Presentation mode should be a separate route from the studio authoring workspace, such as:

```text
/present
```

or, if presentation identity needs to be explicit:

```text
/present/<presentation-id>
```

The studio should expose a clear "Present" action for the active deck. The presentation view should be shareable as a local URL while the studio server is running, but it does not need authentication, remote sharing, or hosted publishing in this slice.

## Interaction Rules

Keyboard navigation should cover the core presenter loop:

- `ArrowRight`, `PageDown`, and `Space` advance to the next slide
- `ArrowLeft` and `PageUp` move to the previous slide
- `Home` moves to the first slide
- `End` moves to the last slide

The initial requirement is previous/next through arrow keys. Additional common keys can be included if they do not add visible UI or state complexity.

At deck boundaries, navigation should clamp rather than wrap. The presenter should not accidentally jump from the final slide back to the first slide.

## Rendering Rules

Presentation mode should use the same DOM slide renderer as preview and export.

- Render the active deck's non-skipped slides in deck order.
- Preserve slide aspect ratio.
- Center the slide in the viewport.
- Use a dark or neutral page background outside the slide bounds.
- Avoid browser scrollbars during normal presentation.
- Keep focus on the presentation surface so keyboard navigation works immediately after opening the view.

The view may preload adjacent slides if that improves responsiveness, but it should not introduce a second renderer or a separate slide styling model.

## Non-Goals

- no speaker notes in the first version
- no presenter console
- no timer, clock, or elapsed-time display
- no multi-screen support
- no audience link or remote-control mode
- no embedded editing controls
- no slide overview grid
- no PDF export changes

## Implementation Plan

1. Add a presentation route.
   Serve a dedicated presentation document from the studio server using the active presentation by default. If the route includes a presentation id, resolve it through the same presentation registry rules as the studio.

2. Reuse the DOM renderer.
   Render slides through the shared DOM slide runtime and active deck theme. Do not fork slide rendering logic.

3. Add full-viewport presentation CSS.
   Size the slide to the largest rectangle that fits the viewport while preserving aspect ratio. Center it against a neutral background and suppress page overflow.

4. Add keyboard navigation.
   Track the current slide position in browser state and the URL hash. Handle previous/next arrow keys, keep the hash in `#x=<index>` form, and clamp at deck boundaries.

5. Add a studio entry point.
   Add a compact Present action near existing deck-level actions so authors can open presentation mode for the active deck.

6. Validate with browser fixtures.
   Add a focused Playwright or workflow fixture that opens presentation mode, verifies the first slide renders, sends arrow-key events, and confirms the visible slide changes without showing authoring chrome.

## Resolved Questions

- The first implementation should support both `/present` and `/present/<presentation-id>`. `/present` opens the active presentation, while `/present/<presentation-id>` opens a specific registered presentation. Both routes should use the same renderer and navigation behavior.
- Presentation mode should update the URL hash using a coordinate form so it aligns with future two-dimensional navigation. The linear presentation view should use `#x=<index>`, for example `#x=6`. Opening a presentation URL with a valid hash should start on that slide; an invalid or missing hash should fall back to the first visible slide.
- Presentation mode should hide skipped slides by default, matching export behavior. A later presenter or debug option may reveal skipped slides, but the first implementation should navigate only through visible, non-skipped slides.
