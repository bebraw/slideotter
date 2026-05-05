import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import {
  collectGeneratedVisibleText,
  createGeneratedDeckPlan,
  createGeneratedPlan,
  parseMockChatRequest,
  withVisiblePlanFields,
  type GeneratedPlanPoint,
  type GeneratedSlideSpec,
  type JsonRecord
} from "./helpers/presentation-generation-helpers.ts";
import {
  createLlmRuntimeSnapshot,
  createLmStudioStreamResponse
} from "./helpers/presentation-generation-runtime.ts";

const require = createRequire(import.meta.url);

const {
  generateInitialPresentation,
  materializePlan
} = require("../studio/server/services/presentation-generation.ts");
const {
  finalizeGeneratedSlideSpecs
} = require("../studio/server/services/generated-slide-quality.ts");
const llmRuntime = createLlmRuntimeSnapshot();

type MockProgressEvent = JsonRecord & {
  stage?: string;
};

test.after(() => {
  llmRuntime.restore();
});

test("LLM presentation generation semantically shortens overlong visible text", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  const progressEvents: MockProgressEvent[] = [];
  let repairRequestSeen = false;
  let requestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    requestCount += 1;

    if (requestBody.response_format.json_schema.name === "initial_presentation_deck_plan") {
      assert.match(requestBody.messages[0]?.content || "", /Target output language: English/);
      assert.match(requestBody.messages[0]?.content || "", /Use English for user-facing titles, intents, key messages/);
      assert.match(requestBody.messages[0]?.content || "", /hard requirement/);
      assert.match(requestBody.messages[0]?.content || "", /retrieved source snippets are in another language/);
      assert.match(requestBody.messages[1]?.content || "", /Target output language: English/);
      assert.match(requestBody.messages[1]?.content || "", /translate or summarize every visible outline field into English/);
      return createLmStudioStreamResponse(createGeneratedDeckPlan("How to Make Presentations", 3));
    }

    if (requestBody.response_format.json_schema.name === "initial_presentation_plan") {
      assert.match(requestBody.messages[0]?.content || "", /Target output language: English/);
      assert.match(requestBody.messages[0]?.content || "", /Use English for every user-visible field/);
      assert.match(requestBody.messages[0]?.content || "", /hard requirement/);
      assert.match(requestBody.messages[0]?.content || "", /retrieved source snippets are in another language/);
      assert.match(requestBody.messages[0]?.content || "", /approved deck plan is in a different language/);
      assert.match(requestBody.messages[1]?.content || "", /Target output language: English/);
      assert.match(requestBody.messages[1]?.content || "", /translate or summarize every visible slide field into English/);
      return createLmStudioStreamResponse({
        outline: "1. Open\n2. Practice\n3. Close",
        references: [],
        slides: [
          withVisiblePlanFields({
            keyPoints: [
              { body: "Frame the practical goal for the audience before you show any detail.", title: "Goal" },
              { body: "Name the specific audience need that the talk will answer.", title: "Audience" },
              { body: "Preview the workflow in plain words before moving into examples.", title: "Workflow" },
              { body: "Promise one repeatable method that the listener can reuse.", title: "Promise" }
            ],
            role: "opening",
            summary: "Open by explaining the practical outcome and how the deck will help new presenters plan a clear talk.",
            title: "How to Make Presentations"
          }, { eyebrow: "Opening", note: "Start with the practical outcome." }),
          withVisiblePlanFields({
            keyPoints: [
              {
                body: "Practice your talk three times while timing each run to stay within the planned session limit and keep confidence.",
                title: "Practice under real timing conditions"
              },
              {
                body: "Record one rehearsal and watch it once to find distracting habits before the real delivery.",
                title: "Record one rehearsal"
              },
              {
                body: "Ask one peer to identify the moment where the presentation first becomes unclear.",
                title: "Ask for feedback"
              },
              {
                body: "Cut one low-value detail so the central lesson has more space.",
                title: "Trim the middle"
              }
            ],
            role: "example",
            summary: "Show a concrete rehearsal loop that keeps a presentation clear, timed, and easier to deliver.",
            title: "Practice Before You Present"
          }, { eyebrow: "Example", guardrailsTitle: "Checks" }),
          withVisiblePlanFields({
            keyPoints: [
              { body: "Use the same checklist on your next short talk.", title: "Reuse" },
              { body: "Keep notes about what changed after feedback.", title: "Reflect" },
              { body: "Turn one improvement into a habit for next time.", title: "Improve" },
              { body: "Share the deck only after the spoken path works.", title: "Share" }
            ],
            role: "handoff",
            summary: "Close with one next action and a reusable checklist for the next presentation.",
            title: "Use the Checklist"
          }, { eyebrow: "Close", resourcesTitle: "Next cues" })
        ],
        summary: "Coverage plan"
      });
    }

    assert.equal(requestBody.response_format.json_schema.name, "presentation_semantic_text_repairs");
    repairRequestSeen = /Practice your talk three times/.test(requestBody.messages[1]?.content || "");
    return createLmStudioStreamResponse({
      repairs: [
        {
          id: "slide-2-point-1-title",
          text: "Practice with timing"
        },
        {
          id: "slide-2-point-1-body",
          text: "Run three timed rehearsals before presenting."
        }
      ]
    });
  };

  try {
    const generated = await generateInitialPresentation({
      includeActiveSources: false,
      lang: "English",
      onProgress: (event: MockProgressEvent) => progressEvents.push(event),
      targetSlideCount: 3,
      title: "How to Make Presentations"
    });
    const visibleText = collectGeneratedVisibleText(generated.slideSpecs);

    assert.equal(requestCount, 3, "LLM generation should request deck planning, slide drafting, and semantic repair");
    assert.equal(repairRequestSeen, true, "semantic repair prompt should receive the original overlong text");
    assert.ok(visibleText.some((value) => value === "Run three timed rehearsals before presenting."), "semantic repair should preserve meaning in a shorter field");
    assert.ok(!visibleText.some((value) => /Practice your talk three times while timing each run to stay$/i.test(String(value))), "semantic repair should avoid deterministic clipped fragments");
    assert.ok(progressEvents.some((event: MockProgressEvent) => event.stage === "semantic-repair"), "semantic repair should publish progress");
  } finally {
    llmRuntime.restore();
  }
});

test("LLM presentation generation repairs scaffold panel titles from generated points", () => {
  const fields = {
    audience: "Workshop participants",
    objective: "Explain a planning workflow clearly.",
    title: "Workshop planning"
  };
  const plan = {
    outline: "1. Open\n2. Align\n3. Close",
    references: [],
    slides: [
      withVisiblePlanFields({
        keyPoints: [
          { body: "Name the workshop outcome before showing details.", title: "Guardrails" },
          { body: "Show who should use the planning flow.", title: "Audience" },
          { body: "Preview the core planning steps.", title: "Steps" },
          { body: "Explain what a good plan enables.", title: "Use" }
        ],
        role: "opening",
        summary: "Open with the workshop outcome and the path participants will follow.",
        title: "Workshop planning"
      }, {
        eyebrow: "Opening",
        guardrailsTitle: "Guardrails",
        resourcesTitle: "Sources to verify",
        signalsTitle: "Key points"
      }),
      withVisiblePlanFields({
        keyPoints: [
          { body: "Write the decision before collecting supporting material.", title: "Decision first" },
          { body: "Keep each planning step tied to a concrete owner.", title: "Ownership" },
          { body: "Review evidence before expanding the plan.", title: "Evidence" },
          { body: "Use one checklist to decide what moves forward.", title: "Checklist" }
        ],
        role: "concept",
        summary: "Show how a planning flow keeps decisions and evidence connected.",
        title: "Key Points"
      }, {
        eyebrow: "Alignment",
        guardrails: [
          { body: "Keep the plan tied to the decision.", title: "Decision check" },
          { body: "Avoid adding unsupported tasks.", title: "Evidence check" },
          { body: "Confirm the next owner before closing.", title: "Owner check" }
        ],
        guardrailsTitle: "Guardrails",
        resources: [
          { body: "Use the current project brief during review.", title: "Project brief" },
          { body: "Keep the checklist beside the draft.", title: "Review checklist" }
        ],
        resourcesTitle: "Sources to verify",
        signalsTitle: "Key points"
      }),
      withVisiblePlanFields({
        keyPoints: [
          { body: "Choose one next action for the plan owner.", title: "Action" },
          { body: "Store the plan where reviewers can find it.", title: "Store" },
          { body: "Schedule a short review after the first use.", title: "Review" },
          { body: "Update the checklist with what changed.", title: "Improve" }
        ],
        role: "handoff",
        summary: "Close with one next action and a clear owner for the plan.",
        title: "Use the plan"
      }, {
        eyebrow: "Close",
        resourcesTitle: "Sources to verify",
        signalsTitle: "Key points"
      })
    ],
    summary: "Workshop planning generated plan"
  };

  const slideSpecs: GeneratedSlideSpec[] = materializePlan(fields, plan);
  assert.equal(slideSpecs[0]?.cards?.[0]?.title, "Name the workshop outcome", "cover card scaffold title should be repaired from generated body text");
  assert.equal(slideSpecs[1]?.title, "Show how a planning flow keeps decisions", "weak slide title should be repaired from generated summary text");
  assert.equal(slideSpecs[1]?.guardrailsTitle, "Decision check", "content scaffold guardrails title should come from generated guardrail text");
  assert.equal(slideSpecs[1]?.signalsTitle, "Decision first", "content scaffold signal title should come from generated key point text");
  assert.equal(slideSpecs[2]?.resourcesTitle, "Action", "summary scaffold resources title should come from generated resource text");
  const visibleText = slideSpecs.flatMap((slideSpec: GeneratedSlideSpec) => [
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle
  ].filter(Boolean));
  assert.ok(!visibleText.some((value) => /^(Guardrails|Sources to verify|Key points)$/i.test(String(value))), "panel titles should not leak scaffold labels");
});

test("generated slide quality rejects authoring instructions in visible panels", () => {
  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Profile",
    guardrails: [
      { body: "Ensure all research focus claims supported by official documentation.", id: "meta-guardrail-1", title: "Source Verification" },
      { body: "Avoid generic descriptions; specify exact departments or programs available.", id: "meta-guardrail-2", title: "Specificity Requirement" },
      { body: "Maintain a technical tone suitable for an academic audience.", id: "meta-guardrail-3", title: "Tone Consistency" }
    ],
    guardrailsTitle: "Content Guardrails",
    signals: [
      { body: "The institution specializes in business and economics.", id: "meta-signal-1", title: "Academic expertise" },
      { body: "Research work connects with industry needs.", id: "meta-signal-2", title: "Applied research" },
      { body: "Social sciences shape the comparison.", id: "meta-signal-3", title: "Social lens" },
      { body: "The school offers a contrast point.", id: "meta-signal-4", title: "Comparison role" }
    ],
    signalsTitle: "Hanken strengths",
    summary: "Hanken acts as the business-school contrast point.",
    title: "Hanken profile",
    type: "content"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Identity",
    guardrails: [
      { body: "Avoid listing specific campus locations or detailed history unless requested.", id: "meta-guardrail-1", title: "Focus on Core Identity" },
      { body: "Do not use complex academic jargon; keep language accessible for a general audience.", id: "meta-guardrail-2", title: "Accessible Language" },
      { body: "Ensure all claims about faculties are accurate and reflect the current structure.", id: "meta-guardrail-3", title: "Accurate Faculty Representation" }
    ],
    guardrailsTitle: "Focus on Core Identity",
    signals: [
      { body: "Aalto combines art, business, and technology across interdisciplinary education.", id: "meta-signal-1", title: "Interdisciplinary base" },
      { body: "The university profile centers on research, teaching, and innovation.", id: "meta-signal-2", title: "Research profile" },
      { body: "The structure connects multiple schools under one institution.", id: "meta-signal-3", title: "School structure" },
      { body: "The explanation should help a general audience orient quickly.", id: "meta-signal-4", title: "Audience fit" }
    ],
    signalsTitle: "Identity signals",
    summary: "Aalto is presented through its core identity and interdisciplinary structure.",
    title: "Focus on Core Identity",
    type: "content"
  }]), /authoring instructions as visible text/);
});

test("generated content slides keep readable default visible card copy", () => {
  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Compact generated content"
  }, createGeneratedPlan("Compact generated content", 5));
  const contentSlides = slideSpecs.filter((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content");

  assert.ok(contentSlides.length >= 1, "fixture should include generated content slides");
  contentSlides.forEach((slideSpec: GeneratedSlideSpec) => {
    const cardBodies = [
      ...(slideSpec.signals || []),
      ...(slideSpec.guardrails || [])
    ].map((item: GeneratedPlanPoint) => String(item.body || ""));
    assert.equal((slideSpec.signals || []).length, 4, "content slides should preserve schema-required signal cards");
    assert.equal((slideSpec.guardrails || []).length, 3, "content slides should preserve schema-required guardrail cards");
    assert.ok(
      cardBodies.every((body: string) => body.split(/\s+/).filter(Boolean).length <= 14),
      "content slide card bodies should stay within the relaxed default word budget"
    );
  });
});

test("generated content card titles preserve complete short noun phrases by default", () => {
  const plan = createGeneratedPlan("Aalto structure", 5);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.keyPoints = [
    { body: "Aalto University is organized into three main schools.", title: "Three Main Schools" },
    { body: "School of Arts and Design focuses on creative disciplines.", title: "School of Arts and Design" },
    { body: "School of Science and Technology covers engineering fields.", title: "School of Science and Technology" },
    { body: "School of Business integrates management and economics.", title: "School of Business" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Aalto structure"
  }, plan);
  const signals = slideSpecs.find((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content")?.signals || [];

  assert.equal(signals[1]?.title, "School of Arts and Design");
  assert.equal(signals[2]?.title, "School of Science and Technology");
});

test("generated slide notes do not leak internal role instructions", () => {
  const plan = createGeneratedPlan("Internal role instruction", 3);
  if (!plan.slides[0]) {
    throw new Error("fixture should include an opening slide");
  }
  plan.slides[0].note = "Use this slide as the opening frame for the presentation sequence.";

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(slideSpecs[0]?.note || ""),
    /opening frame|presentation sequence/i,
    "cover notes should not expose internal slide-role instructions"
  );
});

test("LLM presentation generation preserves non-English visible structure", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  let requestCount = 0;
  global.fetch = async (_url, init) => {
    const requestBody = parseMockChatRequest(init);
    requestCount += 1;
    const schemaName = requestBody.response_format.json_schema.name;
    if (schemaName === "initial_presentation_deck_plan") {
      assert.match(requestBody.messages[0]?.content || "", /Use the language requested or implied by the brief/);
      return createLmStudioStreamResponse({
        audience: "suomenkieliset esiintyjät",
        language: "suomi",
        narrativeArc: "Esitys kulkee lupauksesta menetelmään ja seuraavaan toimeen.",
        outline: "1. Alku\n2. Menetelmä\n3. Seuraavat askeleet",
        slides: [
          {
            intent: "Avaa aihe kuulijan hyödyn kautta.",
            keyMessage: "Hyvä esitys alkaa selkeällä lupauksella.",
            role: "opening",
            sourceNeed: "Käytä käyttäjän tavoitetta.",
            title: "Hyvä esitys",
            visualNeed: "Ei välttämätöntä kuvaa."
          },
          {
            intent: "Näytä rakenteen käytännön merkitys.",
            keyMessage: "Rakenne pitää viestin koossa.",
            role: "concept",
            sourceNeed: "Käytä briefin rajausta.",
            title: "Rakenna selkeä polku",
            visualNeed: "Yksinkertainen rakennekuva voi auttaa."
          },
          {
            intent: "Sulje yhdellä seuraavalla toimella.",
            keyMessage: "Kuulijan pitää tietää mitä tehdä seuraavaksi.",
            role: "handoff",
            sourceNeed: "Käytä tavoitetta.",
            title: "Seuraava askel",
            visualNeed: "Ei välttämätöntä kuvaa."
          }
        ],
        thesis: "Hyvä esitys auttaa kuulijaa toimimaan."
      });
    }

    assert.equal(schemaName, "initial_presentation_plan");
    assert.match(requestBody.messages[0]?.content || "", /Use the language requested or implied by the brief/);

    return createLmStudioStreamResponse({
      outline: "1. Alku\n2. Menetelmä\n3. Seuraavat askeleet",
      references: [],
      slides: [
        withVisiblePlanFields({
          keyPoints: [
            { body: "Kuulija näkee heti miksi aihe on hyödyllinen.", title: "Hyöty" },
            { body: "Tavoite rajaa esityksen yhteen selkeään lupaukseen.", title: "Tavoite" },
            { body: "Esimerkki tekee ideasta helpomman muistaa.", title: "Esimerkki" },
            { body: "Lopetus kertoo mitä tehdä seuraavaksi.", title: "Lopetus" }
          ],
          role: "opening",
          summary: "Avaa esitys yhdellä selkeällä lupauksella.",
          title: "Hyvä esitys"
        }, {
          eyebrow: "Alku",
          note: "Kerro miksi aihe on kuulijalle hyödyllinen.",
          resourcesTitle: "Vihjeet",
          signalsTitle: "Pääkohdat"
        }),
        withVisiblePlanFields({
          keyPoints: [
            { body: "Rakenne kuljettaa kuulijaa alusta päätökseen.", title: "Rakenne" },
            { body: "Jokainen dia vastaa yhteen kysymykseen.", title: "Kysymys" },
            { body: "Turha yksityiskohta jää puhujan muistiinpanoihin.", title: "Rajaus" },
            { body: "Kuva tukee sanomaa eikä täytä tilaa.", title: "Kuva" }
          ],
          role: "concept",
          summary: "Näytä miten rakenne pitää viestin koossa.",
          title: "Rakenna selkeä polku"
        }, {
          eyebrow: "Periaate",
          guardrails: [
            { body: "Pidä jokaisella dialla vain yksi tehtävä.", title: "Yksi tehtävä" },
            { body: "Siirrä lisätiedot puheeseen tai lähteisiin.", title: "Rajaa" },
            { body: "Tarkista että otsikko kertoo asian.", title: "Otsikko" }
          ],
          guardrailsTitle: "Tarkistukset",
          resourcesTitle: "Vihjeet",
          signalsTitle: "Pääkohdat"
        }),
        withVisiblePlanFields({
          keyPoints: [
            { body: "Harjoittele ääneen ennen jakamista.", title: "Harjoittele" },
            { body: "Pyydä palautetta yhdestä epäselvästä kohdasta.", title: "Palaute" },
            { body: "Korjaa ensin viesti ja vasta sitten ulkoasu.", title: "Korjaa" },
            { body: "Tallenna valmis versio arkistoon.", title: "Arkistoi" }
          ],
          role: "handoff",
          summary: "Sulje esitys yhdellä seuraavalla toimella.",
          title: "Seuraava askel"
        }, {
          eyebrow: "Lopetus",
          resources: [
            { body: "Tee yksi harjoituskierros ennen julkaisua.", title: "Harjoitus" },
            { body: "Kerää palaute seuraavaa versiota varten.", title: "Palaute" }
          ],
          resourcesTitle: "Seuraavaksi",
          signalsTitle: "Pääkohdat"
        })
      ],
      summary: "Suomenkielinen suunnitelma"
    });
  };

  try {
    const generated = await generateInitialPresentation({
      audience: "suomenkieliset esiintyjät",
      includeActiveSources: false,
      objective: "Näytä miten hyvä esitys rakennetaan.",
      targetSlideCount: 3,
      title: "Hyvä esitys"
    });
    const visibleText = collectGeneratedVisibleText(generated.slideSpecs);

    assert.equal(requestCount, 2, "non-English plans should use deck planning and slide drafting without repair");
    assert.ok(visibleText.some((value) => value === "Pääkohdat"), "LLM-supplied labels should reach slides");
    assert.ok(
      !visibleText.some((value) => /Opening|Close|Key points|Useful cues|Drafted|Checks|Reference lead/i.test(String(value))),
      "LLM generation should not inject fixed English visible labels into non-English decks"
    );
  } finally {
    llmRuntime.restore();
  }
});
