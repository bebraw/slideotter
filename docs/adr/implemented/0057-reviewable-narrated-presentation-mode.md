# ADR 0057: Reviewable Narrated Presentation Mode

## Status

Implemented.

## Context

Browser presentation mode already gives slideotter a full-screen-friendly playback surface for live talks. The next useful demonstration step is letting the system present a deck on behalf of the author, without turning narration into hidden model output or a fragile presenter-only side channel.

A generated deck now needs two related but distinct forms of text:

- visible slide copy, which should stay short and presentation-scale
- spoken narration, which can explain the slide in complete sentences

If narration is generated, it must remain reviewable. Otherwise the system could hide weak wording, prompt leakage, unsupported claims, or awkward phrasing in a field that only appears during playback. Narration also must not require a server-side voice service for the local demo. Browser speech synthesis is already available in modern browsers and fits the local-first presentation mode boundary.

## Decision

Add optional reviewable narration metadata to structured slide specs and use it in browser presentation mode.

Each slide may carry:

- `narration.script`: polished spoken copy that the author can review before presenting
- `narration.advance`: whether presentation mode may advance after speech or should remain manual
- `narration.durationSeconds`: a bounded estimate for review and future timing work

Generated slides should materialize narration from explicit speaker notes when the model provides clean notes, otherwise from the slide's visible title, summary, and key support point. The script is part of the validated slide spec and passes through the same visible-text quarantine boundary used to block prompt leaks and authoring metadata from slide-facing content.

Presentation mode should expose a compact narration panel with:

- a play control that starts browser speech synthesis for the current slide
- pause and stop controls
- a visible script review area
- an explicit **Advance slides** toggle

When **Advance slides** is enabled and the slide narration uses `afterSpeech`, presentation mode advances after the browser finishes speaking. It moves through vertical detours before continuing along the horizontal core path, and it stops at the end of the deck instead of wrapping back to the first slide. Manual keyboard navigation remains available and cancels current speech.

## Product Rules

- Narration is reviewed copy, not hidden speaker notes.
- Generated narration must be in the deck language and must not include private drafting instructions.
- Autopilot slide advancement is opt-in at presentation time through the **Advance slides** control.
- Speech synthesis is a browser runtime feature. Slideotter should not add a server-side text-to-speech dependency for this slice.
- The slide spec owns narration metadata so generated decks, authored decks, and future export/presenter features share one model.
- If speech synthesis is unavailable, presentation mode should fail gracefully and keep normal manual navigation usable.

## Relationship To Existing ADRs

ADR 0007 defines browser presentation mode as the dedicated runtime surface for live playback. This ADR extends that surface without adding editing controls or a second renderer.

ADR 0008 defines two-dimensional core-path and detour navigation. Narrated auto-advance follows that navigation model: detours are traversed before continuing to the next core slide.

ADR 0015 remains authoritative for DOM-first rendering. Narration is attached to the existing DOM-rendered slide document through data attributes and a presentation-only control panel.

ADR 0050 remains the safety boundary. Narration text is treated as reviewable presentation-facing copy and must pass semantic leak quarantine.

ADR 0056 remains the visual/editorial quality boundary. Narration should let visible slides stay concise rather than forcing explanatory prose into slide body text.

## Non-Goals

- No server-side voice generation.
- No audio recording, audio export, or per-slide audio file storage.
- No presenter-console timeline, rehearsal timer, or voice selection UI in this slice.
- No automatic claim expansion beyond the reviewed slide spec.
- No bypass of candidate review, validation, or visible-text quarantine.
- No model-authored JavaScript or runtime behavior.

## Validation

The implemented baseline is covered by focused tests for:

- slide-spec schema validation of narration metadata
- presentation document rendering with narration controls and script review
- generated slide materialization that adds reviewable narration
- visible-text quarantine scanning `narration.script`

The feature also passes the browser presentation workflow validation and the full repository quality gate.
