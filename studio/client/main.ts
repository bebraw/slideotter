import { applyInitialAppTheme } from "./platform/app-theme-bootstrap.ts";

applyInitialAppTheme(document, window);

// Load the DOM slide renderer before app composition so preview, export, and
// presentation helpers are registered before workbenches mount.
import("./styles.css")
  .then(() => import("./preview/slide-dom.ts"))
  .then(() => import("./app.ts"))
  .catch((error: unknown) => {
    console.error(error);
  });
