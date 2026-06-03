# ADR 0051: Demo Hypermedia Affordance Explorer

## Status

Implemented.

## Context

slideotter already has the architectural ingredients for agentic usage: versioned hypermedia API resources, server-owned workflow actions, candidate-producing operations, validation gates, and explicit preview/apply boundaries. Those pieces are useful to agents, but they are not yet visible enough for a short talk or demo.

For a hypermedia talk, the demo should not merely show that an LLM can generate or rewrite slides. The stronger point is that an application can expose its current state and available transitions so a human, browser client, or agent can understand what can happen next. That is the same idea as links and controls in hypermedia-driven applications.

Today, this affordance model is mostly implicit in API responses, browser controls, and server handlers. A presenter can explain it, but the audience cannot easily see it. A demo needs a compact surface that shows the selected resource, its links, and its allowed actions without requiring the audience to read source code or inspect network payloads.

## Decision Direction

Add a demo-oriented hypermedia affordance explorer to Slide Studio.

The explorer should show the current resource and the actions advertised for it. It should make the application affordance model inspectable in the browser UI and align with the `/api/v1` hypermedia resources from ADR 0013.

The explorer is not a generic API client and not a replacement for the normal studio controls. It is a teaching and debugging surface for the same resource/action model the application already exposes.

## Product Rules

- Show the active presentation, selected slide, active job, candidate collection, or selected candidate as a resource.
- Show links and actions as first-class data: relation/action id, method, href, effect, scope, audience, input schema, and base version where applicable.
- Hide raw payload noise by default; let users expand compact JSON when needed.
- Make unavailable actions visibly absent rather than disabled by local client logic.
- Keep labels short enough to read during a live demo.
- Do not allow the explorer to bypass normal server action validation.
- Do not introduce a second route vocabulary for the demo surface; follow the existing `/api/v1` resource contract.
- Keep the feature useful for debugging outside the conference demo.

## UI Shape

The first slice should live in a compact drawer or panel with three sections:

- **Resource**: current resource id, type, state summary, version, and selected presentation/slide.
- **Links**: relation names and target hrefs such as `self`, `slides`, `selectedSlide`, `checks`, `preview`, `candidates`, `workflows`, and `exports`.
- **Actions**: advertised action descriptors such as `generate-wording-candidates`, `apply-candidate`, `validate-presentation`, `export-pdf`, or `save-slide-spec`.

Each action row should show:

- stable id
- human label
- effect (`read`, `candidate`, `write`, `destructive`, `export`)
- method and href
- input schema id or compact input fields
- base version when the action is version-checked

An optional "copy action JSON" control can help during talks and debugging, but the default surface should stay readable without copying anything.

## Demo Value

The explorer lets a presenter say:

> The agent is not guessing from pixels. The app is telling it what it can do next.

That supports a live sequence:

1. Select a dense slide.
2. Open the affordance explorer.
3. Show the slide resource actions.
4. Ask an agent to improve the slide.
5. Show that the agent follows advertised actions and validation links.
6. Compare the before/after result.

The audience sees the hypermedia claim in the product, not only in the slides.

## API Requirements

The explorer should use the same API root and relations that external clients use:

- Start from `/api/v1`.
- Follow `activePresentation` or selected presentation links.
- Follow `selectedSlide`, `workflows`, `candidates`, `checks`, and `exports` links.
- Render action descriptors directly from responses.
- Refresh the resource after write, candidate, or validation actions complete.

If an expected action is missing, the explorer should show the resource state and let the absence stand. It should not reconstruct hidden actions from browser state.

## Non-Goals

- No general-purpose REST console.
- No arbitrary method/href form for calling undocumented endpoints.
- No direct file editing through the explorer.
- No plugin action authoring in the first slice.
- No schema editor.
- No automatic agent execution.

## Implementation Plan

1. Add a resource/action view model that normalizes hypermedia resources for display.
2. Add a browser workbench panel that follows the active presentation and selected slide resources.
3. Render links and actions with compact expandable details.
4. Add copy controls for resource JSON and action descriptors.
5. Add tests that verify the explorer renders advertised actions without inventing unavailable ones.
6. Add one browser validation path that selects a slide and verifies the explorer shows slide workflow actions.

## Validation

Coverage should include:

- view-model tests for resource, link, action, and missing-action display
- browser fixture tests for the drawer/panel wiring
- API tests that keep relation/action names stable for the displayed resources
- negative tests that prove hidden or invalid actions are not synthesized client-side
- accessibility checks for keyboard navigation and readable action labels

