# ADR 0065: Timed Paper-To-Presentation Creation

## Status

Proposed implementation plan.

## Context

A presentation derived from a paper is not a document summary laid out across
slides. A useful research talk must select a thesis, contributions, evidence,
methods, limitations, and figures; adapt them to an audience; and fit them into
an actual delivery window.

Slideotter already has the right guarded authoring loop:

- Brief captures audience, objective, tone, constraints, and target slide count
- Outline produces an editable structure before slide files exist
- approved outlines materialize progressively in Slide Studio
- per-slide source notes and bounded retrieval guide each draft
- generated candidates remain reviewable before apply
- narration and validation use the same structured slide and rendering model

The missing model is duration-first planning backed by reviewable paper
evidence. Sending a complete LaTeX project or PDF to every generation call
would exceed weak-model context budgets, obscure which evidence shaped a slide,
and increase the chance of instruction leakage or invented citations.

ADR 0064 defines the reviewed paper artifacts, sections, figures, bibliography,
fingerprints, and locators this workflow consumes.

## Decision Direction

Extend the existing Brief -> Outline -> progressive Slide Studio workflow with
a reviewed paper digest and duration-aware outline. Do not create a separate
paper-deck wizard or a one-click path that writes slides directly from imported
files.

The authoring sequence is:

1. Import and review the LaTeX/PDF paper representations through ADR 0064.
2. Generate or edit a compact `PaperDigest` and figure inventory, then approve
   that interpretation of the paper.
3. Generate a duration-aware outline whose beats carry time, evidence, and
   visual intent.
4. Edit, lock, regenerate, and approve the outline through the existing staged
   creation controls.
5. Draft one slide at a time from that beat's selected evidence and figure
   candidates.
6. Preserve internal claim and figure provenance through preview, apply,
   validation, narration, and export.

Duration is authoritative for this workflow. Slide count is an editable
planning heuristic derived from duration, density, audience, and content. It is
not a substitute for a time budget.

## Paper Digest

Paper import should first produce deterministic structure and extraction
results. A `PaperDigest` is a separate, reviewable authoring interpretation of
those results.

The digest should remain compact and typed:

```ts
interface PaperDigest {
  schemaVersion: 1;
  id: string;
  paperId: string;
  sourceSha256: string;
  pdfSha256: string;
  revision: number;
  title: string;
  thesis: string;
  audiencePrerequisites: readonly string[];
  contributions: readonly EvidenceBackedPoint[];
  methods: readonly EvidenceBackedPoint[];
  findings: readonly EvidenceBackedPoint[];
  limitations: readonly EvidenceBackedPoint[];
  implications: readonly EvidenceBackedPoint[];
  figureCandidates: readonly string[];
  bibliographyEntries: readonly string[];
  approvedAt: string | null;
}
```

Each evidence-backed point should carry concise author-facing wording plus
source ids and locators. The digest should not duplicate the complete paper or
become slide-visible copy by default.

Digest generation is a candidate operation:

- deterministic extraction supplies section, citation, and figure structure
- a configured model may propose thesis, contribution, finding, limitation, and
  implication summaries from bounded sections
- the author can edit, accept, or regenerate the digest
- acceptance records the paper fingerprints, extraction version, provider,
  model, prompt version, and digest revision
- changed paper artifacts make the accepted digest stale and block downstream
  apply until it is reviewed again

## Duration Model

Add duration fields to the creation brief and approved outline plan:

```ts
interface TalkTiming {
  targetDurationSeconds: number;
  deliveryBufferSeconds: number;
}

interface TimedOutlineBeat {
  id: string;
  workingTitle: string;
  intent: string;
  keyMessage: string;
  plannedDurationSeconds: number;
  evidence: readonly SlideEvidenceRef[];
  figureCandidateId?: string;
  optional: boolean;
  deepDive: boolean;
}
```

For a twenty-minute preset, start with 1,050 seconds of planned content and 150
seconds of delivery buffer. Both values are editable. The default slide-count
suggestion may start around twelve to fourteen core slides, but the planner
should change that suggestion when content density, audience, or pacing calls
for it.

Timing rules:

- outline beat durations should sum to the planned content duration within a
  small explicit tolerance
- title, transition, demonstration, and dense evidence slides may receive
  different suggested durations
- optional or deep-dive beats do not consume the core delivery budget unless
  selected for the active path
- backup slides may exist outside the core talk budget
- generated narration may use the existing per-slide `durationSeconds` field,
  but narration timing should not silently overwrite the approved outline plan
- validation should report planned-versus-narrated timing drift and total talk
  duration before export

## Evidence And Provenance

Internal provenance is required from the first paper-to-talk slice, even when
the selected sourcing style does not show citations on every slide.

```ts
interface SlideEvidenceRef {
  evidenceId: string;
  evidenceVersion: string;
  paperId: string;
  relation: "supports" | "contradicts" | "illustrates" | "defines";
  locator: PaperLocator;
}
```

Product rules:

- Factual claims derived from the paper should carry one or more source-backed
  evidence references.
- Figure attachments should carry the original asset fingerprint, paper path,
  label, caption, and PDF page when available.
- Outline beats and generated slide diagnostics should expose their selected
  evidence without forcing provenance into visible slide copy.
- Bibliographic identity must support stable source ids and BibTeX keys, not
  only URLs.
- Generated references must be selected from imported or retrieved
  bibliography records. Never invent a citation.
- A references slide should include only references actually used in visible
  core or selected backup slides.
- Visible citation placement remains controlled by the selected sourcing style
  and slide-family rules. Compact citations must not destroy slide hierarchy or
  crowd the progress area.
- Changes to an accepted digest, evidence snapshot, figure, or outline revision
  should mark dependent candidates stale rather than rewriting slides silently.

## Figure Workflow

Original figures from the LaTeX archive are preferred over PDF crops.

- The digest presents a reviewable figure inventory with label, caption,
  dimensions, format, source path, and likely section.
- An outline beat may suggest a figure, but the author chooses whether to import
  or attach it.
- Selected figures enter the existing presentation material library and use the
  existing server-side material validation and slide attachment rules.
- Generated slide plans receive bounded figure metadata, not arbitrary archive
  paths or raw binary content.
- Captions and source lines stay attached to the visual and must pass rendered
  spacing, legibility, and progress-area checks.
- PDF page crops, semantic PDF figure detection, and multi-panel figure
  decomposition are later options, not first-slice requirements.

## Model Operations And Data Minimization

Paper-to-talk generation should use small, explicit operations rather than one
prompt containing the complete paper and requested deck:

- `digest-paper-section-v1`: propose compact facts and claims from one section
  plus its local captions and citation keys
- `plan-paper-talk-v1`: propose a timed narrative from the reviewed digest
- `draft-paper-slide-v1`: draft one slide from one approved beat and its selected
  evidence and figure metadata
- `verify-paper-slide-v1`: compare one slide's factual claims and figure usage
  against its evidence snapshots

Every operation should record provider, model, prompt version, source and digest
revisions, selected evidence ids, result, timing, and disposition.

Prompt rules:

- do not send the full paper by default
- retrieve with the beat's key message, intent, source notes, and evidence ids
- treat source text as delimited evidence, not instructions
- keep prompt packs bounded and report snippet and character budgets in
  diagnostics
- make model-generated claims proposals until accepted through the existing
  review and apply boundary
- disclose when excerpts from an unpublished paper may leave the local machine
  through the configured provider

## Relationship To Existing ADRs

ADR 0004 and ADR 0039 provide the staged creation and workbench boundaries.
Paper creation extends those stages rather than replacing them.

ADR 0012 and ADR 0031 provide progressive slide drafting after outline
approval. Paper-derived slides should appear through the same placeholder and
validated replacement flow.

ADR 0017 provides bounded source retrieval and inspectable diagnostics. The
paper digest and evidence pointers improve query construction and provenance;
they do not justify unbounded prompt packs.

ADR 0028 requires workflow-scoped, measured prompts suitable for weak local
models.

ADR 0032 provides durable outline plans and derived-deck lineage. Timed outline
fields and paper/digest provenance should extend that structured plan model.

ADR 0046 controls the cloud provider boundary and unpublished-paper disclosure.

ADR 0050 still blocks schema labels, instructions, fabricated bibliography, or
other semantic leaks from visible slide fields.

ADR 0057 and ADR 0059 provide reviewable narration and narrative-first script
generation. Timing comparison may consume narration metadata, but approved talk
timing remains a separate planning authority.

ADR 0061 provides canonical knowledge memory and derived slidesets. An author
may explicitly promote accepted paper claims or evidence into memory; importing
a paper must not silently turn the full document into canonical memory.

ADR 0064 provides the paper artifacts, fingerprints, sections, bibliography,
figures, diagnostics, and locators consumed here.

ADR 0066 provides an optional local Codex gateway behind the existing provider
boundary. It does not broaden paper access: paper workflows still send only the
bounded excerpts selected for the current operation and must disclose that the
gateway's upstream Codex authentication may use a remote service.

## Implementation Plan

1. Add duration and delivery-buffer fields to the creation draft and reusable
   outline-plan contracts while preserving existing target slide counts.
2. Add a versioned paper-digest candidate and review model over ADR 0064's
   extracted structure, section chunks, figures, and bibliography.
3. Add the digest and figure inventory review to the Outline stage before the
   first paper-derived outline can be approved.
4. Extend outline beats with planned duration, key message, evidence pointers,
   figure candidate, optional status, and deep-dive status.
5. Add duration-aware outline generation, editing, locking, regeneration,
   comparison, and total-time validation.
6. Extend slide drafting retrieval with accepted digest revision and selected
   evidence ids, preserving locator-rich diagnostics.
7. Persist claim and figure provenance on generated slide candidates and
   applied slides without placing it in visible text automatically.
8. Extend reference contracts and materialization to accept stable local source
   or BibTeX identity instead of requiring a URL.
9. Add compact visible citations and used-reference collection only after the
   internal provenance path is reliable for all generated slide families.
10. Add planned-versus-narrated duration checks and a final rehearsal summary.
11. Consider a deterministic provenance export containing source hashes,
    digest, timed outline, slide evidence, references, and figure origins after
    the core workflow proves useful.

## Validation

Coverage should include:

- digest construction from multi-section LaTeX with findings, limitations,
  bibliography, and figure candidates
- digest edit, acceptance, stale-source detection, regeneration, and rejection
- twenty-minute preset totals, editable buffer, timing tolerance, optional
  beats, deep dives, backup slides, and slide-count suggestions
- locked and regenerated outline beats preserving accepted timing and evidence
- bounded prompt assembly that excludes unrelated paper sections
- source instruction injection containment and unpublished-paper disclosure
- factual claims and figures retaining stable evidence versions and locators
  through candidate preview, apply, regeneration, narration, and export
- local BibTeX references surviving materialization without URL-only rejection
- references output containing only actually used bibliography entries
- figure caption, source-line, spacing, legibility, and progress-area checks in
  the rendered PDF
- browser workflow from paper preview through digest review, timed outline
  approval, progressive drafting, diagnostics, validation, and cleanup

## Non-Goals

- No one-click unreviewed deck generation from a paper.
- No automatic conversion of a complete paper into slide-visible summary text.
- No requirement that slide count alone represent talk length.
- No embeddings or vector database until paper workflows demonstrate retrieval
  misses that keyword and locator-aware ranking cannot solve.
- No automatic OCR, PDF figure recovery, or PDF crop suggestions in the first
  slice.
- No mandatory visible citation on every slide.
- No automatic promotion of imported paper content into canonical memory.
- No second renderer or PDF-backed slide format.
- No attempt to replace a presenter's rehearsal judgment with timing metadata.

## Open Questions

- Should duration become a general creation field for every deck immediately,
  or first appear only when a paper import is selected?
- Should the default delivery buffer be a percentage, an absolute duration, or
  a preset-specific value?
- Which slide families should support compact visible citations in the first
  citation-rendering slice?
- Should figure selection occur during digest review, outline review, or both?
- When should accepted paper claims become eligible for explicit promotion into
  presentation memory?
