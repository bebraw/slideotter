# Hypermedia Demo Rehearsal

Use this flow to rehearse the Future Frontend hypermedia demo. The point is to show the application contract around agentic work: resources, links, actions, candidates, review, validation, and rebuild.

## Setup

Start the local studio:

```bash
npm run studio:dev
```

Open the URL printed by the command. Use a deck with one visibly dense slide so the improvement task is easy to understand from the audience.

## Talk Track

Frame the demo before touching the UI:

> I am not asking the agent to magically edit a document. I am exposing a hypermedia surface: resources, links, actions, versions, and candidate workflows.

Keep repeating the core loop:

> The agent inspects a resource, follows an advertised action, proposes a candidate, the author reviews it, and the system validates before the deck is rebuilt.

## Rehearsal Steps

1. Open Slide Studio with the dense slide selected.
2. Open the debug drawer and go to **Affordances**.
3. Click **Root**, then **Active**, then **Slide**.
4. Point out the resource URL, links, advertised actions, input schema, and version fields.
5. Use the copy controls only if they help the narration. Do not spend time reading raw JSON aloud.
6. In **Agent Timeline**, click **Replay demo**.
7. Walk through the timeline events: read context, find rewrite action, request candidates, generate candidate, open comparison, apply candidate, validate, rebuild PDF.
8. Open candidate generation for the selected slide.
9. Generate one or two current-slide candidates for the task: "This slide is too dense for a 30-minute talk. Improve it without changing the thesis."
10. Select a candidate and show the before/after comparison.
11. Point out the review loop checklist and the change summary.
12. Use **Apply + validate** for the accepted candidate.
13. Return to the timeline and show that the candidate review and validation steps were recorded.

## Timing

- 3 minutes: setup and framing
- 5 minutes: affordance explorer
- 5 minutes: agent timeline replay
- 8 to 10 minutes: candidate review loop
- 3 minutes: recap and question buffer

## Closing

Close with:

> Hypermedia gives the agent a contract: where it is, what it can do, what inputs are expected, and what version it is acting against. That turns the demo from prompt magic into inspectable application behavior.

## Rehearsal Notes

- Narrate the resource/action/review loop, not the mechanics of the UI.
- Keep the demo scoped to the selected slide by default.
- Prefer one or two candidates so review stays legible.
- Use the replay as a reliable stage fallback if live generation is slow.
- If validation fails, treat it as useful: the boundary is visible and the deck did not silently accept the change.
