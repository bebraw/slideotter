# ADR 0013: Hypermedia Application APIs

## Status

Proposed implementation plan.

## Context

The browser studio already has a guarded workflow model: the server owns file writes, validation, generation, preview artifacts, and apply boundaries, while the client presents scoped actions such as create, preview, compare, apply, validate, and present. This has kept the product stable as the studio gained multiple presentations, LLM-backed workflows, staged creation, reusable layouts, source grounding, and deck-length planning.

Headless and agentic usage should build on the same guarded model instead of adding a second, script-specific control surface. A command-line user, test runner, automation agent, or future external client needs to discover what can be done next, submit valid actions, follow progress, inspect candidates, and apply approved changes without relying on undocumented route knowledge or brittle UI scraping.

Plain JSON endpoints can expose data, but they tend to push workflow rules into every client. If clients have to hardcode route sequences, allowed transitions, polling URLs, and apply conditions, the API becomes fragile whenever the studio flow changes. That would work against the current product direction: explicit server-controlled actions, preview before apply, stable validation gates, and structured content boundaries.

## Decision Direction

Design application APIs as hypermedia-driven resources. API responses should include the current resource state plus the available actions and links the client may follow next.

The server remains authoritative for workflow state and permissions. Clients should not infer valid transitions from local rules when the server can expose them directly. A headless or agentic client should be able to start from a small number of stable entry points, then navigate presentations, slides, workflow candidates, checks, generation jobs, and apply actions through links and action descriptors returned by the server.

This does not require strict adherence to one named media type at first. The important product decision is the HATEOAS constraint: application state should drive available API affordances.

## Product Rules

- Expose API entry points that describe the current presentation, selected slide, active workflow state, checks, generation jobs, and available actions.
- Include action descriptors with method, href, expected input shape, destructive or write effect, and human-readable label.
- Keep all writes behind explicit server actions such as apply candidate, save slide spec, run check, generate candidate, accept outline, stop job, or export deck.
- Return only actions that are currently valid for the resource state.
- Keep generated candidates session-only until an apply action is followed.
- Preserve the existing compare-before-apply and validation-before-keep workflow.
- Make long-running generation jobs navigable resources with status, progress, logs or diagnostics links, cancellation affordances, and result links.
- Keep API-visible action labels and diagnostics concise and neutral so they can support both human-facing tools and automation logs.
- Avoid requiring headless clients to know browser route names or studio component structure.

## API Shape

Use stable top-level entry points first:

```json
{
  "resource": "studio",
  "activePresentation": {
    "href": "/api/presentations/slideotter"
  },
  "presentations": {
    "href": "/api/presentations"
  },
  "actions": [
    {
      "id": "create-presentation",
      "method": "POST",
      "href": "/api/presentations",
      "input": "createPresentationRequest",
      "effect": "write"
    }
  ]
}
```

Presentation, slide, workflow, and job resources should follow the same pattern:

```json
{
  "resource": "slide",
  "id": "slide-12",
  "state": {
    "family": "content",
    "validation": "passing"
  },
  "links": {
    "preview": { "href": "/api/presentations/slideotter/slides/slide-12/preview" },
    "checks": { "href": "/api/presentations/slideotter/slides/slide-12/checks" }
  },
  "actions": [
    {
      "id": "generate-wording-candidates",
      "method": "POST",
      "href": "/api/presentations/slideotter/slides/slide-12/workflows/wording",
      "input": "wordingWorkflowRequest",
      "effect": "candidate"
    },
    {
      "id": "save-slide-spec",
      "method": "PUT",
      "href": "/api/presentations/slideotter/slides/slide-12/spec",
      "input": "slideSpec",
      "effect": "write"
    }
  ]
}
```

The first implementation should use lightweight custom JSON with explicit `resource`, `state`, `links`, and `actions` fields. This keeps the local studio contract easy to read, test, and evolve without committing early to a named media type whose conventions may not match slideotter's candidate and apply workflows.

Do not start with HAL, JSON:API, Siren, or OpenAPI links as the runtime representation. Those formats remain useful references, and OpenAPI can still document schemas and routes, but clients should first consume the embedded links and action descriptors returned by the application resources.

Action descriptors should include:

- stable action id
- HTTP method
- href
- human-readable label
- effect classification such as `read`, `candidate`, `write`, `destructive`, or `export`
- input schema id
- optional embedded input fields for small forms
- required scope such as `deck`, `slide`, `selection`, `candidate`, or `job`
- base resource version for write, destructive, and apply actions
- links to preview, compare, diagnostics, or result resources when relevant

Input schemas should be referenced by id by default. Embed only compact form metadata that helps a generic local client render or submit the action, such as required fields, enum options, defaults, and short labels. Larger schemas, nested slide specs, provider-specific generation options, and reusable validation definitions should live behind schema links so responses do not become bulky or stale.

Write, destructive, and apply actions should include optimistic concurrency tokens from the beginning. In local repo mode these tokens can be simple presentation, slide, candidate, or job versions derived from existing state. In cloud or collaboration mode they should map to the version model from ADR 0030. A client that follows an advertised write action should send the advertised base version, and the server should reject stale actions with refresh, compare, or regenerate affordances.

Treat relation names and action ids as the stable client contract before route paths are considered stable. Route paths may change while clients continue to follow links. Stable first-slice relation names should cover:

- API root: `self`, `presentations`, `activePresentation`, `schemas`
- presentation: `self`, `slides`, `selectedSlide`, `deckContext`, `sources`, `materials`, `checks`, `exports`, `present`
- slide: `self`, `preview`, `spec`, `checks`, `candidates`, `workflows`
- candidate: `self`, `preview`, `compare`, `diagnostics`, `source`, `applyTarget`
- job: `self`, `status`, `logs`, `diagnostics`, `result`
- check report: `self`, `findings`, `remediationOptions`, `rerun`

External clients should not automatically receive the full local browser studio action set. The API should classify actions by audience: `local`, `headless`, `external`, and later `plugin` or `cloud`. The local browser studio can see filesystem-adjacent, packaging-sensitive, or experimental actions that are hidden from external clients until user data, auth, permission, and packaging boundaries are complete. Headless local clients should receive the stable guarded authoring set: inspect, generate candidates, preview, compare, validate, apply, export, and present.

## Agentic Usage

Agentic clients should treat the API as a task environment:

- Start at the API root or active presentation resource.
- Read available actions from each response instead of constructing hidden route sequences.
- Prefer candidate-producing actions before write actions.
- Inspect compare, preview, validation, and diagnostics resources before applying changes.
- Follow job resources for generation progress rather than polling ad hoc endpoints.
- Stop when the server exposes no valid action for the requested next step.

This gives agents a narrower and more stable operating surface than direct file edits for normal studio workflows. Direct repository edits can still exist for maintenance work, but application-level authoring should use the same action boundaries as the browser studio.

## Stability Benefits

Hypermedia APIs should improve application stability in four ways:

- Workflow transitions stay centralized on the server.
- Clients become less coupled to route naming and UI structure.
- Invalid actions are easier to prevent because unavailable actions are not advertised.
- Tests can assert both resource state and advertised affordances, catching drift between workflow logic and client behavior.

The stability benefit depends on keeping action descriptors honest. A response that advertises an action must accept that action for the same resource state, and a response must not advertise actions that the server would reject for ordinary workflow reasons.

## Implementation Plan

1. Add a versioned API root resource.
   Expose active presentation, presentation list, and create/select actions.

2. Add hypermedia wrappers around existing presentation and slide API responses.
   Keep current internal handlers where possible, but make public responses include links and actions.

3. Represent workflow candidates and generation jobs as resources.
   Include progress, diagnostics links, result links, cancel or retry actions, and apply actions only when valid.

4. Add action descriptor schemas.
   Validate method, href, id, input schema name, effect, and resource state requirements in tests.

5. Convert browser studio calls gradually.
   Start with read/navigation surfaces, then candidate workflows, then apply/write flows.

6. Add a headless smoke client.
   Exercise create, inspect, generate candidate, preview or check, apply, and export by following advertised links and actions.

7. Document the client contract.
   Keep route names secondary to resource relations, action ids, input schemas, and state transitions.

## Validation

Coverage should include:

- API tests that verify advertised actions match resource state.
- Negative tests proving invalid transitions are not advertised and are still rejected if called directly.
- Workflow tests that generate candidates, inspect results, and apply through action links.
- Job tests for progress, failure, cancellation, retry, and completed result links.
- A headless client smoke test that performs a normal studio authoring task without hardcoded workflow route sequencing beyond the API root.
- Browser regression tests confirming the existing UI can migrate to hypermedia responses without losing guarded apply behavior.

## Proposed Answers

- Start with a custom JSON representation. Use named hypermedia formats as references, not as the first runtime contract.
- Reference input schemas by id by default. Embed only compact form metadata needed by generic clients.
- Include optimistic concurrency tokens on write, destructive, and apply actions from the first slice.
- Stabilize relation names and action ids before treating route paths as stable.
- Give external clients a smaller action set than the local browser studio until auth, user-data, packaging, and permission boundaries are complete.
