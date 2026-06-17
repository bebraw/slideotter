import * as path from "path";
import { ensureAllowedDir } from "./ensure-allowed-dir.ts";
import {
  presentationsDir,
  stateDir
} from "./paths.ts";
import {
  asJsonObject,
  createDefaultRegistry,
  defaultActivePresentationId,
  normalizeRegistry,
  normalizeRuntimeState,
  presentationsRegistryFile,
  type JsonObject,
  type PresentationsRegistry,
  type RuntimeState
} from "./presentation-state.ts";
import { readJson, writeJson } from "./service-json.ts";

const presentationRuntimeFile = path.join(stateDir, "runtime.json");

function ensurePresentationRuntime(): PresentationsRegistry {
  ensureAllowedDir(stateDir);
  ensureAllowedDir(presentationsDir);

  if (!readJson(presentationsRegistryFile, null)) {
    writeJson(presentationsRegistryFile, createDefaultRegistry());
  }

  return normalizeRegistry(readJson(presentationsRegistryFile, createDefaultRegistry()));
}

function readPresentationRuntimeState(registry: PresentationsRegistry): RuntimeState {
  return normalizeRuntimeState(readJson(presentationRuntimeFile, {
    activePresentationId: defaultActivePresentationId(registry)
  }), registry);
}

function writePresentationRuntimeState(runtime: JsonObject, registry: PresentationsRegistry): RuntimeState {
  const current = readJson(presentationRuntimeFile, {});
  const normalized = normalizeRuntimeState({
    ...asJsonObject(current),
    ...runtime
  }, registry);
  writeJson(presentationRuntimeFile, normalized);
  return normalized;
}

export {
  ensurePresentationRuntime,
  readPresentationRuntimeState,
  writePresentationRuntimeState
};
