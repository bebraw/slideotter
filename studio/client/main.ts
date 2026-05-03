import "./styles.css";

// Load the DOM slide renderer before app composition so preview, export, and
// presentation helpers are registered before workbenches mount.
import("./preview/slide-dom.ts")
  .then(() => import("./app.ts"))
  .catch((error: unknown) => {
    console.error(error);
  });
