import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "vite";

const rootDir = import.meta.dirname;
const clientRoot = path.join(rootDir, "studio/client");
const clientOutDir = path.join(rootDir, "studio/client-dist");

export default defineConfig({
  appType: "spa",
  build: {
    emptyOutDir: true,
    outDir: clientOutDir,
    sourcemap: true
  },
  plugins: [
    {
      name: "slideotter-stable-server-assets",
      closeBundle() {
        fs.copyFileSync(path.join(clientRoot, "styles.css"), path.join(clientOutDir, "styles.css"));
        fs.copyFileSync(path.join(clientRoot, "favicon.svg"), path.join(clientOutDir, "favicon.svg"));
      }
    }
  ],
  publicDir: false,
  root: clientRoot
});
