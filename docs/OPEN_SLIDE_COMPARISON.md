# Open Slide And Slideotter: Competitive Notes

This note compares Open Slide with slideotter so we can position slideotter against a newer agent-native slide framework without copying its product center.

Sources reviewed on 2026-06-04:

- Open Slide home: <https://open-slide.dev/>
- Open Slide docs introduction: <https://open-slide.dev/docs>
- Open Slide inspector docs: <https://open-slide.dev/docs/core-feature/inspector>
- Open Slide export docs: <https://open-slide.dev/docs/core-feature/export>
- Open Slide `/create-slide` docs: <https://open-slide.dev/docs/skills/create-slide>
- Open Slide `/apply-comments` docs: <https://open-slide.dev/docs/skills/apply-comments>
- Open Slide GitHub repository: <https://github.com/1weiho/open-slide>

## Short Read

Open Slide is an agent-native React slide framework. slideotter is a guarded presentation workbench.

Open Slide's strength is that every slide is arbitrary React on a fixed 1920x1080 canvas. Agents can write ordinary `.tsx` files, the browser runtime handles scaling and playback, and the inspector creates a tight edit/comment loop between rendered elements and source code.

slideotter's strength is that deck work stays structured, grounded, reviewable, validated, and archive-ready. It gives up arbitrary React as the main authoring surface so generated changes can become candidates, pass through explicit apply boundaries, and remain tied to presentation-scoped sources, materials, state, previews, baselines, and exports.

The main lesson is not "become Open Slide." The lesson is sharper: Open Slide is validating agent-assisted slide creation as a category, while slideotter should keep claiming the workflow around reliable deck decisions.

## What Open Slide Is Optimized For

Open Slide is optimized for agent-authored React decks:

- A deck lives in a generated workspace, with slides under `slides/<id>/index.tsx`.
- Each page is a React component exported in an array.
- The runtime renders a fixed 1920x1080 canvas and scales it uniformly to fit the viewport.
- Authors can use any coding agent that reads and writes React.
- The CLI scaffolds a workspace with `npx @open-slide/cli init`.
- Agent skills such as `/create-slide`, `/slide-authoring`, `/apply-comments`, `/create-theme`, and `/current-slide` guide common workflows.
- The browser inspector can select elements, edit text/typography/color/image sources, and save changes back to disk.
- Inspector comments become `@slide-comment` markers in source, which an agent can later resolve.
- Assets are deck-local, with an assets manager and integrated svgl logo search.
- Present mode includes fullscreen playback, presenter view, speaker notes, and a timer.
- Export targets include a static HTML build and PDF through the browser print path.
- The project is MIT licensed and public, with the GitHub page showing 4.7k stars and a latest `@open-slide/core@1.9.0` release on 2026-06-02 at review time.

Open Slide is strongest for developers and agent-heavy teams who already accept React source as the canonical deck model.

## What Slideotter Is Optimized For

slideotter is optimized for controlled deck production:

- A deck is a presentation workspace with JSON slide specs, deck context, sources, materials, generated candidates, validation state, previews, exports, baselines, and archives.
- The browser Studio is the primary authoring surface.
- The server owns durable writes, generation, validation, archive refresh, and apply boundaries.
- Generated work is proposal-oriented: outlines, slides, variants, layout changes, theme changes, deck-length changes, and repairs are previewed before they become accepted state.
- Sources and image materials are presentation-scoped and inspectable.
- The shared DOM renderer powers preview, thumbnails, comparison, presentation mode, PDF export, PPTX handoff, PNG artifacts, and validation.
- LLM behavior is meant to plan and propose structured content, not write arbitrary runtime behavior.

The core difference: Open Slide asks "what React should the agent write?" slideotter asks "what deck change should be accepted, validated, and archived?"

## Important Differences

| Area | Open Slide | slideotter |
| --- | --- | --- |
| Primary user | developer comfortable with React and agents | presentation author who wants guarded generation |
| Primary unit | React slide workspace | presentation workspace |
| Source model | arbitrary `.tsx` page components | structured JSON slide specs plus deck state |
| Authoring mode | code and browser inspector | browser workbench with structured controls |
| Generation model | agents directly edit React source | LLM output becomes reviewed candidates |
| Layout model | fixed 1920x1080 canvas with arbitrary React/CSS | typed slide families and reusable layout definitions |
| Editing loop | select element, edit or leave source markers | preview, compare, validate, apply |
| Asset model | deck assets plus svgl logo search | presentation materials with source and media metadata |
| Validation | mostly author, agent, and runtime responsibility | layout, text, media, workflow, and render checks |
| Presenter tools | presenter view, notes, timer | browser presentation route, still lighter |
| Export | static HTML and browser-print PDF | PDF archive, PNG previews, image-based PPTX handoff |
| Extensibility | React ecosystem and agent skills | proposed workflow/provider/validator/exporter/layout/theme plugins |
| Best fit | React-native agent deck authoring | source-grounded, reviewable, AI-assisted deck production |

## Competitive Positioning

### Open Slide Is A Closer Competitor Than Slidev

Slidev competes around developer-first Markdown decks. Open Slide competes around the newer claim that coding agents can author slide source directly.

That makes Open Slide more relevant to slideotter's future positioning. It uses a different source model, but it is selling into the same broad shift: users want an agent to make and revise presentation content.

### Slideotter Should Not Claim More Expressiveness

Open Slide's arbitrary React model should remain more expressive than slideotter's structured slide specs. That is a feature of Open Slide, not a weakness.

slideotter should instead claim a different kind of control:

> slideotter is for AI-assisted presentation work that needs source grounding, candidate review, validation, and archived state before the deck is considered done.

This keeps the product claim credible. It also avoids a race to support arbitrary code paths that would weaken slideotter's write and validation boundaries.

### Where Slideotter Can Win

slideotter has a credible advantage when the user cares about:

- source-grounded drafting from presentation-scoped notes, excerpts, URLs, and materials
- first-class outline approval before slide drafting
- candidate comparison before writes
- validation-backed repair suggestions
- deck-length planning with reversible skip/restore state
- visible workflow history and archive refresh
- PDF and rendered-output validation as part of done
- typed slide specs that agents can modify safely
- local app data with multiple presentations, outputs, baselines, and reusable libraries
- future hosted workspace state beyond static web publishing

The competitive message should emphasize acceptance quality and traceability, not raw slide expressiveness.

### Where Open Slide Will Stay Better

Open Slide should remain the better choice when the user wants:

- React as the deck source of truth
- arbitrary component composition, animation, and visualization code
- a coding-agent workflow that writes source directly
- a lightweight scaffolded project
- browser inspector edits that map back to JSX
- in-source comment markers for agent follow-up
- static-site deployment as the natural sharing model
- stronger presenter tooling today

Trying to close all of those gaps would pull slideotter away from its strongest boundary.

## Lessons Worth Borrowing

### 1. Agent-Native Workflow Needs A Concrete Handle

Open Slide's skills are easy to understand: create a slide, author a slide, apply comments, create a theme, read the current selection. They turn a vague agent promise into named operations.

Useful lesson:

- Keep slideotter workflow actions named and visible.
- Make the action target obvious: current slide, outline, theme, source set, candidate, or deck.
- Keep selection-scoped commands concrete enough that an agent does not need a long clarification loop.

This reinforces the existing selection-scoped chat and hypermedia API direction.

### 2. Rendered Selection Is A Strong Agent Primitive

Open Slide publishes selected-element context for agents and uses inspector comments to point agents at exact source locations. That is valuable because it makes "fix this" less ambiguous.

Useful lesson:

- Keep slideotter's rendered-slide selection model product-visible.
- Use selected slide regions to scope variants, repairs, media edits, and text rewrites.
- Prefer structured region identifiers over raw source coordinates, because slideotter's canonical source is not JSX.

This supports ADR 0022 while preserving the structured source model.

### 3. The First Run Should Be Even More Direct

Open Slide's first-run promise is one command, a live canvas, and agent-editable files. slideotter has a richer staged workflow, but it must not make the first success feel buried.

Useful lesson:

- Keep `npx slideotter init --template tutorial` and `npx slideotter studio` prominent.
- Make the first created deck reach an approved outline and visible first draft quickly.
- Keep advanced generation settings out of the critical path unless they are required.

### 4. Inspector Comments Are A Useful Review Shape

Open Slide's `@slide-comment` loop is simple: mark what needs changing in the rendered view, let the agent apply it, then clear the marker.

Useful lesson:

- Consider a slideotter comment or issue model tied to slide regions, validation rows, and candidate review.
- Comments should become reviewed repair or variant candidates, not direct writes.
- Resolved comments should leave enough trace for workflow history without cluttering slide specs.

This fits the future collaboration direction better than source markers.

### 5. Asset Ergonomics Are Product Surface

Open Slide treats image uploads and svgl logo search as part of the core slide authoring flow. That matters because agent-generated decks often need real brand and image assets quickly.

Useful lesson:

- Keep material import, source metadata, replacement, and caption/source attachment easy from the current-slide workflow.
- Brand-kit and logo-provider plugins would be high-value early plugin examples.
- Asset replacement should preserve validation and source metadata, not just file paths.

### 6. Presenter Tooling Is A Competitive Gap

Open Slide already claims presenter view, speaker notes, and timer. slideotter's presentation mode has the right route and two-dimensional navigation baseline, but speaker tooling is still lighter.

Useful lesson:

- Add current slide, next slide, speaker notes, elapsed timer, and overview before adding decorative playback features.
- Keep presenter-only surfaces read-only unless edits intentionally return through Studio review.
- Make detour position and core-path position understandable in presenter mode.

## Where Slideotter Should Not Copy Open Slide

### Do Not Make Arbitrary React The Core Model

Open Slide's value depends on arbitrary React. slideotter's value depends on structured fields, material metadata, source grounding, candidate diffs, validation settings, deck planning, and reversible state.

React import/export can be valuable later, but arbitrary `.tsx` should not become the canonical deck model.

### Do Not Let Agent Skills Write Directly To Deck State

Open Slide can rely on source edits because the deck is code. slideotter should keep server-owned writes and explicit apply boundaries.

Agent-visible operations should produce candidates, materials, validation reports, comments, or export artifacts unless the operation is intentionally a user-approved write.

### Do Not Trade Validation For Canvas Freedom

Open Slide's fixed canvas makes coordinates predictable for agents. slideotter already has a fixed rendered slide surface, but it should keep typed layouts and validation as product constraints.

Freeform canvas editing would only be useful if it still produces structured, validated state.

### Do Not Treat Static HTML As The Whole Product

Open Slide's static output is a strength because the deck is a React site. slideotter's hosted direction includes workspace state, generation jobs, sources, materials, imports, exports, and future collaboration.

The useful lesson is simple publishing ergonomics, not static output as the full collaboration architecture.

## Opportunities For Slideotter

### Open Slide Import Plugin

A plugin could import an Open Slide workspace into slideotter:

- read `slides/<id>/index.tsx` and deck metadata
- render pages through a controlled capture path
- import local assets as presentation materials
- preserve speaker notes where represented
- convert simple text/image pages into structured slide families where practical
- preserve complex React pages as static captured visuals or custom artifacts
- warn when animation, interactivity, data fetching, or component behavior cannot round-trip

This would help Open Slide users bring decks into a reviewable workflow without pretending conversion is lossless.

### Open Slide Export Plugin

A plugin could export a slideotter deck to a constrained Open Slide workspace:

- write `slides/<id>/index.tsx` with one React component per active slide
- copy material assets
- emit a `meta` export with title and theme metadata
- represent supported slide families with generated React/CSS
- include speaker notes where supported
- warn when source provenance, validation state, candidate history, detours, or archive metadata cannot be represented

This should be explicit and lossy where needed, not a hidden replacement for the DOM renderer.

### Region Comments And Review Queue

Open Slide's inspector comments suggest a slideotter-native review feature:

- attach comments to slide regions, media items, validation rows, or outline beats
- turn comments into candidate generation scopes
- show unresolved comments beside candidate comparison
- resolve comments only after apply and validation

This would connect author review, agent requests, and validation into one workflow.

### Brand Asset Provider

The svgl integration is a clear convenience feature. A slideotter plugin slice could support:

- logo search providers
- organization brand-kit folders
- approved color and typography tokens
- license and provenance metadata
- validation checks for unapproved or low-resolution brand assets

That keeps the convenience while fitting slideotter's material model.

## Practical Recommendations

1. Position slideotter as the guarded, source-grounded workbench for agent-assisted deck production.
2. Do not compete on arbitrary React expressiveness.
3. Keep structured JSON slide specs as the canonical deck source.
4. Strengthen selection-scoped commands and region-targeted candidate generation.
5. Consider a comment-to-candidate review queue instead of source-level markers.
6. Improve presenter tooling with notes, next slide preview, timer, and overview.
7. Treat Open Slide import/export as plugin territory with explicit loss warnings.
8. Use Open Slide's asset ergonomics as a benchmark for material import and brand-kit workflows.
9. Keep publish work tied to durable workspace metadata, not only static output.
10. Keep validation and archive fidelity central in all competitive messaging.

## Bottom Line

Open Slide is the stronger tool for agent-authored React decks where code is the product surface. slideotter should not try to become a less expressive Open Slide.

slideotter's stronger opportunity is the controlled workbench around the deck: grounded creation, structured revision, candidate review, validation, presentation-scoped materials, workflow history, and archive-ready output. Open Slide validates that agents belong in slide authoring; slideotter's wedge is making agent output safer to accept.
