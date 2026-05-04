import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { type ApiPatternRoute } from "./routes.ts";
import { createSlideApiRoutes } from "./slide-api-routes.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";

type SlideRouteRegistryHandlers = {
  customVisualHandlers: ReturnType<typeof createCustomVisualHandlers>;
  materialSourceHandlers: ReturnType<typeof createMaterialSourceHandlers>;
  slideEditHandlers: ReturnType<typeof createSlideEditHandlers>;
};

function createSlideRouteRegistry({
  customVisualHandlers,
  materialSourceHandlers,
  slideEditHandlers
}: SlideRouteRegistryHandlers): readonly ApiPatternRoute[] {
  return createSlideApiRoutes({
    handleSlideContextUpdate: slideEditHandlers.handleSlideContextUpdate,
    handleSlideCurrentValidation: slideEditHandlers.handleSlideCurrentValidation,
    handleSlideCustomVisualUpdate: customVisualHandlers.handleSlideCustomVisualUpdate,
    handleSlideMaterialUpdate: materialSourceHandlers.handleSlideMaterialUpdate,
    handleSlideSourceUpdate: slideEditHandlers.handleSlideSourceUpdate,
    handleSlideSpecUpdate: slideEditHandlers.handleSlideSpecUpdate
  });
}

export { createSlideRouteRegistry };
