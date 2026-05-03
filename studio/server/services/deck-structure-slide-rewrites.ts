import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray,
  type JsonRecord
} from "../../shared/json-utils.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

type JsonObject = JsonRecord;
type SlideSpec = JsonObject;

function getIndexedJsonObject(items: unknown[], index: number): JsonObject {
  return asJsonObject(items[index]);
}

export function rewriteCoverSlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  const cards = asJsonObjectArray(baseSpec.cards);
  const contentCards = asJsonObjectArray(content.cards);
  return asJsonObject(validateSlideSpec({
    cards: cards.map((card: JsonObject, index: number) => ({
      ...card,
      body: getIndexedJsonObject(contentCards, index).body,
      title: getIndexedJsonObject(contentCards, index).title
    })),
    eyebrow: content.eyebrow,
    index: proposedIndex,
    note: content.note,
    summary: content.summary,
    title: proposedTitle,
    type: "cover"
  }));
}

export function rewriteDividerSlideSpec(_baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string): SlideSpec {
  return asJsonObject(validateSlideSpec({
    index: proposedIndex,
    title: proposedTitle,
    type: "divider"
  }));
}

export function rewriteQuoteSlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  return asJsonObject(validateSlideSpec({
    attribution: baseSpec.attribution || content.attribution,
    context: content.context,
    index: proposedIndex,
    quote: content.quote,
    source: baseSpec.source || content.source,
    title: proposedTitle,
    type: "quote"
  }));
}

export function rewritePhotoSlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  return asJsonObject(validateSlideSpec({
    caption: content.caption,
    index: proposedIndex,
    media: baseSpec.media ? { ...asJsonObject(baseSpec.media) } : undefined,
    title: proposedTitle,
    type: "photo"
  }));
}

export function rewritePhotoGridSlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  return asJsonObject(validateSlideSpec({
    caption: content.caption,
    index: proposedIndex,
    mediaItems: asJsonObjectArray(baseSpec.mediaItems).map((item: JsonObject) => ({ ...item })),
    summary: content.summary,
    title: proposedTitle,
    type: "photoGrid"
  }));
}

export function rewriteTocSlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  const cards = asJsonObjectArray(baseSpec.cards);
  const contentCards = asJsonObjectArray(content.cards);
  return asJsonObject(validateSlideSpec({
    cards: cards.map((card: JsonObject, index: number) => ({
      ...card,
      body: getIndexedJsonObject(contentCards, index).body,
      title: getIndexedJsonObject(contentCards, index).title
    })),
    eyebrow: content.eyebrow,
    index: proposedIndex,
    note: content.note,
    summary: content.summary,
    title: proposedTitle,
    type: "toc"
  }));
}

export function rewriteContentSlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  const guardrails = asJsonObjectArray(baseSpec.guardrails);
  const signals = asJsonObjectArray(baseSpec.signals);
  const contentGuardrails = asJsonObjectArray(content.guardrails);
  const contentSignals = asJsonObjectArray(content.signals);
  return asJsonObject(validateSlideSpec({
    eyebrow: content.eyebrow,
    guardrails: guardrails.map((guardrail: JsonObject, index: number) => ({
      body: getIndexedJsonObject(contentGuardrails, index).body,
      id: guardrail.id || `guardrail-${index + 1}`,
      title: getIndexedJsonObject(contentGuardrails, index).title
    })),
    guardrailsTitle: content.guardrailsTitle,
    index: proposedIndex,
    signals: signals.map((signal: JsonObject, index: number) => ({
      body: getIndexedJsonObject(contentSignals, index).body,
      id: signal.id || `signal-${index + 1}`,
      title: getIndexedJsonObject(contentSignals, index).title
    })),
    signalsTitle: content.signalsTitle,
    summary: content.summary,
    title: proposedTitle,
    type: "content"
  }));
}

export function rewriteSummarySlideSpec(baseSpec: SlideSpec, proposedIndex: number, proposedTitle: string, content: JsonObject): SlideSpec {
  const bullets = asJsonObjectArray(baseSpec.bullets);
  const resources = asJsonObjectArray(baseSpec.resources);
  const contentBullets = asJsonObjectArray(content.bullets);
  const contentResources = asJsonObjectArray(content.resources);
  return asJsonObject(validateSlideSpec({
    bullets: bullets.map((bullet: JsonObject, index: number) => ({
      ...bullet,
      body: getIndexedJsonObject(contentBullets, index).body,
      title: getIndexedJsonObject(contentBullets, index).title
    })),
    eyebrow: content.eyebrow,
    index: proposedIndex,
    resources: resources.map((resource: JsonObject, index: number) => ({
      ...resource,
      body: getIndexedJsonObject(contentResources, index).body,
      title: getIndexedJsonObject(contentResources, index).title
    })),
    resourcesTitle: content.resourcesTitle,
    summary: content.summary,
    title: proposedTitle,
    type: "summary"
  }));
}
