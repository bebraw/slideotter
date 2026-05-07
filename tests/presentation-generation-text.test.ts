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
const {
  areNearDuplicateVisibleText
} = require("../studio/server/services/generated-text-hygiene.ts");
const {
  normalizeDeckPlanForValidation,
  validateDeckPlan
} = require("../studio/server/services/generated-deck-plan-validation.ts");
const {
  hasDanglingEnding,
  sentence
} = require("../studio/server/services/generated-text-hygiene.ts");
const llmRuntime = createLlmRuntimeSnapshot();

type MockProgressEvent = JsonRecord & {
  stage?: string;
};

test.after(() => {
  llmRuntime.restore();
});

test("generated text shortening avoids incomplete conjunction tails", () => {
  const text = "Aalto University operates through six specialized schools covering Arts, Engineering, Business, Science, and open access courses.";
  const shortened = sentence(text, text, 14);

  assert.equal(
    shortened,
    "Aalto University operates through six specialized schools covering Arts, Engineering, Business, Science"
  );
  assert.equal(hasDanglingEnding("Aalto University operates through six specialized schools covering Arts, Engineering, Business, Science, and open"), true);
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
        coverIntent: "agenda",
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
      { body: "Social sciences shape the comparison.", id: "meta-signal-3", title: "Social lens" }
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
      { body: "The structure connects multiple schools under one institution.", id: "meta-signal-3", title: "School structure" }
    ],
    signalsTitle: "Identity signals",
    summary: "Aalto is presented through its core identity and interdisciplinary structure.",
    title: "Focus on Core Identity",
    type: "content"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "History",
    guardrails: [
      { body: "Do not mention specific merger dates other than the general year 2010.", id: "meta-guardrail-1", title: "Date Accuracy" },
      { body: "Keep descriptions of disciplines broad and avoid listing every department.", id: "meta-guardrail-2", title: "Scope Control" },
      { body: "Ensure the tone remains direct and accessible for a beginner audience.", id: "meta-guardrail-3", title: "Ensure the tone remains" }
    ],
    guardrailsTitle: "Date Accuracy",
    signals: [
      { body: "Aalto was formed through a merger of three institutions.", id: "meta-signal-1", title: "2010 founding" },
      { body: "The university combines technology, business, and arts.", id: "meta-signal-2", title: "Broad disciplines" },
      { body: "Its profile is interdisciplinary and innovation focused.", id: "meta-signal-3", title: "Interdisciplinary profile" }
    ],
    signalsTitle: "Founding context",
    summary: "Aalto formed in 2010 by combining three Finnish universities.",
    title: "Aalto founding",
    type: "content"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Campus",
    guardrails: [
      { body: "Avoid listing specific faculty names unless they are universally recognized.", id: "meta-guardrail-1", title: "Faculty Focus" },
      { body: "Do not imply the university is a new startup; it has deep historical roots.", id: "meta-guardrail-2", title: "Historical Context" },
      { body: "Keep descriptions of campus life general to avoid dating the content.", id: "meta-guardrail-3", title: "Campus Description" }
    ],
    guardrailsTitle: "Faculty Focus",
    signals: [
      { body: "Aalto has a multi-school structure.", id: "meta-signal-1", title: "School structure" },
      { body: "The university has established roots in Finnish higher education.", id: "meta-signal-2", title: "Historical roots" },
      { body: "The campus experience can be described without fragile details.", id: "meta-signal-3", title: "Campus overview" }
    ],
    signalsTitle: "Audience context",
    summary: "Aalto can be introduced through structure, roots, and general campus context.",
    title: "Aalto context",
    type: "content"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    cards: [
      { body: "Aalto fosters Lifewide Learning and Open University courses.", id: "card-1", title: "Lifewide learning" },
      { body: "Aalto combines technology, business, arts, and design.", id: "card-2", title: "Interdisciplinary profile" },
      { body: "Aalto connects education with innovation in Finland.", id: "card-3", title: "Innovation role" }
    ],
    eyebrow: "Welcome",
    note: "Use general knowledge about Aalto University's reputation as an educational hub, referencing its focus on Lifewide Learning and Open University courses from source [2].",
    summary: "Aalto University is a Finnish institution for interdisciplinary learning.",
    title: "Intro to Aalto University",
    type: "cover"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Structure",
    guardrails: [
      { body: "Do not list the schools as separate entities without connection.", id: "guardrail-1", title: "Unified Structure" },
      { body: "Ensure visual treatment reinforces interconnected nature of six schools.", id: "guardrail-2", title: "Visual Connection" },
      { body: "Keep text concise to maintain readability on content slide.", id: "guardrail-3", title: "Concise Text" }
    ],
    guardrailsTitle: "Unified Structure",
    signals: [
      { body: "Aalto combines six schools under one interdisciplinary institution.", id: "signal-1", title: "Six-school frame" },
      { body: "The structure links technology, business, arts, and design.", id: "signal-2", title: "Connected fields" },
      { body: "The deck should explain the institution as one system.", id: "signal-3", title: "System view" }
    ],
    signalsTitle: "Institution frame",
    summary: "Aalto University combines six schools into one interdisciplinary structure.",
    title: "Unified Structure",
    type: "content"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Science and Culture",
    guardrails: [
      { body: "Avoid overly technical botanical terms that might confuse.", id: "meta-guardrail-1", title: "Accessibility Check" },
      { body: "Ensure historical references are accurate and not misinterpreted.", id: "meta-guardrail-2", title: "Historical Accuracy" },
      { body: "Keep visual descriptions focused on the rose itself, not the layout.", id: "meta-guardrail-3", title: "Visual Focus" }
    ],
    guardrailsTitle: "Accessibility Check",
    signals: [
      { body: "Roses grow in layered structures.", id: "signal-1", title: "Biological structure" },
      { body: "Writers use roses as compact symbols.", id: "signal-2", title: "Cultural meaning" },
      { body: "Care shapes how blooms appear.", id: "signal-3", title: "Growth cycle" }
    ],
    signalsTitle: "Rose signals",
    summary: "Roses combine biological structure with cultural meaning.",
    title: "The Science and Symbolism of Roses",
    type: "content"
  }]), /authoring instructions as visible text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    bullets: [
      { body: "Roses represent love, resilience, and artistic expression.", id: "bullet-1", title: "Core symbols" },
      { body: "Their legacy extends beyond simple aesthetics into culture.", id: "bullet-2", title: "Cultural depth" },
      { body: "Appreciate roses as enduring symbols of human meaning.", id: "bullet-3", title: "Enduring legacy" }
    ],
    eyebrow: "Conclusion",
    resources: [
      { body: "Consider pairing with a quote about resilience or beauty.", id: "resource-1", title: "Quote Integration" },
      { body: "Select imagery showing roses in artistic or cultural settings.", id: "resource-2", title: "Imagery Choice" }
    ],
    resourcesTitle: "Support Resources",
    summary: "You can appreciate roses in a new light, recognizing their broader significance.",
    title: "Conclusion: The Enduring Legacy of Roses",
    type: "summary"
  }]), /authoring instructions as visible text/);
});

test("generated content slides keep readable default visible card copy", () => {
  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Compact generated content"
  }, createGeneratedPlan("Compact generated content", 5));
  const contentSlides = slideSpecs.filter((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content");

  assert.ok(contentSlides.length >= 1, "fixture should include generated content slides");
  contentSlides.forEach((slideSpec: GeneratedSlideSpec) => {
    const signalBodies = (slideSpec.signals || []).map((item: GeneratedPlanPoint) => String(item.body || ""));
    const guardrailBodies = (slideSpec.guardrails || []).map((item: GeneratedPlanPoint) => String(item.body || ""));
    assert.equal((slideSpec.signals || []).length, 3, "content slides should preserve schema-required signal cards");
    assert.equal((slideSpec.guardrails || []).length, 3, "content slides should preserve schema-required guardrail cards");
    assert.ok(
      signalBodies.every((body: string) => body.split(/\s+/).filter(Boolean).length <= 8),
      "content slide signal bodies should stay within the four-item fit budget"
    );
    assert.ok(
      guardrailBodies.every((body: string) => body.split(/\s+/).filter(Boolean).length <= 9),
      "content slide guardrail bodies should stay within the three-item fit budget"
    );
  });
});

test("generated cover text avoids repeating the summary claim", () => {
  const plan = createGeneratedPlan("Cover duplicate repair", 3);
  const firstSlide = plan.slides[0];
  if (!firstSlide) {
    throw new Error("fixture should include a cover slide");
  }

  firstSlide.summary = "Aalto University combines six schools to foster interdisciplinary research and education.";
  firstSlide.note = "Aalto University combines six schools for interdisciplinary research and education.";
  firstSlide.keyPoints = [
    { body: "Aalto University combines six schools for interdisciplinary research and education.", title: "Six Schools" },
    { body: "Design, business, technology, and science meet in one university.", title: "Connected fields" },
    { body: "Open learning paths let more learners explore Aalto studies.", title: "Open paths" },
    { body: "Research and artistic work share the same academic setting.", title: "Shared work" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Aalto demo"
  }, plan);
  const cover = slideSpecs[0];
  assert.equal(cover?.type, "cover");
  assert.ok(!areNearDuplicateVisibleText(cover?.note, cover?.summary), "cover note should not repeat the summary claim");
  assert.ok(
    (cover?.cards || []).every((card: GeneratedPlanPoint) => !areNearDuplicateVisibleText(card.body, cover?.summary)),
    "cover cards should not repeat the summary claim"
  );
});

test("generated cover materialization supports statement openings without cards", () => {
  const plan = createGeneratedPlan("Statement opening", 3);
  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Statement opening" }, plan);
  const cover = slideSpecs[0];

  assert.equal(cover?.type, "cover");
  assert.equal(cover?.coverIntent, "statement");
  assert.equal(cover?.layout, "statement");
  assert.equal(Array.isArray(cover?.cards) ? cover.cards.length : 0, 0);
});

test("generated cover materialization persists explicit agenda intent", () => {
  const plan = createGeneratedPlan("Agenda opening", 3);
  if (!plan.slides[0]) {
    throw new Error("fixture should include an opening slide");
  }
  plan.slides[0].coverIntent = "agenda";

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Agenda opening" }, plan);
  const cover = slideSpecs[0];

  assert.equal(cover?.coverIntent, "agenda");
  assert.equal(cover?.layout, "agenda");
  assert.equal(cover?.cards?.length, 3);
});

test("generated content slides tolerate duplicated panel and item titles within three-item limit", () => {
  const plan = createGeneratedPlan("Duplicated panel title", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.signalsTitle = "Six Specialized Schools";
  contentSlide.keyPoints = [
    { body: "Aalto University operates through six specialized schools covering arts, engineering, business, and science.", title: "Six Specialized Schools" },
    { body: "Open University courses welcome learners outside degree programs.", title: "Open Access" },
    { body: "Research and artistic work happen across schools.", title: "Research and Art" },
    { body: "Lifewide Learning helps learners keep skills current.", title: "Lifewide Learning" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Duplicated panel title"
  }, plan);
  const contentSpec = slideSpecs.find((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content");

  assert.equal(contentSpec?.signalsTitle, "Six Specialized Schools");
  assert.equal(contentSpec?.signals?.length, 3);
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

  plan.slides[0].note = "This slide serves as the opening frame for a three-slide presentation introducing Aalto University's educational offerings.";
  const openingFrameSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(openingFrameSlideSpecs[0]?.note || ""),
    /serves as the opening frame|Aalto University's$/i,
    "cover notes should not expose internal role descriptions or possessive fragments"
  );

  plan.slides[0].note = "Opening frame for the presentation.";
  const shortOpeningFrameSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(shortOpeningFrameSlideSpecs[0]?.note || ""),
    /opening frame for the presentation/i,
    "cover notes should not expose short internal role descriptions"
  );

  plan.slides[0].note = "Opening slide with simple, clean design and Aalto University branding.";
  const visualGuidanceSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(visualGuidanceSlideSpecs[0]?.note || ""),
    /opening slide|simple, clean design|branding/i,
    "cover notes should not expose visual guidance instructions"
  );

  plan.slides[0].note = "Opening cover slide with clean design and branding.";
  const coverGuidanceSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(coverGuidanceSlideSpecs[0]?.note || ""),
    /opening cover slide|clean design|branding/i,
    "cover notes should not expose multi-word visual guidance instructions"
  );

  plan.slides[0].note = "Simple, clean cover design with Aalto University branding to establish credibility without clutter.";
  const coverDesignGuidanceSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(coverDesignGuidanceSlideSpecs[0]?.note || ""),
    /cover design|branding|without clutter/i,
    "cover notes should not expose design treatment instructions"
  );
});

test("generated slide materialization rejects value and visual-need leaks", () => {
  const plan = createGeneratedPlan("Audience outcome leak", 3);
  const firstSlide = plan.slides[0];
  if (!firstSlide) {
    throw new Error("fixture should include an opening slide");
  }

  firstSlide.summary = "Audience understands the purpose of the presentation and knows what to expect";
  firstSlide.note = "Use a clean, high-contrast background with Aalto University branding elements if available.";

  const repairedSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Audience outcome leak"
  }, plan);
  const visibleText = collectGeneratedVisibleText(repairedSlideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /audience understands|knows what to expect|high-contrast background|branding elements/i.test(value)),
    "materialization should not expose slide value or visual-need planning text"
  );

  firstSlide.keyPoints = [
    { body: "This session introduces Aalto University's educational offerings simply.", title: "Straightforward Introduction" },
    { body: "Learn core strengths and practical benefits for learners simply.", title: "Beginner-Friendly Overview" },
    { body: "Expect clear explanations of how Aalto prepares students for challenges.", title: "Real-World Focus" },
    { body: "Aalto combines technology, business, and arts in Finland.", title: "Aalto profile" }
  ];

  const fallbackSlideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Audience outcome leak"
  }, plan);
  const fallbackVisibleText = collectGeneratedVisibleText(fallbackSlideSpecs);

  assert.ok(
    !fallbackVisibleText.some((value: string) => /This session introduces|Learn core strengths|Expect clear explanations/i.test(value)),
    "materialization should drop audience-expectation card copy instead of rendering it"
  );
  assert.ok(
    fallbackVisibleText.some((value: string) => /guardrail one is specific|guardrail two is specific/i.test(value)),
    "materialization should repair tainted cover cards from visible support text"
  );
});

test("generated slide materialization skips isolated scaffold points", () => {
  const plan = createGeneratedPlan("Opening scaffold point", 3);
  const firstSlide = plan.slides[0];
  if (!firstSlide) {
    throw new Error("fixture should include an opening slide");
  }

  firstSlide.keyPoints = [
    { body: "This session introduces Aalto University's educational offerings simply.", title: "Straightforward Introduction" },
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" },
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" },
    { body: "Project culture connects classroom learning with practical collaboration.", title: "Project culture" },
    { body: "Research and entrepreneurship give students ways to test ideas.", title: "Idea testing" }
  ];
  firstSlide.coverIntent = "agenda";

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Opening scaffold point" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /This session introduces/i.test(value)),
    "materialization should drop isolated scaffold points"
  );
  assert.ok(
    visibleText.some((value: string) => /Aalto combines technology, business, arts, and design/i.test(value)),
    "materialization should keep the usable points after dropping scaffold"
  );
});

test("generated slide materialization removes duplicate visible card bodies", () => {
  const plan = createGeneratedPlan("Duplicate visible body", 3);
  const firstSlide = plan.slides[0];
  if (!firstSlide) {
    throw new Error("fixture should include an opening slide");
  }

  firstSlide.keyPoints = [
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" },
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Repeated profile" },
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" }
  ];
  firstSlide.coverIntent = "agenda";
  firstSlide.guardrails = [
    { body: "Project culture connects classroom learning with practical collaboration.", title: "Project culture" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Duplicate visible body" }, plan);
  const coverSpec = slideSpecs[0];
  const cards = coverSpec && Array.isArray(coverSpec.cards) ? coverSpec.cards : [];
  const cardBodies = cards.map((card: JsonRecord) => String(card.body || "").toLowerCase());

  assert.equal(cards.length, 3, "cover cards should keep the requested card count after dropping duplicate bodies");
  assert.equal(new Set(cardBodies).size, cardBodies.length, "cover cards should not repeat the same visible body");
});

test("generated slide materialization fills sparse cover cards from visible support points", () => {
  const plan = createGeneratedPlan("Sparse cover points", 3);
  const firstSlide = plan.slides[0];
  if (!firstSlide) {
    throw new Error("fixture should include an opening slide");
  }

  firstSlide.keyPoints = [
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" }
  ];
  firstSlide.coverIntent = "agenda";
  firstSlide.guardrails = [
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" },
    { body: "Project culture connects classroom learning with practical collaboration.", title: "Project culture" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Sparse cover points" }, plan);
  const coverSpec = slideSpecs[0];
  const cards = coverSpec && Array.isArray(coverSpec.cards) ? coverSpec.cards : [];
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.equal(cards.length, 3, "sparse cover cards should fill from visible support points");
  assert.ok(
    visibleText.some((value: string) => /Project culture|Project culture connects classroom/i.test(value)),
    "sparse cover fallback should use visible support text"
  );
});

test("generated slide materialization skips isolated authoring guardrails", () => {
  const plan = createGeneratedPlan("Authoring guardrail", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.guardrails = [
    { body: "Avoid technical jargon; keep explanations simple and accessible for all audiences.", title: "Clarity Check" },
    { body: "Aalto links different fields so students can approach problems from more than one angle.", title: "Cross-field learning" },
    { body: "Project work connects classroom learning with practical collaboration.", title: "Project culture" },
    { body: "Entrepreneurship and research give students ways to test ideas.", title: "Idea testing" }
  ];
  contentSlide.guardrailsTitle = "How It Works";

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Authoring guardrail" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /Avoid technical jargon|Clarity Check/i.test(value)),
    "materialization should drop isolated authoring guardrails"
  );
  assert.ok(
    visibleText.some((value: string) => /Project work connects classroom learning/i.test(value)),
    "materialization should keep usable guardrails after dropping authoring text"
  );
});

test("generated slide materialization removes facility accuracy guardrail instructions", () => {
  const plan = createGeneratedPlan("Research support checks", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.guardrails = [
    { body: "Claims about specific facilities must align with official Aalto sources.", title: "Facility Accuracy" },
    { body: "Avoid implying every school has each research area.", title: "Scope Clarity" },
    { body: "Do not invent department names or unit locations.", title: "Do not invent specific" }
  ];
  contentSlide.keyPoints = [
    { body: "Aalto operates Finland's first quantum computer.", title: "Quantum computing" },
    { body: "Dedicated units focus on sustainable production.", title: "Sustainable production" },
    { body: "Departments conduct advanced photonics research.", title: "Photonics research" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Research support checks" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /Facility Accuracy|Scope Clarity|Do not invent|official Aalto|Avoid implying/i.test(value)),
    "materialization should not expose facility/source accuracy authoring guardrails"
  );
  assert.ok(
    visibleText.some((value: string) => /Aalto operates Finland's first quantum computer/i.test(value)),
    "materialization should repair leaked facility guardrails from visible key points"
  );
});

test("generated slide materialization removes official-check and visual-treatment instructions", () => {
  const plan = createGeneratedPlan("Visual treatment leak", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.guardrails = [
    { body: "Ensure the six school list matches official Aalto University wording.", title: "Accuracy Check" },
    { body: "Use clear visual treatment for school names to maintain readability.", title: "Visual Clarity" },
    { body: "Aalto University operates through six specialized schools.", title: "Six Schools" }
  ];
  contentSlide.keyPoints = [
    { body: "Aalto operates through schools spanning arts, business, engineering, and science.", title: "Academic areas" },
    { body: "Research and artistic work happen across the school network.", title: "Research strengths" },
    { body: "The school structure gives Aalto a broad academic base.", title: "Broad base" },
    { body: "The disciplines connect through shared university priorities.", title: "Connected fields" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Visual treatment leak" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /Accuracy Check|Visual Clarity|matches official|clear visual treatment/i.test(value)),
    "materialization should not expose official-check or visual-treatment instructions"
  );
  assert.ok(
    visibleText.some((value: string) => /Aalto operates through schools spanning arts/i.test(value)),
    "materialization should repair leaked instructions from visible key points"
  );
});

test("generated summary materialization removes value summaries and rejects official page filler", () => {
  const plan = createGeneratedPlan("Summary value leak", 3);
  const summarySlide = plan.slides[2];
  if (!summarySlide) {
    throw new Error("fixture should include a summary slide");
  }

  summarySlide.summary = "You know exactly how to engage with Aalto through admissions, open courses, or campus visits.";
  summarySlide.resources = [
    { body: "Official Aalto University Admissions page for application details.", title: "Admissions Portal" },
    { body: "Use open courses to try Aalto studies before a full degree.", title: "Open study" },
    { body: "Visit Otaniemi to see how the campus connects the fields.", title: "Campus visit" }
  ];
  summarySlide.keyPoints = [
    { body: "Explore degree programmes and open university courses.", title: "Choose a path" },
    { body: "Check admissions dates before planning an application.", title: "Check timing" },
    { body: "Visit Otaniemi to see how the campus connects the fields.", title: "See the campus" },
    { body: "Start with programmes, admissions timing, or a campus visit.", title: "Start point" }
  ];

  assert.throws(
    () => materializePlan({ title: "Summary value leak" }, plan),
    /2 distinct resources items/,
    "materialization should reject official-page filler instead of exposing it"
  );

  summarySlide.resources = [
    { body: "Use open courses to try Aalto studies before a full degree.", title: "Open study" },
    { body: "Compare degree programmes before choosing an application route.", title: "Programme choice" },
    { body: "Visit Otaniemi to see how the campus connects the fields.", title: "Campus visit" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Summary value leak" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /You know exactly|Official Aalto University Admissions page|Admissions Portal/i.test(value)),
    "materialization should not expose plan-value summary or official-page filler"
  );
  assert.ok(
    visibleText.some((value: string) => /Explore degree programmes/i.test(value)),
    "materialization should repair summary leaks from visible support text"
  );
});

test("generated slide materialization fills undercounted guardrails from usable points", () => {
  const plan = createGeneratedPlan("Guardrail fallback", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.keyPoints = [
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" },
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" },
    { body: "Project work connects classroom learning with practical collaboration.", title: "Project culture" },
    { body: "Research and entrepreneurship give students ways to test ideas.", title: "Idea testing" }
  ];
  contentSlide.guardrails = [
    { body: "Avoid technical jargon; keep explanations simple and accessible for all audiences.", title: "Clarity Check" },
    { body: "Aalto links different fields so students can approach problems from more than one angle.", title: "Cross-field learning" },
    { body: "Maintain high contrast for any icons or graphics used to represent key concepts.", title: "Visual Accessibility" }
  ];
  contentSlide.guardrailsTitle = "How It Works";

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Guardrail fallback" }, plan);
  const contentSpec = slideSpecs.find((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content");
  const guardrails = contentSpec && Array.isArray(contentSpec.guardrails) ? contentSpec.guardrails : [];
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.equal(guardrails.length, 3, "content slide should still get three visible support points");
  assert.ok(
    !visibleText.some((value: string) => /Avoid technical jargon|Visual Accessibility|high contrast/i.test(value)),
    "fallback should not reintroduce authoring guardrails"
  );
  assert.ok(
    visibleText.some((value: string) => /Students can compare study paths/i.test(value)),
    "fallback should use real key points when guardrails underfill"
  );
});

test("generated slide materialization repairs context guardrails without synthetic grounding copy", () => {
  const plan = createGeneratedPlan("Context guardrail leak", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  contentSlide.guardrails = [
    { body: "Do not list six schools as a simple bulleted list without context; group them by discipline.", title: "Group Schools by Discipline" },
    { body: "Ensure open course information is presented as an inclusive opportunity for all learners.", title: "Highlight Inclusivity" }
  ];
  contentSlide.keyPoints = [
    { body: "Aalto connects arts, technology, business, and science through one university structure.", title: "Connected Disciplines" },
    { body: "Open University courses give learners a low-friction way to explore Aalto studies.", title: "Open Access" },
    { body: "Research, teaching, and artistic work sit close enough for cross-disciplinary projects.", title: "Shared Practice" },
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study Paths" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Context guardrail leak" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /Do not list|Ensure open course|keeps grounded in/i.test(value)),
    "materialization should not expose authoring guardrails or synthetic grounding fallback text"
  );
  assert.ok(
    visibleText.some((value: string) => /Aalto connects arts, technology, business, and science/i.test(value)),
    "materialization should repair guardrails from visible key points"
  );
});

test("generated slide materialization blocks internal planning fields from visible copy", () => {
  const plan = createGeneratedPlan("Internal provenance boundary", 3);
  const firstSlide = plan.slides[0];
  const contentSlide = plan.slides[1];
  if (!firstSlide || !contentSlide) {
    throw new Error("fixture should include opening and content slides");
  }

  const sourceNeed = "Use the student guide source to verify programme details before drafting visible copy.";
  const visualNeed = "Use a visual timeline layout to show the education pathway without extra text.";
  const value = "Audience understands the planning role and knows what to expect next.";

  firstSlide.value = value;
  firstSlide.visualNeed = visualNeed;
  firstSlide.summary = value;
  firstSlide.note = visualNeed;

  contentSlide.sourceNeed = sourceNeed;
  contentSlide.value = value;
  contentSlide.visualNeed = visualNeed;
  contentSlide.title = sourceNeed;
  contentSlide.summary = value;
  contentSlide.signalsTitle = sourceNeed;
  contentSlide.guardrailsTitle = visualNeed;
  contentSlide.keyPoints = [
    { body: sourceNeed, title: "Source instruction" },
    { body: visualNeed, title: "Visual instruction" },
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" },
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" },
    { body: "Project work connects classroom learning with practical collaboration.", title: "Project culture" },
    { body: "Research and entrepreneurship give students ways to test ideas.", title: "Idea testing" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Internal provenance boundary" }, plan);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(
    !visibleText.some((value: string) => /student guide source|visual timeline layout|Audience understands/i.test(value)),
    "materialization should not promote internal plan intent, value, source, or visual guidance fields"
  );
  assert.ok(
    visibleText.some((value: string) => /Interdisciplinary profile|Aalto combines technology/i.test(value)),
    "materialization should repair tainted fields from usable visible points"
  );
});

test("generated content materialization fills tainted signal gaps from visible support points", () => {
  const plan = createGeneratedPlan("Signal provenance fallback", 3);
  const contentSlide = plan.slides[1];
  if (!contentSlide) {
    throw new Error("fixture should include a content slide");
  }

  const sourceNeed = "Use the student guide source to verify programme details before drafting visible copy.";
  const visualNeed = "Use a visual timeline layout to show the education pathway without extra text.";
  contentSlide.sourceNeed = sourceNeed;
  contentSlide.visualNeed = visualNeed;
  contentSlide.keyPoints = [
    { body: sourceNeed, title: "Source instruction" },
    { body: visualNeed, title: "Visual instruction" },
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" },
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" }
  ];
  contentSlide.guardrails = [
    { body: "Project work connects classroom learning with practical collaboration.", title: "Project culture" },
    { body: "Research and entrepreneurship give students ways to test ideas.", title: "Idea testing" },
    { body: "The overview stays grounded in learner choices.", title: "Grounded choices" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Signal provenance fallback" }, plan);
  const contentSpec = slideSpecs.find((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content");
  const signals = contentSpec && Array.isArray(contentSpec.signals) ? contentSpec.signals : [];
  const guardrails = contentSpec && Array.isArray(contentSpec.guardrails) ? contentSpec.guardrails : [];
  const supportBodies = [...signals, ...guardrails].map((item: JsonRecord) => String(item.body || "").toLowerCase());
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.equal(signals.length, 3, "content signal cards should fill from visible support points after tainted points are dropped");
  assert.equal(new Set(supportBodies).size, supportBodies.length, "signal fallback should not duplicate guardrail bodies in another panel");
  assert.ok(
    !visibleText.some((value: string) => /student guide source|visual timeline layout/i.test(value)),
    "signal fallback should not reintroduce internal planning text"
  );
  assert.ok(
    visibleText.some((value: string) => /Project culture|Project work connects classroom/i.test(value)),
    "signal fallback should use visible support text when key points underfill"
  );
});

test("generated summary materialization fills tainted bullet gaps from visible support points", () => {
  const plan = createGeneratedPlan("Summary provenance fallback", 3);
  const summarySlide = plan.slides[2];
  if (!summarySlide) {
    throw new Error("fixture should include a summary slide");
  }

  const sourceNeed = "Use the student guide source to verify programme details before drafting visible copy.";
  const visualNeed = "Use a visual timeline layout to show the education pathway without extra text.";
  summarySlide.sourceNeed = sourceNeed;
  summarySlide.visualNeed = visualNeed;
  summarySlide.keyPoints = [
    { body: sourceNeed, title: "Source instruction" },
    { body: visualNeed, title: "Visual instruction" },
    { body: "Aalto combines technology, business, arts, and design in one university.", title: "Interdisciplinary profile" }
  ];
  summarySlide.guardrails = [
    { body: "Students can compare study paths before choosing where to learn more.", title: "Study paths" },
    { body: "Project work connects classroom learning with practical collaboration.", title: "Project culture" },
    { body: "Research and entrepreneurship give students ways to test ideas.", title: "Idea testing" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Summary provenance fallback" }, plan);
  const summarySpec = slideSpecs.find((slideSpec: GeneratedSlideSpec) => slideSpec.type === "summary");
  const bullets = summarySpec && Array.isArray(summarySpec.bullets) ? summarySpec.bullets : [];
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.equal(bullets.length, 3, "summary bullets should fill from visible support points after tainted points are dropped");
  assert.ok(
    !visibleText.some((value: string) => /student guide source|visual timeline layout/i.test(value)),
    "summary fallback should not reintroduce internal planning text"
  );
  assert.ok(
    visibleText.some((value: string) => /Study paths|Students can compare study paths/i.test(value)),
    "summary fallback should use visible support text when key points underfill"
  );
});

test("generated summary materialization separates resources from bullets", () => {
  const plan = createGeneratedPlan("Summary resource separation", 3);
  const summarySlide = plan.slides[2];
  if (!summarySlide) {
    throw new Error("fixture should include a summary slide");
  }

  summarySlide.keyPoints = [
    { body: "People can take individual courses without joining a degree program.", title: "Open Route" },
    { body: "Lifewide Learning focuses on skills for changing work.", title: "Adult Learning" },
    { body: "Courses span business, technology, languages, art, and design.", title: "Broad Subjects" }
  ];
  summarySlide.resources = [
    { body: "People can take individual courses without joining a degree program.", title: "Open Route" },
    { body: "Open University is open regardless of background or age.", title: "Who can join" },
    { body: "Lifewide Learning focuses on skills for changing work.", title: "Adult Learning" },
    { body: "Students register for individual courses in order of registration.", title: "How it works" }
  ];

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({ title: "Summary resource separation" }, plan);
  const summarySpec = slideSpecs.find((slideSpec: GeneratedSlideSpec) => slideSpec.type === "summary");
  const bullets = summarySpec && Array.isArray(summarySpec.bullets) ? summarySpec.bullets : [];
  const resources = summarySpec && Array.isArray(summarySpec.resources) ? summarySpec.resources : [];
  const bulletBodies = new Set(bullets.map((item: JsonRecord) => String(item.body || "").toLowerCase()));
  const resourceBodies = resources.map((item: JsonRecord) => String(item.body || "").toLowerCase());

  assert.equal(resources.length, 2, "summary resources should keep two non-repeated support items");
  assert.ok(
    resourceBodies.every((body: string) => body && !bulletBodies.has(body)),
    "summary resources should not repeat checklist bullet bodies"
  );
  assert.ok(
    resources.some((item: JsonRecord) => /Who can join/i.test(String(item.title || ""))),
    "resource panel should keep the distinct access detail"
  );
});

test("generated summary materialization rejects resources that only repeat bullets", () => {
  const plan = createGeneratedPlan("Summary repeated resources", 3);
  const summarySlide = plan.slides[2];
  if (!summarySlide) {
    throw new Error("fixture should include a summary slide");
  }

  summarySlide.keyPoints = [
    { body: "People can take individual courses without joining a degree program.", title: "Open Route" },
    { body: "Lifewide Learning focuses on skills for changing work.", title: "Adult Learning" },
    { body: "Courses span business, technology, languages, art, and design.", title: "Broad Subjects" }
  ];
  summarySlide.resources = [
    { body: "People can take individual courses without joining a degree program.", title: "Open Route" },
    { body: "Lifewide Learning focuses on skills for changing work.", title: "Adult Learning" }
  ];
  summarySlide.guardrails = [
    { body: "People can take individual courses without joining a degree program.", title: "Open Route" },
    { body: "Lifewide Learning focuses on skills for changing work.", title: "Adult Learning" }
  ];

  assert.throws(
    () => materializePlan({ title: "Summary repeated resources" }, plan),
    /resources items that do not repeat summary bullets/
  );
});

test("generated summary materialization blocks source snippet markers in visible resources", () => {
  const plan = createGeneratedPlan("Snippet marker leak", 3);
  const summarySlide = plan.slides[2];
  if (!summarySlide) {
    throw new Error("fixture should include a summary slide");
  }

  summarySlide.resources = [
    { body: "Reference campus architecture themes from snippet [3].", title: "Architectural Gems" },
    { body: "Reference news about sustainable mobility events from source snippet [6].", title: "Sustainable Mobility Events" }
  ];

  assert.throws(() => materializePlan({ title: "Snippet marker leak" }, plan), /2 distinct resources items/);
});

test("generated slide quality rejects scaffold value and source filler", () => {
  assert.throws(() => finalizeGeneratedSlideSpecs([{
    cards: [
      { body: "You now understand the purpose of this presentation.", id: "value-card", title: "Slide Value" },
      { body: "Aalto combines technology, business, and arts.", id: "identity-card", title: "Identity" },
      { body: "The deck introduces the university at beginner level.", id: "audience-card", title: "Beginner fit" }
    ],
    eyebrow: "Opening",
    note: "Aalto combines technology, business, and arts.",
    summary: "Aalto combines technology, business, and arts.",
    title: "Aalto University",
    type: "cover"
  }]), /placeholder text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    bullets: [
      { body: "Aalto combines technology, business, and arts.", id: "summary-1", title: "Interdisciplinary profile" },
      { body: "The university was formed in Finland in 2010.", id: "summary-2", title: "Founding context" },
      { body: "The deck introduces Aalto for a beginner audience.", id: "summary-3", title: "Beginner fit" }
    ],
    eyebrow: "Close",
    resources: [
      { body: "Aalto University official website for further information on programs and research.", id: "source-1", title: "Official website" },
      { body: "Use verified university pages for current school and program names.", id: "source-2", title: "Current structure" }
    ],
    resourcesTitle: "Next steps",
    summary: "Use official sources when checking current Aalto details.",
    title: "Learn more",
    type: "summary"
  }]), /placeholder text/);

  assert.throws(() => finalizeGeneratedSlideSpecs([{
    bullets: [
      { body: "Compare degree options against your goals.", id: "summary-1", title: "Compare programs" },
      { body: "Review admission dates before choosing a path.", id: "summary-2", title: "Check deadlines" },
      { body: "Save the pages you need for follow-up.", id: "summary-3", title: "Keep links" }
    ],
    eyebrow: "Action Plan",
    resources: [
      { body: "Aalto University Official Website: www.aalto.fi", id: "source-1", title: "Official Website" },
      { body: "Admissions Contact Page for direct inquiries and support requests.", id: "source-2", title: "Admissions Support" }
    ],
    resourcesTitle: "Key Resources",
    summary: "Use the official site to compare current study options.",
    title: "Next Steps",
    type: "summary"
  }]), /placeholder text/);
});

test("generated slide quality rejects visible checklist guidance", () => {
  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Why Choose Aalto University?",
    guardrails: [
      { body: "Avoid technical jargon; keep explanations simple and accessible for all audiences.", id: "check-1", title: "Clarity Check" },
      { body: "Ensure all claims about industry connections are grounded in general knowledge.", id: "check-2", title: "Evidence Grounding" },
      { body: "Maintain high contrast for any icons or graphics used to represent key concepts.", id: "check-3", title: "Visual Accessibility" }
    ],
    guardrailsTitle: "Clarity Check",
    signals: [
      { body: "Aalto University combines innovation, interdisciplinary learning, and industry connections.", id: "signal-1", title: "Core Strengths" },
      { body: "Students gain practical skills through collaborative projects.", id: "signal-2", title: "Practical Benefits" },
      { body: "The university prepares graduates for evolving market demands.", id: "signal-3", title: "Industry Relevance" }
    ],
    signalsTitle: "Core Strengths",
    summary: "Aalto connects fields through practical learning.",
    title: "Why Choose Aalto University?",
    type: "content"
  }]), /authoring instructions/);
});

test("generated slide quality repairs item titles that repeat the slide title", () => {
  const slideSpecs: GeneratedSlideSpec[] = finalizeGeneratedSlideSpecs([{
    cards: [
      { body: "Aalto University merges art, science, and technology into one campus.", id: "card-1", title: "One Campus" },
      { body: "Students from different fields work on shared projects.", id: "card-2", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "card-3", title: "Real-World Impact" }
    ],
    eyebrow: "Integration",
    note: "Aalto connects disciplines through shared work.",
    summary: "Aalto connects disciplines through shared work.",
    title: "One Campus",
    type: "cover"
  }]);

  assert.notEqual(slideSpecs[0]?.cards?.[0]?.title, "One Campus");
  assert.match(String(slideSpecs[0]?.cards?.[0]?.title || ""), /Aalto University/i);
});

test("generated slide quality rejects repeated visible items across nearby slides", () => {
  assert.throws(() => finalizeGeneratedSlideSpecs([{
    eyebrow: "Integration",
    guardrails: [
      { body: "Students from different fields work on shared projects.", id: "check-1", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "check-2", title: "Real-World Impact" },
      { body: "Aalto uses one campus to connect disciplines.", id: "check-3", title: "Campus Link" }
    ],
    guardrailsTitle: "Checks",
    signals: [
      { body: "Students from different fields work on shared projects.", id: "signal-1", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "signal-2", title: "Real-World Impact" },
      { body: "Aalto uses one campus to connect disciplines.", id: "signal-3", title: "Campus Link" }
    ],
    signalsTitle: "Signals",
    summary: "Aalto connects disciplines through shared work.",
    title: "Integration",
    type: "content"
  }, {
    eyebrow: "Checks",
    guardrails: [
      { body: "Students from different fields work on shared projects.", id: "check-1", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "check-2", title: "Real-World Impact" },
      { body: "Aalto University merges art, science, and technology into one campus.", id: "check-3", title: "One Campus" }
    ],
    guardrailsTitle: "Checks",
    signals: [
      { body: "Use plain examples for beginner audiences.", id: "signal-1", title: "Plain Examples" },
      { body: "Keep claims broad unless sources support details.", id: "signal-2", title: "Source Fit" },
      { body: "Avoid listing every faculty.", id: "signal-3", title: "Scope Control" }
    ],
    signalsTitle: "Signals",
    summary: "Use checks to keep the slide focused.",
    title: "Integration Checks",
    type: "content"
  }]), /repeats visible card content from slide 1/);
});

test("generated slide quality can repair repeated nearby items for incremental drafting", () => {
  const slideSpecs: GeneratedSlideSpec[] = finalizeGeneratedSlideSpecs([{
    eyebrow: "Integration",
    guardrails: [
      { body: "Students from different fields work on shared projects.", id: "check-1", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "check-2", title: "Real-World Impact" },
      { body: "Aalto uses one campus to connect disciplines.", id: "check-3", title: "Campus Link" }
    ],
    guardrailsTitle: "Checks",
    signals: [
      { body: "Students from different fields work on shared projects.", id: "signal-1", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "signal-2", title: "Real-World Impact" },
      { body: "Aalto uses one campus to connect disciplines.", id: "signal-3", title: "Campus Link" }
    ],
    signalsTitle: "Signals",
    summary: "Aalto connects disciplines through shared work.",
    title: "Integration",
    type: "content"
  }, {
    eyebrow: "Checks",
    guardrails: [
      { body: "Students from different fields work on shared projects.", id: "check-1", title: "Shared Projects" },
      { body: "Real-world problems are solved by combining diverse expertise.", id: "check-2", title: "Real-World Impact" },
      { body: "Aalto University merges art, science, and technology into one campus.", id: "check-3", title: "One Campus" }
    ],
    guardrailsTitle: "Checks",
    signals: [
      { body: "Use plain examples for beginner audiences.", id: "signal-1", title: "Plain Examples" },
      { body: "Keep claims broad unless sources support details.", id: "signal-2", title: "Source Fit" },
      { body: "Avoid listing every faculty.", id: "signal-3", title: "Scope Control" }
    ],
    signalsTitle: "Signals",
    summary: "Use checks to keep the slide focused.",
    title: "Integration Checks",
    type: "content"
  }], { repairNearbyDuplicateItems: true });

  assert.notEqual(slideSpecs[1]?.guardrails?.[0]?.title, "Focus on Integration");
  assert.match(String(slideSpecs[1]?.guardrails?.[0]?.body || ""), /Use checks/i);
});

test("generated slide quality does not report same-slide repeats as previous-slide repeats", () => {
  assert.doesNotThrow(() => finalizeGeneratedSlideSpecs([{
    bullets: [
      { body: "Compare degree options against your goals.", id: "summary-1", title: "Compare programs" },
      { body: "Review admission dates before choosing a path.", id: "summary-2", title: "Check deadlines" },
      { body: "Save the pages you need for follow-up.", id: "summary-3", title: "Keep links" }
    ],
    eyebrow: "Next steps",
    resources: [
      { body: "Compare degree options against your goals.", id: "resource-1", title: "Compare programs" },
      { body: "Use the official site to compare current study options.", id: "resource-2", title: "Current options" }
    ],
    resourcesTitle: "Resources",
    summary: "Use the official site to compare current study options.",
    title: "Choose a path",
    type: "summary"
  }]));
});

test("generated slide quality repairs known bad translations", () => {
  const slideSpecs: GeneratedSlideSpec[] = finalizeGeneratedSlideSpecs([{
    bullets: [
      { body: "Mallin ulosteen rakenteelliset ehdotukset eivät kuulu näkyvään tekstiin.", id: "summary-1", title: "Mallin tuotos" },
      { body: "Tarkistuspolku pitää ehdotukset arvioitavina.", id: "summary-2", title: "Tarkistus" },
      { body: "Lähteet auttavat pitämään sisällön perusteltuna.", id: "summary-3", title: "Lähteet" }
    ],
    eyebrow: "Yhteenveto",
    resources: [
      { body: "Käytä tallennettuja lähteitä ennen hyväksyntää.", id: "resource-1", title: "Lähteet" },
      { body: "Tarkista ehdotus ennen käyttöönottoa.", id: "resource-2", title: "Tarkistus" }
    ],
    resourcesTitle: "Seuraavaksi",
    summary: "Tarkista ehdotus ennen hyväksyntää.",
    title: "Huono käännös",
    type: "summary"
  }]);
  const visibleText = collectGeneratedVisibleText(slideSpecs);

  assert.ok(!visibleText.some((value: string) => /\buloste/i.test(value)), "known bad translation should not remain visible");
  assert.ok(visibleText.some((value: string) => /Mallin tuotoksen rakenteelliset ehdotukset/i.test(value)), "known bad translation should be repaired");
});

test("deck plan validation repairs known bad translations and rejects incomplete Finnish endings", () => {
  const fields = {
    lang: "fi",
    sourcingStyle: "none",
    title: "Slideotter"
  };
  const normalizedPlan = normalizeDeckPlanForValidation(fields, {
    language: "Finnish",
    outline: "1. Slideotter:n rooli: mallin ulosteen rakenteelliset ehdotukset\n2. Lopetus",
    slides: [
      {
        intent: "Näytä miten luonnostelu hyötyy mallin ulosteen rakenteellisista ehdotuksista.",
        keyMessage: "Mallin ulosteen rakenteelliset ehdotukset tarvitsevat tarkistuksen.",
        role: "opening",
        sourceNeed: "Käytä käyttäjän briiffiä.",
        title: "Mallin ulosteen rakenteelliset ehdotukset",
        type: "cover",
        value: "Yleisö ymmärtää tarkistuksen arvon.",
        visualNeed: "Selkeä otsikkodia."
      },
      {
        intent: "Päätä yhteenvetoon.",
        keyMessage: "Tarkistus pitää esityksen johdonmukaisena.",
        role: "handoff",
        sourceNeed: "Käytä käyttäjän briiffiä.",
        title: "Lopetus",
        type: "summary",
        value: "Yleisö tietää seuraavan tarkistusaskeleen.",
        visualNeed: "Selkeä yhteenveto."
      }
    ]
  }, 2);

  assert.doesNotMatch(String(normalizedPlan.outline), /\buloste/i);
  assert.doesNotMatch(String(normalizedPlan.slides?.[0]?.title), /\buloste/i);
  assert.match(String(normalizedPlan.slides?.[0]?.title), /\btuotoksen\b/i);
  assert.doesNotThrow(() => validateDeckPlan(normalizedPlan, 2));

  const incompletePlan = normalizeDeckPlanForValidation(fields, {
    language: "Finnish",
    outline: "1. Puutteellinen",
    slides: [{
      intent: "Näytä miten prosessi alkaa ja lähteen",
      keyMessage: "Tarkistus pitää näkyvän tekstin valmiina.",
      role: "opening",
      sourceNeed: "Käytä käyttäjän briiffiä.",
      title: "Puutteellinen",
      type: "cover",
      value: "Yleisö ymmärtää seuraavan askeleen.",
      visualNeed: "Selkeä otsikkodia."
    }]
  }, 1);

  assert.throws(() => validateDeckPlan(incompletePlan, 1), /appears incomplete/);
});

test("deck plan validation derives missing slide intent from usable outline fields", () => {
  const normalizedPlan = normalizeDeckPlanForValidation({
    sourcingStyle: "none",
    title: "Outline resilience"
  }, {
    audience: "Local presenters",
    language: "English",
    narrativeArc: "Open with the problem, explain the workflow, and close with the next action.",
    outline: "1. Problem\n2. Workflow\n3. Next action",
    slides: [
      {
        keyMessage: "Deck creation should fail only when the outline lacks real slide meaning.",
        role: "opening",
        title: "Usable outline",
        type: "cover",
        value: "The author can review the generated story before drafting slides."
      },
      {
        keyMessage: "Adjacent fields can carry the slide beat when a provider omits intent.",
        role: "concept",
        title: "Provider gaps",
        type: "content",
        value: "The plan remains editable without another full generation attempt."
      },
      {
        keyMessage: "Validation still requires enough concrete text to draft the deck.",
        role: "handoff",
        title: "Draft safely",
        type: "summary",
        value: "The author can continue into staged content generation."
      }
    ],
    thesis: "Outline validation should be strict about meaning, not brittle about one missing redundant field."
  }, 3);

  assert.equal(normalizedPlan.slides?.[1]?.intent, "Adjacent fields can carry the slide beat when a provider omits intent.");
  assert.doesNotThrow(() => validateDeckPlan(normalizedPlan, 3));
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
