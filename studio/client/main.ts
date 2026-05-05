import { applyInitialAppTheme } from "./platform/app-theme-bootstrap.ts";
import "./styles.css";

applyInitialAppTheme(document, window);

// Load the DOM slide renderer before app composition so preview, export, and
// presentation helpers are registered before workbenches mount.
import("./preview/slide-dom.ts")
  .then(() => import("./app.ts"))
  .catch((error: unknown) => {
    console.error(error);
  });
