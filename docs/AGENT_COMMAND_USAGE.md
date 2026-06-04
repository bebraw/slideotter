# Agent Command Usage Tutorial

slideotter can be used in two complementary ways:

- **Studio mode**: the browser app uses slideotter's configured LLM provider, such as LM Studio, OpenAI, or OpenRouter.
- **Agent-command mode**: an external coding agent helps operate slideotter from chat, using the model access already available in that agent.

Agent-command mode is useful when you want a stronger or more interactive model involved without adding another slideotter provider key. The agent still works through slideotter's existing scripts, local APIs, material imports, validation checks, candidates, and apply boundaries.

The command recipes live in [`../skills/slideotter-agent-commands/SKILL.md`](../skills/slideotter-agent-commands/SKILL.md). The product boundary is captured in [`adr/implemented/0055-agent-command-mode.md`](adr/implemented/0055-agent-command-mode.md).

## The Mental Model

Treat the external agent as an expert operator, not as a second deck engine.

The agent can inspect context, propose changes, import approved materials, create candidates, run validation, and export artifacts. It should not silently rewrite accepted slide files when slideotter already has a candidate, material, validation, or apply path for the task.

In practice, a safe session follows this loop:

1. State the goal and active presentation.
2. Let the agent inspect the current deck state.
3. Ask for a proposed action or candidate.
4. Review the result in Studio or in the agent's summary.
5. Apply only the changes you want.
6. Run validation before treating the deck as done.

## Before You Start

Install dependencies and make sure slideotter can run locally:

```bash
npm install
npx slideotter init --template tutorial
npx slideotter studio
```

Open `http://127.0.0.1:4173` and choose or create a presentation. The external agent can still work offline for documentation and project-code tasks, but deck authoring is safest when the Studio server and APIs are available.

If your agent supports repo-local skills, point it at:

```text
skills/slideotter-agent-commands/SKILL.md
```

For Codex in this repository, the skill is available as `slideotter-agent-commands`.

## Example: Create A Deck

Use this style when you want the agent to help turn a brief into a deck while keeping outline approval explicit.

```text
Use the slideotter-agent-commands skill.

Create a new presentation about "Postgres performance basics" for backend engineers.
Audience: senior engineers who know SQL but have not tuned production databases.
Tone: practical and technical.
Target length: 8 slides.
Use Studio's staged creation flow, keep outline approval explicit, and do not write slide specs directly.
```

What should happen:

- The agent gathers the brief, sources, target length, and theme constraints.
- It uses the staged creation flow or local draft API when available.
- It presents the outline for review before slide files are written.
- It validates after materializing or changing presentation output.

## Example: Improve One Slide

Use this style when one slide feels weak and you want an alternative without losing the current version.

```text
Use the slideotter-agent-commands skill.

Improve the current slide for a more executive audience.
Keep the factual claims grounded in the existing deck context.
Create a candidate and summarize what changed before applying.
```

What should happen:

- The agent inspects the active slide and nearby deck context.
- It creates or requests a variant candidate when possible.
- It does not overwrite the accepted slide unless you explicitly ask it to.
- It runs focused validation after apply.

## Example: Apply Review Comments

Use this style when you have critique or notes that need to become scoped deck changes.

```text
Use the slideotter-agent-commands skill.

Apply these review comments:
- Slide 3 is too abstract; make the risk concrete.
- Slide 5 needs the customer logo if we can source it safely.
- Slide 7 has too much text; split or shorten it.

Group the work by slide. Ask before importing any logo. Use candidates for risky editorial changes.
```

What should happen:

- The agent groups comments by slide and affected region.
- Mechanical fixes can use existing repair paths.
- Editorial changes become candidates.
- Logo lookup uses the SVGL provider flow and waits for approval before import.

## Example: Find And Attach A Logo

Use this style when the deck needs a known brand mark.

```text
Use the slideotter-agent-commands skill.

Find the Supabase logo for the current presentation.
Search SVGL, show me the chosen result first, then import it as a presentation-local material if I approve.
Do not hotlink the remote asset.
```

What should happen:

- The agent searches the SVGL material provider by explicit brand name.
- It asks you to confirm the chosen result.
- It imports the SVG as a presentation-scoped material with provenance.
- It attaches through existing material controls or a reviewed candidate.

## Example: Validate And Repair

Use this style before presenting or exporting.

```text
Use the slideotter-agent-commands skill.

Validate the active deck.
Summarize failures by severity and slide.
For safe mechanical issues, propose repairs. For editorial issues, create candidates.
Run the failed checks again after fixes.
```

What should happen:

- The agent runs the narrowest relevant checks first.
- It reports failures clearly instead of hiding baseline or render drift.
- Supported mechanical fixes use assisted remediation.
- Risky changes stay reviewable.
- Presentation work finishes with `npm run quality:gate` when output or runtime behavior changed.

## Example: Export

Use this style when the deck is ready to hand off.

```text
Use the slideotter-agent-commands skill.

Export the active presentation to PDF and PPTX.
Report the artifact paths and the validation status.
Do not refresh the archive unless I ask.
```

What should happen:

- The agent uses existing build/export commands.
- It reports generated file paths.
- It makes clear which validation ran.
- It does not update archive snapshots unless requested.

## Good Prompts

Good agent-command prompts name the skill, the deck goal, the expected boundary, and the validation expectation.

Examples:

- `Use the slideotter-agent-commands skill. Create a candidate, do not apply it yet.`
- `Use the slideotter-agent-commands skill. Search SVGL, ask before import, and preserve provenance.`
- `Use the slideotter-agent-commands skill. Validate first, then repair only low-risk mechanical issues.`
- `Use the slideotter-agent-commands skill. Explain the active deck state without mutating files.`

## Things To Avoid

Avoid prompts that ask the agent to bypass slideotter's workflow.

Risky examples:

- `Just rewrite all slide JSON files from scratch.`
- `Pull whatever logo you find online and put it in the deck.`
- `Ignore validation and export anyway.`
- `Create a React version of this deck instead.`

If you really want direct file edits for a one-off maintenance task, say so explicitly. For normal presentation authoring, keep the candidate/review/apply loop intact.

## Troubleshooting

If the agent cannot find the active presentation, start Studio and choose a presentation in the browser.

If the agent wants to import a remote asset directly, redirect it to the material-provider flow.

If a candidate looks good but validation fails, ask the agent to repair the failing check before applying or exporting.

If the agent changes implementation or slide runtime behavior, run the focused checks and finish with `npm run quality:gate` before treating the work as complete.
