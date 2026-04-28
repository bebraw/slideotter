# ADR 0030: Cloudflare Collaboration

## Status

Proposed implementation plan.

## Context

ADR 0019 defines a Cloudflare-hosted deployment model for slideotter. That hosted model introduces workspaces, authenticated presentation resources, managed artifacts, queue-backed jobs, and Durable Objects for per-presentation coordination.

Collaboration should build on that hosted foundation rather than becoming a separate editing model. The local app can remain single-user and local-first, while the Cloudflare version can add shared workspaces, versioned deck changes, and eventually live co-authoring.

slideotter's product boundary still matters in a collaborative setting: users should collaborate through structured slide specs, explicit workflow actions, generated candidates, previews, validation, and apply decisions. Collaboration should not turn the app into an unconstrained multi-cursor WYSIWYG editor.

## Decision Direction

Add collaboration to the Cloudflare-hosted version in phases, starting with shared workspace access and versioned edits before live co-editing.

The first collaborative model should make deck changes attributable, reviewable, recoverable, and conflict-aware. Live presence and real-time updates are useful, but they should sit on top of a durable change model rather than replacing it.

Durable Objects should coordinate per-presentation edit sessions and serialized writes. D1 should store collaboration metadata, membership, permissions, versions, and audit records. R2 should store versioned presentation artifacts and larger snapshots when needed.

## Product Rules

- Collaboration is cloud-only at first; local slideotter remains a single-user local workbench.
- Users collaborate inside workspaces with explicit roles.
- Presentation writes remain server-controlled and scoped by workspace authorization.
- Generated candidates remain proposals until an authorized user applies them.
- Collaborative edits should be attributable to a user, timestamp, and action.
- The app should preserve version history for meaningful deck changes.
- Conflict handling should favor explicit review and recovery over silent last-writer-wins behavior.
- Public presentation links should remain read-only unless the viewer is authenticated and authorized.
- Live presence should be informational before it becomes a hard editing lock.
- Comments and review notes should attach to slides, candidates, validation findings, or deck-level context rather than arbitrary canvas coordinates.

## Collaboration Model

Start with asynchronous collaboration:

- workspace members can open the same presentation
- role-based access controls decide who can view, comment, propose, apply, export, or administer
- edits create version records
- candidate workflows record who generated, reviewed, applied, or rejected a candidate
- comments can be resolved without mutating slide specs
- users can restore or compare meaningful versions

Then add live collaboration:

- presence shows who is viewing a deck or slide
- active workflow runs broadcast status to connected clients
- slide and deck resources update when another user applies a change
- editing locks or leases protect high-risk write surfaces when concurrent edits would be confusing
- users can refresh or rebase local draft state when the deck changes underneath them

Real-time co-editing inside a text field or JSON editor is a later option, not the first collaboration slice.

## Permissions

Use workspace-scoped roles first:

- Owner: manage billing or workspace settings, members, presentations, secrets, and destructive recovery.
- Editor: create and edit presentations, run generation, apply candidates, validate, export, and comment.
- Reviewer: comment, run validation, inspect candidates, and request changes without applying writes.
- Viewer: view private previews and presentation links without authoring access.

Fine-grained sharing can come later for individual presentations, folders, or links. The data model should not assume all workspace members have identical access.

## Change And Version Model

Collaborative writes should produce append-only change records before or alongside the latest presentation state.

Useful change record fields:

```json
{
  "id": "change-id",
  "workspaceId": "workspace-id",
  "presentationId": "presentation-id",
  "actorUserId": "user-id",
  "action": "apply-slide-candidate",
  "baseVersion": 41,
  "resultVersion": 42,
  "summary": "Applied wording candidate to slide 7",
  "affectedSlides": ["slide-07"],
  "createdAt": "2026-04-28T12:00:00Z"
}
```

The latest deck state can stay optimized for reads, but recovery and review should use version history. Large snapshots may live in R2, while D1 stores compact metadata, changed resource ids, and audit rows.

## Conflict Handling

The first implementation should use optimistic concurrency at resource boundaries:

- write actions include a base presentation or slide version
- the server rejects stale writes when the affected resource changed
- the client explains that the deck changed and offers refresh, compare, or regenerate options
- candidate apply should revalidate against the current slide before writing
- long-running generation jobs should record the base version used to create candidates

Use short-lived locks or Durable Object leases for operations that are hard to merge, such as JSON spec editing, deck-wide generation, import, delete, and bulk layout/theme application.

## Live Session Shape

Durable Objects can own one live coordination channel per presentation.

Responsibilities:

- track connected users and selected slides
- broadcast applied changes, validation state, job progress, and candidate state changes
- coordinate write leases for risky operations
- serialize apply actions that target the same presentation
- reconnect clients to the latest presentation version after network interruption

The live channel should not be the source of truth for deck data. Persistent state remains in D1/R2-backed storage, with the Durable Object coordinating active sessions.

## Comments And Review

Add comments after basic shared editing and version history exist.

Comments should be structured resources:

- deck-level comments for narrative, theme, or source strategy
- slide-level comments for content and layout feedback
- candidate comments for review-before-apply discussions
- validation comments or remediation threads for check failures

Comments should support resolve/reopen, author attribution, timestamps, and links to the deck version they were made against. Avoid freeform pixel-anchored comments until the rendered-slide selection model is stable enough to preserve anchors across layout changes.

## Relationship To Existing ADRs

ADR 0019 provides the Cloudflare hosting substrate: workspaces, auth, D1, R2, Durable Objects, queues, and hosted rendering.

ADR 0013's hypermedia API direction should expose collaboration actions such as invite member, comment, request review, acquire edit lease, apply candidate, compare versions, and restore version through advertised actions rather than hidden client route rules.

ADR 0022's selection-scoped commands can later provide stable anchors for comments or collaborative requests, but collaboration should not depend on arbitrary rendered-coordinate selection in the first slice.

ADR 0025's assisted remediation should fit the same review model: generated fixes are candidates that collaborators can inspect, discuss, and apply.

## Implementation Plan

1. Add workspace membership and roles to the Cloudflare data model.
   Keep presentation access workspace-scoped at first.

2. Add version and audit records for presentation writes.
   Record actor, action, base version, result version, affected slides, and summary.

3. Add optimistic concurrency to write and apply actions.
   Reject stale writes and return compare or refresh affordances.

4. Add shared presentation read/write flows.
   Allow multiple workspace editors to open and edit a deck with version-aware refresh.

5. Add live session presence through Durable Objects.
   Broadcast connected users, selected slide, job progress, and applied changes.

6. Add comments and review threads.
   Start with deck, slide, candidate, and validation-comment resources.

7. Add live edit leases for high-risk surfaces.
   Protect JSON editing, bulk deck operations, imports, deletes, and deck-wide generation.

8. Add recovery and restore flows.
   Compare versions, restore a prior version, and preserve audit history.

## Validation

Coverage should include:

- permission tests for owner, editor, reviewer, and viewer actions
- concurrency tests that reject stale slide and deck writes
- candidate apply tests that revalidate against the current version
- version-history tests for apply, restore, and audit metadata
- Durable Object session tests for presence, reconnect, and broadcast ordering
- comment lifecycle tests for create, resolve, reopen, and version anchoring
- cloud smoke tests with two authenticated users editing the same workspace presentation

## Non-Goals

- No local multi-user collaboration in the first implementation.
- No real-time multi-cursor text editing in the first collaboration slice.
- No silent last-writer-wins writes for slide specs or deck context.
- No public unauthenticated authoring links.
- No bypass of candidate review, validation, or server-controlled writes.
- No collaboration state that exists only in a live Durable Object without persistent recovery.

## Open Questions

- Should per-presentation sharing be available in the first slice, or should workspace sharing be enough?
- Should comments ship before live presence, or after version history and optimistic concurrency?
- Which operations require hard edit leases instead of optimistic concurrency?
- Should version history store full snapshots for every write, compact patches, or periodic snapshots plus patches?
- Should reviewers be able to generate candidates, or only inspect and comment on candidates generated by editors?

