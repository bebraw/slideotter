import { listCustomVisuals } from "./services/custom-visuals.ts";
import {
  readFavoriteLayouts,
  readLayouts
} from "./services/layouts.ts";
import { listMaterials } from "./services/material-library.ts";
import { listSources } from "./services/sources.ts";
import {
  getVariantStorageStatus,
  listAllVariants
} from "./services/variants.ts";

type JsonObject = Record<string, unknown>;

function getWorkspaceAssetsState(): JsonObject {
  return {
    customVisuals: listCustomVisuals(),
    favoriteLayouts: readFavoriteLayouts().layouts,
    layouts: readLayouts().layouts,
    materials: listMaterials(),
    sources: listSources(),
    variantStorage: getVariantStorageStatus(),
    variants: listAllVariants()
  };
}

export { getWorkspaceAssetsState };
