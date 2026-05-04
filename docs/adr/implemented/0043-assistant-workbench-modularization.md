# ADR 0043: Assistant Workbench Modularization

## Status

Implemented.

## Context

After ADR 0042, `studio/client/app.ts` is a smaller composition shell, but it still owns one user-facing feature cluster: workflow assistant rendering and message application.

The remaining assistant code combines:

- assistant suggestions and message log rendering
- selection chip rendering and clear behavior
- assistant send-button handling
- scoped selection submission
- applying assistant workflow payloads into context, previews, runtime status, validation, deck-structure candidates, and variant review state

Selection capture itself already belongs to `slide-editor-workbench.ts` because it depends on rendered slide DOM selection, inline text editing, field-path metadata, and stale field hashes. The assistant workbench should consume that selected context without taking over selection capture.

## Decision

Add `studio/client/assistant-workbench.ts`.

The assistant workbench owns:

- assistant suggestion rendering and suggestion click behavior
- assistant message log rendering
- selected-assistant-context chip rendering
- sending assistant messages to `/api/v1/assistant/message`
- applying assistant response payloads into assistant session state, deck context, previews, runtime status, validation, deck-structure candidates, and variant state
- mounting the assistant send button

`app.ts` remains responsible for:

- providing the current selected slide id
- providing callback hooks for deck fields, deck-structure candidates, validation, variants, status, previews, and drawer/page shell behavior
- retaining `refreshState`, `loadSlide`, and workbench composition

`slide-editor-workbench.ts` remains responsible for selection capture and stale selection metadata. It calls the assistant workbench through an injected render callback.

## Rules

- Assistant actions remain server-routed through `/api/v1/assistant/message`; the browser does not invent workflow results.
- Selection capture remains owned by slide editing.
- Assistant-applied variants stay proposals until the user applies a candidate.
- Assistant validation results may open the checks panel, but the assistant workbench must not own validation rendering internals.
- Assistant deck-structure results should flow through the deck-planning candidate setter.

## Validation

The implementation added fixture coverage for `assistant-workbench.ts` and keeps the existing browser-client gates:

- `npm run typecheck`
- `npm run validate:dead-code`
- `npm run validate:client-fixture`
- `npm run validate:browser`
