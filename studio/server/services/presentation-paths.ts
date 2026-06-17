import * as fs from "fs";
import * as path from "path";
import { presentationsDir, stateDir } from "./paths.ts";

const defaultPresentationId = "slideotter";
const presentationRuntimeFile = path.join(stateDir, "runtime.json");

type PresentationPaths = {
  customVisualsFile: string;
  deckContextFile: string;
  id: string;
  layoutsFile: string;
  materialsDir: string;
  materialsFile: string;
  memoryFile: string;
  metaFile: string;
  outlinePlansFile: string;
  rootDir: string;
  slidesDir: string;
  sourcesFile: string;
  stateDir: string;
  variantsFile: string;
};

function assertPresentationId(id: unknown): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(id || ""))) {
    throw new Error(`Invalid presentation id: ${id}`);
  }

  return String(id);
}

function presentationRoot(id: unknown): string {
  return path.join(presentationsDir, assertPresentationId(id));
}

function getPresentationPaths(id: unknown): PresentationPaths {
  const rootDir = presentationRoot(id);

  return {
    id: assertPresentationId(id),
    metaFile: path.join(rootDir, "presentation.json"),
    materialsDir: path.join(rootDir, "materials"),
    materialsFile: path.join(rootDir, "state", "materials.json"),
    memoryFile: path.join(rootDir, "state", "memory.json"),
    customVisualsFile: path.join(rootDir, "state", "custom-visuals.json"),
    layoutsFile: path.join(rootDir, "state", "layouts.json"),
    outlinePlansFile: path.join(rootDir, "state", "outline-plans.json"),
    rootDir,
    slidesDir: path.join(rootDir, "slides"),
    stateDir: path.join(rootDir, "state"),
    deckContextFile: path.join(rootDir, "state", "deck-context.json"),
    sourcesFile: path.join(rootDir, "state", "sources.json"),
    variantsFile: path.join(rootDir, "state", "variants.json"),
  };
}

function getActivePresentationPathsFromRuntime(): PresentationPaths {
  try {
    const runtime = JSON.parse(fs.readFileSync(presentationRuntimeFile, "utf8"));
    const activePresentationId = typeof runtime.activePresentationId === "string"
      ? runtime.activePresentationId
      : defaultPresentationId;
    return getPresentationPaths(activePresentationId);
  } catch {
    return getPresentationPaths(defaultPresentationId);
  }
}

export {
  assertPresentationId,
  defaultPresentationId,
  getActivePresentationPathsFromRuntime,
  getPresentationPaths,
  presentationRuntimeFile,
  presentationRoot,
  type PresentationPaths,
};
