# ADR 0014: Statecharts For Graph Presentations

## Status

Proposed implementation plan.

## Context

ADR 0009 proposes graph-style presentations with explicit directed transitions between slides. That covers prepared branching: a presenter can choose a path, follow a default edge, and move back through visited history.

Some interactive decks need more than static graph edges. A workshop may unlock follow-up slides after a choice is made. A training deck may track whether the audience has completed a prerequisite branch. A demo deck may remember selected persona, product area, or time budget. A scenario deck may need guarded transitions such as "only show remediation if the learner chose the risky option."

Those needs are state management problems. They should not be solved by custom JavaScript in slides, hidden browser state, or ad hoc conditions spread across presentation-mode components. The state model should stay inspectable, validated, and compatible with the structured deck model.

Statecharts provide a useful layer on top of graph navigation: explicit states, events, transitions, guards, actions, and history can describe interaction logic without turning slide content into executable code.

## Decision Direction

Allow graph-style presentations to opt into a declarative statechart model for presentation-run state.

ADR 0009 remains the navigation foundation: slides are still structured slide specs, and graph edges still define possible movement between slides. A statechart augments that graph by describing the runtime state that can influence which transitions are available, which branch labels are shown, and what state changes happen when the presenter selects an option.

The first implementation should use a small, serializable statechart subset rather than a general scripting environment. Statechart definitions should be deck metadata that the studio can inspect, validate, preview, and test.

## Product Rules

- Keep statecharts deck-level and declarative.
- Do not allow arbitrary JavaScript, dynamic code loading, or slide-authored scripts.
- Treat presentation-run state as ephemeral unless the user explicitly saves a run snapshot later.
- Keep default linear and graph navigation usable without statecharts.
- Make statechart-driven branch availability visible in authoring and presentation mode.
- Validate every state id, event id, guard, target, and slide reference before presentation mode treats the deck as ready.
- Keep state changes tied to explicit presentation events such as start, next, back, choose branch, enter slide, exit slide, reset, or timer elapsed if timers are later supported.
- Preserve history-aware back navigation from ADR 0009; statechart history should not make previous-slide behavior surprising.
- Prefer simple declarative guards over expression languages in the first slice.

## Model Shape

A graph presentation can include optional statechart metadata beside navigation metadata:

```json
{
  "navigation": {
    "mode": "graph",
    "startSlideId": "slide-01",
    "edges": [
      {
        "id": "choose-basic",
        "from": "slide-03",
        "to": "slide-04-basic",
        "label": "Basic path",
        "kind": "branch",
        "event": "chooseBasic"
      }
    ]
  },
  "statechart": {
    "initial": "intro",
    "context": {
      "persona": null,
      "completedBranches": []
    },
    "states": {
      "intro": {
        "on": {
          "chooseBasic": {
            "target": "basicPath",
            "assign": {
              "persona": "basic"
            }
          }
        }
      },
      "basicPath": {
        "tags": ["basic"]
      }
    }
  }
}
```

The exact storage shape can change, but the model should preserve:

- stable state ids
- a declared initial state
- optional serializable context values
- named events
- deterministic transitions
- simple guards that reference known state, tags, or context fields
- simple assignments to known context fields
- links between graph edges and events

## Statechart Scope

The first supported subset should be intentionally small:

- finite states
- initial state
- named events
- guarded transitions
- optional state tags
- simple context assignment
- presentation-run history

The first version should not include:

- arbitrary expression evaluation
- spawned actors or background services
- async invoked tasks
- parallel states unless a concrete deck needs them
- persisted learner records or analytics
- time-based transitions unless presentation-mode timing becomes a product need

## Presentation Behavior

Presentation mode should evaluate the current graph position and statechart state together.

- The default next action follows the graph edge that is valid for the current state.
- Branch chooser options include only edges whose event and guard are currently valid.
- Selecting a branch sends the edge event to the statechart, updates presentation-run state, then navigates to the edge target.
- Back navigation follows visited slide history. The first implementation may restore the prior presentation-run state snapshot with each history entry so going back feels reversible.
- Reset returns to the graph start slide and the statechart initial state.

If a statechart rejects an event that a graph edge references, validation should catch the mismatch before presentation mode. Runtime should still fail closed by hiding or disabling the unavailable edge.

## Studio Authoring Rules

The studio should make stateful behavior inspectable before it becomes editable in detail.

The first authoring slice can show:

- current statechart state for a presentation preview run
- outgoing graph edges and their event ids
- whether each branch is currently available
- guard and assignment summaries for the selected slide's outgoing events
- validation warnings for unreachable states, unused events, broken guards, or impossible branches

Full statechart editing can come later. Early editing can be limited to simple branch conditions and assignments that map to supported schema fields.

## Agentic And API Usage

ADR 0013's hypermedia API direction should expose statechart-driven affordances directly. Headless and agentic clients should not need to reimplement statechart logic to know which branch is available.

Presentation-run resources should include:

- current slide id
- current state id
- serializable context
- available navigation actions
- branch actions that are valid in the current state
- reset and back actions when valid

This lets automation exercise interactive decks by following advertised actions while the server remains authoritative for state transitions.

## Validation

Coverage should include:

- schema validation for statechart metadata
- every transition target references a known state
- every graph edge event references a known statechart event when a statechart exists
- guards only reference known states, tags, context fields, or supported predicates
- assignments only write known serializable context fields
- branch availability matches statechart guards in presentation mode
- back navigation restores the expected slide and run state
- reset returns to the declared graph start and initial state
- unreachable states and impossible graph branches are reported clearly

## Implementation Plan

1. Define the statechart metadata schema.
   Start with finite states, events, simple guards, and simple context assignments.

2. Add a presentation-run interpreter.
   Keep it server-owned or shared runtime-owned, deterministic, and independent from slide rendering.

3. Connect graph edges to statechart events.
   Extend ADR 0009 edge metadata with optional event ids and guard summaries.

4. Update presentation mode.
   Filter branch choices through the current statechart state and snapshot run state in history entries.

5. Add authoring inspection.
   Show the selected slide's stateful outgoing transitions and validation results before adding broad statechart editing.

6. Expose stateful affordances through hypermedia APIs.
   Make available branch actions come from the same interpreter used by presentation mode.

7. Add fixtures.
   Include at least one graph deck where branch choices update run state and later slides depend on that state.

## Open Questions

- Should the runtime use an existing statechart library internally, or a small project-specific interpreter for the supported subset?
- Should going back always restore a prior state snapshot, or should some events be marked irreversible?
- What is the smallest useful guard language that remains readable to non-programmer deck authors?
- Should statechart context ever persist with a presentation session, or should it stay run-local only?
- Should statecharts eventually unify creation flow state, generation jobs, and presentation navigation, or remain scoped to presentation mode?
