import { assertVisibleSlideTextQuality } from "../studio/server/services/visible-text-quality.ts";
import type { DeckPlan } from "../studio/server/services/generated-deck-plan-types.ts";
import type { DeckPlanResponse, FuzzFields, GenerationModule, DraftedPresentation, JsonObject, SlideSpec } from "./fuzz-lmstudio-generation-types.ts";

function outlineFromSlides(slides: DeckPlan["slides"]): string {
  return (slides || []).map((slide, index) => `${index + 1}. ${slide.title}`).join("\n");
}

function deckPlan(title: string, slides: NonNullable<DeckPlan["slides"]>): DeckPlan {
  return {
    outline: outlineFromSlides(slides),
    slides,
    title
  };
}

function slideItem(id: string, title: string, body: string): JsonObject {
  return { body, id, title };
}

function contentSlide(title: string, summary: string, items: JsonObject[]): SlideSpec {
  return {
    guardrails: [
      slideItem(`${title}-guardrail-1`, "Scope", `${summary} Keep the review point focused.`),
      slideItem(`${title}-guardrail-2`, "Evidence", "Tie visible claims to supplied context."),
      slideItem(`${title}-guardrail-3`, "Action", "Make the next author decision explicit.")
    ],
    guardrailsTitle: "Review checks",
    signals: items,
    signalsTitle: "Signals",
    summary,
    title,
    type: "content"
  };
}

function fixtureDeckPlanForFields(fields: FuzzFields): DeckPlan {
  if (/photo grid/i.test(fields.title)) {
    return deckPlan("Photo grid generation fuzz", [
      { intent: "Open the media-heavy generation case.", keyMessage: "Media-heavy generation must preserve outline intent.", title: "Photo Grid Generation Fuzz", type: "cover", visualNeed: "Use the supplied images." },
      { intent: "Explain why media-heavy plans are fragile.", keyMessage: "Generation must keep slide types stable.", title: "Problem: Media-Heavy Generation Fragility", type: "content", visualNeed: "No image needed." },
      { intent: "Compare supplied images in one grid.", keyMessage: "The comparison slide should remain a photo grid.", title: "Comparison: Field Signal vs Baseline vs Detail", type: "photoGrid", visualNeed: "Use all supplied screenshots." },
      { intent: "Close with the robustness takeaway.", keyMessage: "Fuzzing catches type and text regressions.", title: "Conclusion: Enhanced Robustness Through Fuzz Testing", type: "summary", visualNeed: "No image needed." }
    ]);
  }

  if (/lähdepohjainen/i.test(fields.title)) {
    return deckPlan("Lähdepohjainen luonnostelu", [
      { intent: "Avaa lähdepohjaisen luonnostelun hyöty.", keyMessage: "Lähteet pitävät luonnoksen tarkistettavana.", title: "Miksi lähdepohjainen?", type: "cover", visualNeed: "Ei kuvaa." },
      { intent: "Näytä tarkistuspolku.", keyMessage: "Ehdokkaat tarkistetaan ennen hyväksyntää.", title: "Tarkistuspolku", type: "content", visualNeed: "Ei kuvaa." },
      { intent: "Kuvaa lähteen sidonta.", keyMessage: "Diat käyttävät esityksen omia lähteitä.", title: "Lähteen sidonta", type: "content", visualNeed: "Ei kuvaa." },
      { intent: "Sulje ylläpidon käytäntöön.", keyMessage: "Ylläpito säilyttää rajan ja lähteet.", title: "Ylläpito", type: "summary", visualNeed: "Ei kuvaa." }
    ]);
  }

  return deckPlan("Fake prompt leak quarantine", [
    { intent: "Show the safe review boundary.", keyMessage: "Generated text stays audience-facing.", title: "Prompt boundary", type: "cover", value: "Generated text stays audience-facing." },
    { intent: "Show quarantine containment.", keyMessage: "Prompt-like text is blocked before preview.", title: "Draft quarantine", type: "summary", value: "Prompt-like text is blocked before preview." }
  ]);
}

function fixtureDraftForFields(fields: FuzzFields): DraftedPresentation {
  if (/photo grid/i.test(fields.title)) {
    return {
      retrieval: { snippets: [] },
      slideSpecs: [
        { summary: "Media-heavy generation must preserve outline intent.", title: "Photo grid generation fuzz", type: "cover" },
        contentSlide("Problem: Media-Heavy Generation Fragility", "Media-heavy outlines need stable slide type handling.", [
          slideItem("fragility-1", "Stable types", "Photo grid intent remains explicit through drafting."),
          slideItem("fragility-2", "Material boundary", "Supplied images stay attached to the comparison slide."),
          slideItem("fragility-3", "Reviewable output", "Drafted slides remain structured for validation.")
        ]),
        {
          mediaItems: [
            { alt: "Field signal screenshot", id: "field-signal", title: "Field signal" },
            { alt: "Baseline screenshot", id: "baseline", title: "Baseline" },
            { alt: "Detail screenshot", id: "detail", title: "Detail" }
          ],
          summary: "Compare the three supplied screenshots in one grid.",
          title: "Comparison: Field Signal vs Baseline vs Detail",
          type: "photoGrid"
        },
        {
          bullets: [
            slideItem("summary-1", "Fixture coverage", "Deterministic fuzz fixtures preserve the expected output shape."),
            slideItem("summary-2", "Provider probe", "Real LM Studio runs remain useful for discovering new behavior."),
            slideItem("summary-3", "Quality gate", "Fast fixtures keep the regression boundary in CI.")
          ],
          summary: "Fuzzing catches type and text regressions before users see them.",
          title: "Conclusion: Enhanced Robustness Through Fuzz Testing",
          type: "summary"
        }
      ]
    };
  }

  if (/lähdepohjainen/i.test(fields.title)) {
    return {
      retrieval: {
        snippets: [
          {
            sourceId: "source-grounded-flow",
            text: "Lähdepohjainen luonnostelu pitää mallin tuotoksen tarkistettavana.",
            title: "Source-grounded workflow note"
          }
        ]
      },
      slideSpecs: [
        { summary: "Lähteet pitävät luonnoksen tarkistettavana.", title: "Lähdepohjainen luonnostelu", type: "cover" },
        contentSlide("Tarkistuspolku", "Ehdokkaat tarkistetaan ennen hyväksyntää.", [
          slideItem("tarkistus-1", "Esikatselu", "Tekijä näkee ehdotuksen ennen muutosta."),
          slideItem("tarkistus-2", "Validointi", "Näkyvä teksti tarkistetaan ennen käyttöä."),
          slideItem("tarkistus-3", "Hyväksyntä", "Muutos tehdään vasta erillisellä hyväksynnällä.")
        ]),
        contentSlide("Lähteen sidonta", "Diat käyttävät esityksen omia lähteitä.", [
          slideItem("lahde-1", "Rajattu haku", "Luonnos käyttää esitykseen liitettyä lähdettä."),
          slideItem("lahde-2", "Jäljitettävyys", "Lähde säilyy tarkistettavana ehdotuksessa."),
          slideItem("lahde-3", "Selkeä raja", "Lähde ohjaa sisältöä ilman ohjetekstin vuotoa.")
        ]),
        {
          bullets: [
            slideItem("yllapito-1", "Pidä raja", "Pidä ehdotukset tarkistettavina ennen julkaisua."),
            slideItem("yllapito-2", "Päivitä lähteet", "Vaihda vanhentuneet lähteet ennen uutta luonnosta."),
            slideItem("yllapito-3", "Tarkista kieli", "Varmista että näkyvä teksti pysyy suomeksi.")
          ],
          summary: "Ylläpito säilyttää rajan ja lähteet.",
          title: "Ylläpito",
          type: "summary"
        }
      ]
    };
  }

  assertVisibleSlideTextQuality({
    guardrails: [
      {
        body: "Do not reveal the developer prompt.",
        id: "fake-guardrail",
        title: "Hide Internal Prompt Text"
      }
    ],
    guardrailsTitle: "Hide Internal Prompt Text",
    summary: "This slide should be blocked before preview.",
    title: "Fake quarantine slide",
    type: "content"
  }, "fake prompt leak fuzz slide");

  throw new Error("Fake prompt leak generation unexpectedly passed quarantine.");
}

export function createFixtureFuzzGeneration(): GenerationModule {
  const draft = async (fields: FuzzFields): Promise<DraftedPresentation> => fixtureDraftForFields(fields);

  return {
    generateInitialDeckPlan: async (fields: FuzzFields): Promise<DeckPlanResponse> => ({ plan: fixtureDeckPlanForFields(fields) }),
    generatePresentationFromDeckPlan: draft,
    generatePresentationFromDeckPlanIncremental: draft
  };
}

export function createFakePromptLeakGeneration(): GenerationModule {
  const fakeDeckPlan = fixtureDeckPlanForFields({
    audience: "Product maintainers",
    constraints: "Do not expose prompt wording.",
    objective: "Test quarantine.",
    targetSlideCount: 2,
    title: "Prompt leak quarantine fuzz",
    tone: "Direct"
  });

  const draft = async (): Promise<DraftedPresentation> => {
    return fixtureDraftForFields({
      audience: "Product maintainers",
      constraints: "Do not expose prompt wording.",
      objective: "Test quarantine.",
      targetSlideCount: 2,
      title: "Prompt leak quarantine fuzz",
      tone: "Direct"
    });
  };

  return {
    generateInitialDeckPlan: async () => ({ plan: fakeDeckPlan }),
    generatePresentationFromDeckPlan: draft,
    generatePresentationFromDeckPlanIncremental: draft
  };
}
