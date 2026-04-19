# presentation-template

This repository packages the imported `pptx-generator` skill with a small runnable demo deck.

The project is set up around the skill's "create from scratch" workflow:

- `skills/pptx-generator/SKILL.md` contains the imported skill guidance.
- `slides/slide-01.js` to `slides/slide-04.js` demonstrate the slide module pattern.
- `slides/theme.js` centralizes the theme object expected by the slides.
- `slides/compile.js` assembles the modules into a PowerPoint file.
- `slides/export-pdf.js` converts the generated PPTX into PDF when a supported local converter is installed.

## Demo deck

The demo presentation is a four-slide starter deck:

- Cover
- Outline
- Content with metrics and a chart
- Summary / next steps

Generated output goes to `slides/output/demo-presentation.pptx`.
PDF output goes to `slides/output/demo-presentation.pdf`.

## Usage

Install dependencies:

```bash
npm install
```

Build the demonstration presentation:

```bash
npm run build
```

Build the presentation and export a PDF:

```bash
npm run build:pdf
```

`build:pdf` first regenerates the PPTX and then converts it to PDF.

Supported local converters:

- LibreOffice via `soffice` or `/Applications/LibreOffice.app`
- Keynote via AppleScript on macOS

## Project structure

```text
.
├── package.json
├── README.md
├── skills/
│   └── pptx-generator/
│       └── SKILL.md
└── slides/
    ├── compile.js
    ├── export-pdf.js
    ├── helpers.js
    ├── slide-01.js
    ├── slide-02.js
    ├── slide-03.js
    ├── slide-04.js
    ├── theme.js
    └── output/
```

## Notes

- The deck uses `Avenir Next` as the default English sans-serif font for macOS.
- `slides/output/` is git-ignored so generated binaries stay local.
- If you want to extend the deck, duplicate one of the existing slide modules and add it to `slides/compile.js`.
- PDF export depends on a locally installed converter. The repository does not bundle one.
