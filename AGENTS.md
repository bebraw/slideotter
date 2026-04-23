# Repository Instructions

## Design Notes

These are durable presentation design and workflow rules for this repository. Read and follow them before editing slides or shared generator helpers.

### Design Rules

- Treat projected-slide typography as presentation content, not document content.
- Keep slide text simple and minimal. Prefer short bullets or short sentences, and keep each visible line doing one clear job.
- Do not solve wording problems by shrinking text until hierarchy weakens. Rewrite, split the content, or move detail off-slide instead.
- Use visual emphasis sparingly. One strong focal element per slide is usually enough.
- Keep visible whitespace around images, captions, neighboring panels, and the bottom progress area so slides do not feel cramped.
- Place figure labels and captions as attached captions, preferably below the visual, instead of floating them above unrelated content.
- When a slide includes an image plus a caption or source line, validate the spacing in the rendered PDF, not only in source coordinates.
- In stacked cards or bullet panels, keep title-to-body spacing and inter-item spacing consistent so one block does not visually crowd the next.
- Prioritize screenshot and diagram legibility over decorative framing. Remove or lighten framing when it reduces readability.
- Keep slide copy short enough that it remains readable at presentation scale.

### Workflow Rules

- Rebuild the deck after every slide or theme change so `slides/output/demo-presentation.pdf` stays current.
- Run `npm run quality:gate` before considering presentation work done.
- If visible output changes intentionally, refresh `generator/render-baseline/` with `npm run baseline:render` before rerunning the gate.
- Keep slide-specific implementation in `slides/` and shared presentation logic in `generator/`.
- If the deck order changes, update the structured slide indices or other active deck-order source in the same change.
- If roadmap or outline structure changes, update the corresponding slide content in the same change so deck structure does not drift.
- For browser studio work, keep `ROADMAP.md` and `STUDIO_STATUS.md` current in the same change.
- Use `ROADMAP.md` for architecture, rollout order, and the next practical slice.
- Use `STUDIO_STATUS.md` for the live implementation snapshot, current gaps, and per-phase status.

### Validation Rules

- Validate layout from the rendered PDF, not just from source coordinates or text-fit checks.
- Check vertical rhythm explicitly: headings, content blocks, media, and captions should feel intentionally spaced rather than top-heavy or cramped.
- When references or citations change, confirm the references slide still fits cleanly above the progress bar and that numbering matches only slide-visible citations.
- When images, screenshots, or diagrams change, check that captions, source lines, and adjacent content still have visible breathing room.
- If one card title or bullet wraps longer than its siblings, adjust wording or spacing so its body does not sit tighter than the others.
