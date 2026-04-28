# ADR 0012: Progressive Slide Generation Preview

## Status

Proposed implementation plan.

## Context

Staged presentation creation now separates outline approval from slide drafting. After the user approves an outline, the studio drafts slides sequentially from the locked deck plan and can persist partial slide specs as each slide succeeds.

The current user experience still treats the final slide-drafting stage mostly as a blocking operation. The user waits for the complete generation job to finish before the generated deck becomes useful. This is especially painful with local LM Studio models, where smaller or slower models may take a long time, fail late, or need iterative schema repair. When generation fails on slide 18 of a 20-slide deck, the first 17 successful slides should not feel invisible.

The runtime already has useful pieces for a progressive experience:

- per-slide incremental drafting in the server generation path
- progress events for generation stages
- partial slide specs and slide contexts available during incremental generation
- existing DOM preview and slide navigation surfaces
- staged creation state that can survive a server restart without immediately writing final deck source

## Decision Direction

Stream individual generated slides to the studio as soon as they are completed during the slide-drafting stage, while the remaining slides continue generating in the background.

The creation flow should make partial output visible and inspectable without implying that the deck is complete. Completed slides should appear in the preview/navigation surface with clear generation status. Pending slides should remain placeholders tied to their approved outline beats. Failed slides should keep the successful slides available and show the failure at the affected slide or generation stage.

The user should be able to inspect completed slides while generation continues, but the system should preserve the locked generation snapshot until the run finishes, fails, or is explicitly cancelled. Editing completed generated slides during the same active generation run is deferred for the first implementation to avoid races between user edits and incoming model output.

## Product Rules

- Render each completed slide as soon as its structured spec validates.
- Treat the stream as slide-level output events, not token-level partial JSON. A slide becomes visible only after the complete slide response parses and validates.
- Keep pending outline beats visible as placeholders rather than hiding the rest of the deck.
- Distinguish slide states: pending, generating, complete, failed.
- Do not mark the deck as fully created until the requested generation run reaches a terminal success state.
- If a later slide fails, preserve and show earlier completed slides.
- Allow the user to stop or retry generation without discarding completed slides unless they choose to regenerate from scratch.
- Keep the approved outline snapshot immutable for the active run.
- Defer direct editing of generated slides while the run is active; enable normal editing after success, failure, cancellation, or an explicit "stop and keep completed slides" action.
- Avoid writing committed deck files for an incomplete generation unless the user explicitly accepts the partial deck.

## UI Shape

During Content Draft:

- The slide rail shows all approved outline beats.
- Completed slides use their rendered thumbnail or normal slide title as each slide-level result arrives.
- The currently generating slide has an active progress state.
- Pending slides show title and role from the approved outline.
- Failed slides show a compact error affordance and retry action.
- The main preview shows the latest streamed completed slide by default, but the user can select any completed or pending slide.
- Pending slide preview shows the approved title, intent, key message, source need, and visual need rather than empty slide chrome.
- The primary action area shows run-level status: generating, stopped, failed, or complete.

Keep the UI operational rather than explanatory. Status text should be short and tied to the concrete slide being drafted.

## Server Shape

Represent the active content-drafting run as a resumable runtime job:

```json
{
  "creationDraft": {
    "contentRun": {
      "id": "run-id",
      "status": "running",
      "slideCount": 20,
      "completed": 7,
      "failedSlideIndex": null,
      "slides": [
        { "status": "complete", "slideSpec": {}, "slideContext": {} },
        { "status": "generating" },
        { "status": "pending" }
      ]
    }
  }
}
```

The server remains authoritative for validation and persistence:

- validate each generated slide before exposing it as complete
- write partial runtime state after every completed slide
- publish slide-level output events with slide index, total count, status, and the validated slide preview payload
- keep final deck-file writing as a terminal step unless partial acceptance is explicitly requested
- provide a retry path that starts from the failed or selected slide using the same approved outline snapshot

## Failure And Cancellation

Failure should be recoverable at the slide-run level:

- If a slide fails schema validation or model generation, mark that slide failed and keep earlier completed slides visible.
- Retry should reuse the approved outline and already completed slide contexts unless the user asks to regenerate all slides.
- Cancellation should stop after the current request boundary when possible and keep completed slides in runtime state.
- If the browser disconnects, the server should either continue the active run or preserve enough state to report the current run status when the browser reconnects. The first implementation may keep this single-process only.

## Validation

Coverage should include:

- service tests that incremental generation emits complete slide specs one at a time
- stream tests that completed slides become observable before the full deck reaches a terminal state
- API tests that partial completed slides are returned while the run is not complete
- browser workflow validation that a long generation shows completed slides before the final slide finishes
- failure-path tests that keep completed slides visible when a later slide fails
- cancellation or stop tests once that control exists

## Implementation Plan

1. Add a content-run state model to the creation draft.
   Store pending, generating, complete, failed, and terminal run metadata in ignored runtime state.

2. Stream and persist partial slide results after every completed slide.
   Reuse the existing incremental generation callback, publish a slide-level output event after validation, and make the partial state readable by the client.

3. Render progressive slide rail and preview states.
   Use real slide previews for completed slides and outline placeholders for pending slides.

4. Add run controls.
   Start with passive progress and retry-on-failure. Add stop/cancel once the state boundary is clear.

5. Finalize complete runs into deck files.
   On success, write the full generated slide set and transition to the Theme stage.

6. Add partial acceptance later if needed.
   Accepting an incomplete deck is useful, but it should be explicit because it changes the meaning of the requested deck length.

## Open Questions

- Should the server continue generation if the browser tab closes, or should generation be tied to the active client session?
- Should retry regenerate only the failed slide, all incomplete slides, or the failed slide plus following slides for narrative continuity?
- Should completed slides be editable during active generation once conflict handling exists?
- Should partial deck acceptance create skipped placeholders for unfinished slides or shorten the deck?
