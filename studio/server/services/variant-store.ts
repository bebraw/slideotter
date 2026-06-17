import { getActivePresentationPaths } from "./active-presentation.ts";
import { ensureAllowedDir } from "./ensure-allowed-dir.ts";
import { readJson, writeJson } from "./json-io.ts";

type VariantsStore = {
  variants: unknown[];
};

const defaultVariants = {
  variants: []
};

function ensureVariantStore(): void {
  ensureAllowedDir(getActivePresentationPaths().stateDir);
}

function getVariants(): VariantsStore {
  ensureVariantStore();
  return readJson(getActivePresentationPaths().variantsFile, defaultVariants);
}

function saveVariants(nextVariants: VariantsStore): VariantsStore {
  ensureVariantStore();
  writeJson(getActivePresentationPaths().variantsFile, nextVariants);
  return nextVariants;
}

export {
  getVariants,
  saveVariants,
  type VariantsStore
};
