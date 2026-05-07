import { collectVisibleTextIssues, isSemanticLengthLeak } from "../studio/server/services/visible-text-quality.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

type NegativeFixture = {
  expectedCode: string;
  name: string;
  slideSpec: JsonObject;
};

type RedTeamFixture = {
  code: string;
  name: string;
  text: string;
};

const redTeamCorpusPath = fileURLToPath(new URL("../tests/fixtures/visible-text-red-team-corpus.json", import.meta.url));
const redTeamCorpus = JSON.parse(readFileSync(redTeamCorpusPath, "utf8")) as RedTeamFixture[];
const redTeamFieldPaths = [
  "title",
  "summary",
  "note",
  "media.alt",
  "media.caption",
  "bullets.0.title",
  "bullets.0.body",
  "cards.0.title",
  "cards.0.body",
  "signals.0.title",
  "signals.0.body",
  "guardrails.0.title",
  "guardrails.0.body",
  "resources.0.title",
  "resources.0.body",
  "mediaItems.0.title",
  "mediaItems.0.body"
] as const;

const negativeFixtures: NegativeFixture[] = [
  {
    expectedCode: "authoring-meta",
    name: "authoring instruction in guardrail body",
    slideSpec: {
      guardrails: [
        {
          body: "Ensure all claims are supported by official sources.",
          id: "guardrail-one",
          title: "Evidence"
        },
        {
          body: "Keep language accessible for the audience.",
          id: "guardrail-two",
          title: "Audience"
        },
        {
          body: "Avoid technical jargon for a beginner audience.",
          id: "guardrail-three",
          title: "Clarity"
        }
      ],
      guardrailsTitle: "Why it matters",
      signals: [
        {
          body: "The audience sees concrete checks.",
          id: "signal-one",
          title: "Checks"
        },
        {
          body: "The slide stays grounded.",
          id: "signal-two",
          title: "Grounded"
        },
        {
          body: "The wording remains direct.",
          id: "signal-three",
          title: "Direct"
        }
      ],
      signalsTitle: "What changes",
      summary: "Visible copy should stay audience-facing.",
      title: "Visible text boundary",
      type: "content"
    }
  },
  {
    expectedCode: "fallback-scaffold",
    name: "schema-like panel title",
    slideSpec: {
      cards: [
        {
          body: "A real point carries the slide.",
          id: "card-one",
          title: "Specific point"
        }
      ],
      guardrailsTitle: "Guardrails",
      summary: "A real summary stays visible.",
      title: "Scaffold title",
      type: "cover"
    }
  },
  {
    expectedCode: "planning-language",
    name: "semantic deck-length planning rationale",
    slideSpec: {
      guardrails: [
        {
          body: "Semantic length planning added detail where the deck had room to expand.",
          id: "guardrail-one",
          title: "Context"
        },
        {
          body: "The example connects to a visible result.",
          id: "guardrail-two",
          title: "Result"
        },
        {
          body: "The takeaway stays concise.",
          id: "guardrail-three",
          title: "Takeaway"
        }
      ],
      guardrailsTitle: "Why it matters",
      signals: [
        {
          body: "The inserted detail stays concrete.",
          id: "signal-one",
          title: "Concrete"
        },
        {
          body: "The slide supports the surrounding story.",
          id: "signal-two",
          title: "Support"
        },
        {
          body: "The audience sees one useful example.",
          id: "signal-three",
          title: "Example"
        }
      ],
      signalsTitle: "What changes",
      summary: "The example shows the idea in practice.",
      title: "Planning leak",
      type: "content"
    }
  },
  {
    expectedCode: "unsupported-bibliographic-claim",
    name: "unsupported bibliographic-looking claim",
    slideSpec: {
      bullets: [
        {
          body: "Smith et al. reported the decisive result in Journal of Imaginary Systems.",
          id: "bullet-one",
          title: "Unsupported paper"
        }
      ],
      resources: [
        {
          body: "Use supplied URLs only for references.",
          id: "resource-one",
          title: "Reference boundary"
        },
        {
          body: "Keep claims tied to source material.",
          id: "resource-two",
          title: "Source boundary"
        }
      ],
      resourcesTitle: "Further checks",
      summary: "Unsupported citations should fail.",
      title: "Citation leak",
      type: "summary"
    }
  }
];

function redTeamSlideSpec(fieldPath: typeof redTeamFieldPaths[number], text: string): JsonObject {
  const slideSpec: JsonObject = {
    bullets: [{ body: "Concrete audience-facing detail.", id: "bullet-one", title: "Audience detail" }],
    cards: [{ body: "Concrete audience-facing card detail.", id: "card-one", title: "Card detail" }],
    guardrails: [{ body: "Concrete audience-facing check detail.", id: "guardrail-one", title: "Check detail" }],
    guardrailsTitle: "Review boundary",
    media: { alt: "Diagram showing a review boundary.", caption: "Review boundary diagram." },
    mediaItems: [{ body: "Concrete media detail.", id: "media-item-one", title: "Media detail" }],
    note: "Audience-facing speaker note.",
    resources: [{ body: "Concrete source detail.", id: "resource-one", title: "Source detail" }],
    resourcesTitle: "Sources",
    signals: [{ body: "Concrete audience-facing signal detail.", id: "signal-one", title: "Signal detail" }],
    signalsTitle: "Signals",
    summary: "Audience-facing summary.",
    title: "Audience-facing title",
    type: "content"
  };

  const pathParts = fieldPath.split(".");
  let target = slideSpec;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const part = pathParts[index];
    if (part === undefined) {
      break;
    }
    const next = Array.isArray(target) ? target[Number(part)] : target[part];
    if (!next || typeof next !== "object") {
      throw new Error(`Invalid red-team field path: ${fieldPath}`);
    }
    target = next as JsonObject;
  }

  const field = pathParts[pathParts.length - 1];
  if (field === undefined) {
    throw new Error(`Invalid red-team field path: ${fieldPath}`);
  }
  target[field] = text;
  return slideSpec;
}

let failures = 0;

for (const fixture of negativeFixtures) {
  const issues = collectVisibleTextIssues(fixture.slideSpec);
  if (!issues.some((issue) => issue.code === fixture.expectedCode)) {
    failures += 1;
    process.stderr.write(`Visible text fixture "${fixture.name}" did not report ${fixture.expectedCode}. Reported: ${issues.map((issue) => issue.code).join(", ") || "none"}\n`);
  }
}

for (const fixture of redTeamCorpus) {
  for (const fieldPath of redTeamFieldPaths) {
    const issues = collectVisibleTextIssues(redTeamSlideSpec(fieldPath, fixture.text));
    if (!issues.some((issue) => issue.code === fixture.code && issue.fieldPath === fieldPath)) {
      failures += 1;
      process.stderr.write(`Visible text red-team fixture "${fixture.name}" did not report ${fixture.code} at ${fieldPath}. Reported: ${issues.map((issue) => `${issue.code}:${issue.fieldPath}`).join(", ") || "none"}\n`);
    }
  }
}

if (!isSemanticLengthLeak("Semantic length planning added detail where the deck had room to expand.")) {
  failures += 1;
  process.stderr.write("Semantic length leak fixture was not classified as a leak.\n");
}

if (isSemanticLengthLeak("Students compare study paths before choosing an application route.")) {
  failures += 1;
  process.stderr.write("Semantic length positive fixture was incorrectly classified as a leak.\n");
}

if (failures > 0) {
  process.exit(1);
}

process.stdout.write(`Visible text quality validation passed for ${negativeFixtures.length} negative fixtures and ${redTeamCorpus.length} red-team corpus entries across ${redTeamFieldPaths.length} field paths.\n`);
