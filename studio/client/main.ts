import "./styles.css";

// Load the DOM slide renderer before app composition so preview, export, and
// presentation helpers are registered before workbenches mount.
import "./preview/slide-dom.ts";

// The app shell imports the feature namespaces it composes, mounts shared
// state, and wires page, drawer, preview, validation, and workflow workbenches.
import "./app.ts";
