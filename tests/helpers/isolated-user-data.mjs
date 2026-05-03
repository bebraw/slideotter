import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slideotter-test-home-"));
const presentationsRoot = path.join(userDataRoot, "presentations");
const stateRoot = path.join(userDataRoot, "state");

process.env.SLIDEOTTER_HOME = userDataRoot;
delete process.env.SLIDEOTTER_DATA_DIR;

fs.mkdirSync(presentationsRoot, { recursive: true });
fs.mkdirSync(stateRoot, { recursive: true });

const sourcePresentationsRoot = path.join(repoRoot, "presentations");
const presentationEntries = fs.readdirSync(sourcePresentationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const sourceDir = path.join(sourcePresentationsRoot, entry.name);
    const targetDir = path.join(presentationsRoot, entry.name);
    fs.cpSync(sourceDir, targetDir, {
      force: false,
      recursive: true
    });
    const metaFile = path.join(targetDir, "presentation.json");
    const meta = fs.existsSync(metaFile)
      ? JSON.parse(fs.readFileSync(metaFile, "utf8"))
      : {};
    return {
      id: entry.name,
      title: typeof meta.title === "string" && meta.title.trim() ? meta.title : entry.name
    };
  });

fs.writeFileSync(path.join(stateRoot, "presentations.json"), `${JSON.stringify({
  presentations: presentationEntries
}, null, 2)}\n`, "utf8");

fs.writeFileSync(path.join(stateRoot, "runtime.json"), `${JSON.stringify({
  activePresentationId: presentationEntries.some((entry) => entry.id === "slideotter") ? "slideotter" : presentationEntries[0]?.id || "",
  creationDraft: {},
  llm: {
    modelOverride: ""
  },
  savedLayouts: [],
  savedThemes: []
}, null, 2)}\n`, "utf8");

process.once("exit", () => {
  fs.rmSync(userDataRoot, {
    force: true,
    recursive: true
  });
});
