import * as http from "http";

import {
  getTtsStatus,
  listPiperVoices,
  synthesizeNarration
} from "./services/tts.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type NarrationHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
};

export function createNarrationHandlers(deps: NarrationHandlerDependencies) {
  const { createJsonResponse, readJsonBody } = deps;

  function handleNarrationStatus(_req: ServerRequest, res: ServerResponse): void {
    createJsonResponse(res, 200, {
      piper: listPiperVoices(),
      tts: getTtsStatus()
    });
  }

  async function handleNarrationSynthesize(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
    const result = await synthesizeNarration({
      presentationId: String(body.presentationId || ""),
      slideId: String(body.slideId || ""),
      text: String(body.text || ""),
      ...(voiceId ? { voiceId } : {})
    });
    createJsonResponse(res, 200, {
      result,
      tts: getTtsStatus(voiceId || undefined)
    });
  }

  return {
    handleNarrationStatus,
    handleNarrationSynthesize
  };
}
