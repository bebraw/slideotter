const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { deckMeta, theme } = require("./theme");

const slideModules = [
  require("./slide-01"),
  require("./slide-02"),
  require("./slide-03"),
  require("./slide-04")
];

async function main() {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author = deckMeta.author;
  pres.company = deckMeta.company;
  pres.subject = deckMeta.subject;
  pres.title = deckMeta.title;
  pres.lang = "en-US";
  pres.theme = {
    headFontFace: "Avenir Next",
    bodyFontFace: "Avenir Next",
    lang: "en-US"
  };

  for (const slideModule of slideModules) {
    slideModule.createSlide(pres, theme);
  }

  const outputDir = path.join(__dirname, "output");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, "demo-presentation.pptx");
  await pres.writeFile({ fileName: outputFile });
  process.stdout.write(`${outputFile}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
