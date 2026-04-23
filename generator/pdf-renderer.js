const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { populatePresentation, resolveDeckMeta } = require("./deck");
const {
  mapFont,
  measureTextBlock,
  registerEmbeddedFonts,
  toPoints
} = require("./text-metrics");
const { bodyFont, theme } = require("./theme");

const POINTS_PER_INCH = 72;
const SLIDE_WIDTH = 10 * POINTS_PER_INCH;
const SLIDE_HEIGHT = 5.625 * POINTS_PER_INCH;

const ShapeType = {
  arc: "arc",
  ellipse: "ellipse",
  line: "line",
  rect: "rect",
  roundRect: "roundRect"
};

function asHex(color, fallback = "000000") {
  const value = String(color || fallback).replace(/^#/, "");
  return `#${value}`;
}

function opacityFromTransparency(transparency) {
  const value = Number.isFinite(transparency) ? transparency : 0;
  return Math.max(0, Math.min(1, 1 - (value / 100)));
}

function ensureParentDir(fileName) {
  fs.mkdirSync(path.dirname(fileName), { recursive: true });
}

class PdfSlide {
  constructor() {
    this.background = null;
    this.operations = [];
  }

  addShape(shapeType, options) {
    this.operations.push({
      kind: "shape",
      options: { ...options },
      shapeType
    });
  }

  addText(text, options) {
    this.operations.push({
      kind: "text",
      options: { ...options },
      text
    });
  }

  addChart(chartType, data, options) {
    this.operations.push({
      chartType,
      data,
      kind: "chart",
      options: { ...options }
    });
  }

  addImage(options) {
    this.operations.push({
      kind: "image",
      options: { ...options }
    });
  }
}

class PdfPresentation {
  constructor() {
    this.ShapeType = ShapeType;
    this.author = "";
    this.company = "";
    this.subject = "";
    this.title = "";
    this.lang = "en-US";
    this.slides = [];
  }

  addSlide() {
    const slide = new PdfSlide();
    this.slides.push(slide);
    return slide;
  }

  async writeFile({ fileName }) {
    ensureParentDir(fileName);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        autoFirstPage: false,
        info: {
          Author: this.author,
          Creator: this.company,
          Subject: this.subject,
          Title: this.title
        },
        margin: 0,
        size: [SLIDE_WIDTH, SLIDE_HEIGHT]
      });

      const stream = fs.createWriteStream(fileName);
      let settled = false;

      function finish(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        callback(value);
      }

      doc.on("error", (error) => finish(reject, error));
      stream.on("error", (error) => finish(reject, error));
      stream.on("finish", () => finish(resolve));

      doc.pipe(stream);
      registerEmbeddedFonts(doc);

      for (const slide of this.slides) {
        renderSlide(doc, slide);
      }

      doc.end();
    });

    return fileName;
  }
}

function applyPaint(doc, line, fill) {
  const hasFill = fill && opacityFromTransparency(fill.transparency) > 0;
  const hasLine = line && opacityFromTransparency(line.transparency) > 0 && Number(line.pt || 0) > 0;

  if (hasFill) {
    doc.fillColor(asHex(fill.color, "FFFFFF"));
    doc.fillOpacity(opacityFromTransparency(fill.transparency));
  }

  if (hasLine) {
    doc.strokeColor(asHex(line.color, "000000"));
    doc.strokeOpacity(opacityFromTransparency(line.transparency));
    doc.lineWidth(Number(line.pt || 1));
  }

  if (hasFill && hasLine) {
    doc.fillAndStroke();
    return;
  }

  if (hasFill) {
    doc.fill();
    return;
  }

  if (hasLine) {
    doc.stroke();
  }
}

function renderShape(doc, shapeType, options) {
  const x = toPoints(options.x);
  const y = toPoints(options.y);
  const w = toPoints(options.w);
  const h = toPoints(options.h);
  const line = options.line || null;
  const fill = options.fill || null;

  doc.save();

  if (shapeType === ShapeType.line) {
    if (!line || opacityFromTransparency(line.transparency) <= 0) {
      doc.restore();
      return;
    }

    doc
      .strokeColor(asHex(line.color, "000000"))
      .strokeOpacity(opacityFromTransparency(line.transparency))
      .lineWidth(Number(line.pt || 1))
      .moveTo(x, y)
      .lineTo(x + w, y + h)
      .stroke();
    doc.restore();
    return;
  }

  if (shapeType === ShapeType.arc) {
    if (!line || opacityFromTransparency(line.transparency) <= 0) {
      doc.restore();
      return;
    }

    const radius = Math.min(w, h) / 2;
    const centerX = x + (w / 2);
    const centerY = y + (h / 2);

    doc
      .strokeColor(asHex(line.color, "000000"))
      .strokeOpacity(opacityFromTransparency(line.transparency))
      .lineWidth(Number(line.pt || 1))
      .arc(centerX, centerY, radius, 205, 335)
      .stroke();
    doc.restore();
    return;
  }

  if (shapeType === ShapeType.rect) {
    doc.rect(x, y, w, h);
    applyPaint(doc, line, fill);
    doc.restore();
    return;
  }

  if (shapeType === ShapeType.roundRect) {
    doc.roundedRect(x, y, w, h, toPoints(options.rectRadius || 0));
    applyPaint(doc, line, fill);
    doc.restore();
    return;
  }

  if (shapeType === ShapeType.ellipse) {
    doc.ellipse(x + (w / 2), y + (h / 2), w / 2, h / 2);
    applyPaint(doc, line, fill);
    doc.restore();
    return;
  }

  doc.restore();
}

function renderText(doc, text, options) {
  const x = toPoints(options.x);
  let y = toPoints(options.y);
  const height = toPoints(options.h);
  const { content, fontName, textOptions, measuredHeight, fontSize } = measureTextBlock(doc, text, options);

  doc.save();
  doc.font(fontName);
  doc.fontSize(fontSize);
  doc.fillColor(asHex(options.color, "000000"));
  doc.fillOpacity(1);
  if (options.valign === "middle" && height > measuredHeight) {
    y += (height - measuredHeight) / 2;
  } else if (options.valign === "bottom" && height > measuredHeight) {
    y += height - measuredHeight;
  }

  doc.text(content, x, y, textOptions);
  doc.restore();
}

function renderImage(doc, options) {
  const imageOptions = {};
  if (typeof options.w === "number") {
    imageOptions.width = toPoints(options.w);
  }
  if (typeof options.h === "number") {
    imageOptions.height = toPoints(options.h);
  }

  doc.image(options.path, toPoints(options.x), toPoints(options.y), imageOptions);
}

function renderSlide(doc, slide) {
  doc.addPage({
    margin: 0,
    size: [SLIDE_WIDTH, SLIDE_HEIGHT]
  });

  const backgroundColor = slide.background && slide.background.color
    ? slide.background.color
    : theme.bg;

  doc
    .save()
    .rect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT)
    .fill(asHex(backgroundColor, theme.bg))
    .restore();

  for (const operation of slide.operations) {
    if (operation.kind === "shape") {
      renderShape(doc, operation.shapeType, operation.options);
      continue;
    }

    if (operation.kind === "text") {
      renderText(doc, operation.text, operation.options);
      continue;
    }

    if (operation.kind === "image") {
      renderImage(doc, operation.options);
      continue;
    }

    if (operation.kind === "chart") {
      throw new Error(`Charts are not implemented in the PDF renderer: ${operation.chartType}`);
    }
  }
}

function createPdfPresentation(options = {}) {
  const resolvedDeckMeta = resolveDeckMeta();
  const pres = new PdfPresentation();
  pres.author = resolvedDeckMeta.author;
  pres.company = resolvedDeckMeta.company;
  pres.subject = resolvedDeckMeta.subject;
  pres.title = resolvedDeckMeta.title;
  return populatePresentation(pres, theme, options);
}

module.exports = {
  createPdfPresentation
};
