const fs = require("fs");
const { createTextMeasurementDoc, measureTextBlock } = require("./text-metrics");

const SLIDE_BOUNDS = {
  x: 0,
  y: 0,
  w: 10,
  h: 5.625
};

function normalizeText(text) {
  if (Array.isArray(text)) {
    return text
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item) {
          return String(item.text);
        }
        return "";
      })
      .join("");
  }

  return String(text);
}

function getBox(options) {
  if (!options || typeof options.x !== "number" || typeof options.y !== "number") {
    return null;
  }

  return {
    x: options.x,
    y: options.y,
    w: typeof options.w === "number" ? options.w : 0,
    h: typeof options.h === "number" ? options.h : 0
  };
}

function unionBoxes(current, next) {
  if (!current) {
    return { ...next };
  }

  const x1 = Math.min(current.x, next.x);
  const y1 = Math.min(current.y, next.y);
  const x2 = Math.max(current.x + current.w, next.x + next.w);
  const y2 = Math.max(current.y + current.h, next.y + next.h);

  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1
  };
}

function boxesOverlap(a, b, tolerance = 0.01) {
  const overlapWidth = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

  return overlapWidth > tolerance && overlapHeight > tolerance;
}

function overlapArea(a, b) {
  const overlapWidth = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0;
  }

  return overlapWidth * overlapHeight;
}

function horizontalOverlap(a, b) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
}

function verticalGap(upper, lower) {
  return lower.y - (upper.y + upper.h);
}

function boxContains(outer, inner, tolerance = 0.01) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}

function outOfBounds(box, bounds, bleed = 0) {
  return (
    box.x < bounds.x - bleed ||
    box.y < bounds.y - bleed ||
    box.x + box.w > bounds.x + bounds.w + bleed ||
    box.y + box.h > bounds.y + bounds.h + bleed
  );
}

function estimateWrappedLines(text, charsPerLine) {
  const safeCharsPerLine = Math.max(charsPerLine, 1);
  const paragraphs = String(text).split("\n");
  let lines = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines += 1;
      continue;
    }

    let currentLength = 0;

    for (const word of words) {
      const wordLength = word.length;
      if (wordLength > safeCharsPerLine) {
        if (currentLength > 0) {
          lines += 1;
          currentLength = 0;
        }

        lines += Math.ceil(wordLength / safeCharsPerLine);
        continue;
      }

      const separator = currentLength > 0 ? 1 : 0;
      if (currentLength + separator + wordLength > safeCharsPerLine) {
        lines += 1;
        currentLength = wordLength;
      } else {
        currentLength += separator + wordLength;
      }
    }

    if (currentLength > 0) {
      lines += 1;
    }
  }

  return lines;
}

function createSlideCanvas(pres, slideConfig, options = {}) {
  const slide = pres.addSlide();
  const trackLayout = options.trackLayout !== false;
  const elements = [];
  const groups = new Map();

  function record(type, id, box, meta = {}) {
    elements.push({
      type,
      id,
      box,
      meta: { ...meta }
    });

    if (!trackLayout || !box) {
      return;
    }

    const groupName = meta.group || id;
    const group = groups.get(groupName) || {
      id: groupName,
      box: null,
      skipBounds: false,
      skipOverlap: false,
      members: []
    };

    group.members.push(id);
    group.skipBounds = group.skipBounds || meta.skipBounds === true;
    group.skipOverlap = group.skipOverlap || meta.skipOverlap === true;

    if (meta.includeInGroup !== false) {
      group.box = unionBoxes(group.box, box);
    }

    groups.set(groupName, group);
  }

  return {
    slide,
    addShape(id, shapeType, optionsForShape, meta = {}) {
      slide.addShape(shapeType, optionsForShape);
      record("shape", id, getBox(optionsForShape), {
        ...meta,
        options: { ...optionsForShape }
      });
    },
    addText(id, text, optionsForText, meta = {}) {
      slide.addText(text, optionsForText);
      record("text", id, getBox(optionsForText), {
        ...meta,
        text: normalizeText(text),
        options: { ...optionsForText }
      });
    },
    addChart(id, chartType, data, optionsForChart, meta = {}) {
      slide.addChart(chartType, data, optionsForChart);
      record("chart", id, getBox(optionsForChart), {
        ...meta,
        data,
        options: { ...optionsForChart }
      });
    },
    addImage(id, optionsForImage, meta = {}) {
      slide.addImage(optionsForImage);
      record("image", id, getBox(optionsForImage), {
        ...meta,
        options: { ...optionsForImage }
      });
    },
    reserveGroup(id, box, meta = {}) {
      record("reserve", id, box, meta);
    },
    finalize() {
      return {
        slide,
        report: {
          slide: slideConfig,
          backgroundColor: slide.background && slide.background.color ? slide.background.color : "FFFFFF",
          bounds: { ...SLIDE_BOUNDS },
          elements,
          groups: Array.from(groups.values()).filter((group) => group.box)
        }
      };
    }
  };
}

function validateGeometry(reports, options = {}) {
  const bleed = options.bleed ?? 0;
  const issues = [];

  for (const report of reports) {
    for (const group of report.groups) {
      if (!group.skipBounds && outOfBounds(group.box, report.bounds, bleed)) {
        issues.push({
          level: "error",
          slide: report.slide.index,
          rule: "bounds",
          message: `Group "${group.id}" exceeds slide bounds`
        });
      }
    }

    for (let index = 0; index < report.groups.length; index += 1) {
      const left = report.groups[index];
      if (left.skipOverlap) {
        continue;
      }

      for (let compareIndex = index + 1; compareIndex < report.groups.length; compareIndex += 1) {
        const right = report.groups[compareIndex];
        if (right.skipOverlap) {
          continue;
        }

        if (boxesOverlap(left.box, right.box)) {
          issues.push({
            level: "error",
            slide: report.slide.index,
            rule: "overlap",
            message: `Groups "${left.id}" and "${right.id}" overlap`
          });
        }
      }
    }
  }

  return issues;
}

function validateVerticalBalance(reports, options = {}) {
  const issues = [];
  const minGap = options.minGap ?? 0.18;
  const ratioThreshold = options.ratioThreshold ?? 1.6;
  const differenceThreshold = options.differenceThreshold ?? 0.24;

  for (const report of reports) {
    if (report.slide.type !== "content") {
      continue;
    }

    const header = report.groups.find((group) => group.id === "section-header" && group.box);
    const progress = report.groups.find((group) => group.id === "slide-progress" && group.box);

    if (!header || !progress) {
      continue;
    }

    const contentGroups = report.groups.filter((group) => (
      group.box &&
      group.id !== "section-header" &&
      group.id !== "slide-progress"
    ));

    if (!contentGroups.length) {
      continue;
    }

    const contentBox = contentGroups.reduce((current, group) => unionBoxes(current, group.box), null);
    const topGap = contentBox.y - (header.box.y + header.box.h);
    const bottomGap = progress.box.y - (contentBox.y + contentBox.h);

    if (topGap < minGap || bottomGap < minGap) {
      continue;
    }

    const largerGap = Math.max(topGap, bottomGap);
    const smallerGap = Math.max(Math.min(topGap, bottomGap), Number.EPSILON);
    const ratio = largerGap / smallerGap;
    const difference = Math.abs(topGap - bottomGap);

    if (ratio > ratioThreshold && difference > differenceThreshold) {
      issues.push({
        level: "warn",
        slide: report.slide.index,
        rule: "vertical-balance",
        message: `Content is vertically imbalanced (${topGap.toFixed(2)}in below title vs ${bottomGap.toFixed(2)}in above progress bar)`
      });
    }
  }

  return issues;
}

function isCaptionLikeElement(element) {
  if (element.type !== "text" || !element.box || !element.meta) {
    return false;
  }

  const id = String(element.id || "").toLowerCase();
  const group = String(element.meta.group || "").toLowerCase();

  return /caption|reference|source|note/.test(id) || /caption|reference|source|note/.test(group);
}

function validateCaptionSpacing(reports, options = {}) {
  const issues = [];
  const minGap = options.minGap ?? 0.1;
  const maxGap = options.maxGap ?? 0.32;
  const minHorizontalOverlapRatio = options.minHorizontalOverlapRatio ?? 0.4;

  for (const report of reports) {
    const visuals = report.elements.filter((element) => (
      (element.type === "image" || element.type === "chart") &&
      element.box
    ));

    if (!visuals.length) {
      continue;
    }

    for (const element of report.elements) {
      if (!isCaptionLikeElement(element)) {
        continue;
      }

      const relatedVisuals = visuals
        .map((visual) => {
          const overlap = horizontalOverlap(element.box, visual.box);
          const overlapRatio = overlap / Math.max(Math.min(element.box.w, visual.box.w), Number.EPSILON);
          const gap = element.box.y >= visual.box.y
            ? verticalGap(visual.box, element.box)
            : verticalGap(element.box, visual.box);

          return {
            gap,
            overlapRatio,
            visual
          };
        })
        .filter((entry) => entry.overlapRatio >= minHorizontalOverlapRatio && entry.gap >= 0)
        .sort((left, right) => left.gap - right.gap);

      if (!relatedVisuals.length) {
        continue;
      }

      const nearest = relatedVisuals[0];

      if (nearest.gap < minGap) {
        issues.push({
          level: "warn",
          slide: report.slide.index,
          rule: "caption-spacing-tight",
          message: `Caption "${element.id}" sits close to visual "${nearest.visual.id}" (${nearest.gap.toFixed(2)}in gap)`
        });
      } else if (nearest.gap > maxGap) {
        issues.push({
          level: "warn",
          slide: report.slide.index,
          rule: "caption-spacing-loose",
          message: `Caption "${element.id}" sits far from visual "${nearest.visual.id}" (${nearest.gap.toFixed(2)}in gap)`
        });
      }
    }
  }

  return issues;
}

function validateTextFit(reports) {
  const issues = [];
  const measurement = createTextMeasurementDoc();

  try {
    for (const report of reports) {
      for (const element of report.elements) {
        if (element.type !== "text" || !element.box || !element.meta.text) {
          continue;
        }

        const fontSize = element.meta.options && element.meta.options.fontSize;
        if (typeof fontSize !== "number" || fontSize <= 0) {
          continue;
        }

        const { measuredHeight } = measureTextBlock(measurement.doc, element.meta.text, element.meta.options);
        const availableHeight = element.box.h * 72;
        const utilization = measuredHeight / Math.max(availableHeight, 1);

        if (utilization > 1.02) {
          issues.push({
            level: "error",
            slide: report.slide.index,
            rule: "text-overflow",
            message: `Text box "${element.id}" is likely to overflow (${measuredHeight.toFixed(1)}pt for ${availableHeight.toFixed(1)}pt available)`
          });
        } else if (utilization > 0.9) {
          issues.push({
            level: "warn",
            slide: report.slide.index,
            rule: "text-tight",
            message: `Text box "${element.id}" is close to its limit (${measuredHeight.toFixed(1)}pt for ${availableHeight.toFixed(1)}pt available)`
          });
        }
      }
    }
  } finally {
    measurement.dispose();
  }

  return issues;
}

function validateMinimumFontSize(reports, options = {}) {
  const issues = [];
  const minFontSizePt = options.minFontSizePt ?? 10;

  for (const report of reports) {
    for (const element of report.elements) {
      if (element.type !== "text" || !element.meta || !element.meta.options) {
        continue;
      }

      const fontSize = Number(element.meta.options.fontSize);
      if (!Number.isFinite(fontSize) || fontSize <= 0) {
        continue;
      }

      if (fontSize < minFontSizePt) {
        issues.push({
          level: "warn",
          slide: report.slide.index,
          rule: "font-size-small",
          message: `Text box "${element.id}" uses ${fontSize.toFixed(1)}pt text below the ${minFontSizePt.toFixed(1)}pt minimum`
        });
      }
    }
  }

  return issues;
}

function countWords(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function validateSlideWordCount(reports, options = {}) {
  const issues = [];
  const maxWordsPerSlide = options.maxWordsPerSlide ?? 80;

  for (const report of reports) {
    const totalWords = report.elements.reduce((sum, element) => {
      if (element.type !== "text" || !element.meta || !element.meta.text) {
        return sum;
      }

      return sum + countWords(element.meta.text);
    }, 0);

    if (totalWords > maxWordsPerSlide) {
      issues.push({
        level: "warn",
        slide: report.slide.index,
        rule: "slide-word-count",
        message: `Slide carries ${totalWords} visible words above the ${maxWordsPerSlide}-word maximum`
      });
    }
  }

  return issues;
}

function validateTextPadding(reports, options = {}) {
  const issues = [];
  const minHorizontal = options.minHorizontal ?? 0.08;
  const minTop = options.minTop ?? 0.08;
  const minBottom = options.minBottom ?? 0.05;

  for (const report of reports) {
    const elementsById = new Map(report.elements.map((element) => [element.id, element]));

    for (const group of report.groups) {
      const members = group.members
        .map((memberId) => elementsById.get(memberId))
        .filter(Boolean);

      const panels = members
        .filter((element) => element.type === "shape" && element.meta.role === "panel" && element.box);

      if (!panels.length) {
        continue;
      }

      const texts = members.filter((element) => element.type === "text" && element.box);

      for (const text of texts) {
        const matchingPanels = panels
          .filter((candidate) => boxContains(candidate.box, text.box, 0.02))
          .sort((left, right) => (left.box.w * left.box.h) - (right.box.w * right.box.h));

        const panel = matchingPanels[0] || panels
          .map((candidate) => ({
            candidate,
            area: overlapArea(candidate.box, text.box)
          }))
          .filter((entry) => entry.area > 0)
          .sort((left, right) => right.area - left.area)[0]?.candidate;

        if (!panel) {
          continue;
        }

        const leftInset = text.box.x - panel.box.x;
        const topInset = text.box.y - panel.box.y;
        const rightInset = (panel.box.x + panel.box.w) - (text.box.x + text.box.w);
        const bottomInset = (panel.box.y + panel.box.h) - (text.box.y + text.box.h);

        if (leftInset < minHorizontal || rightInset < minHorizontal || topInset < minTop || bottomInset < minBottom) {
          issues.push({
            level: "warn",
            slide: report.slide.index,
            rule: "text-padding",
            message: `Text box "${text.id}" sits close to panel "${panel.id}" (${leftInset.toFixed(2)}/${topInset.toFixed(2)}/${rightInset.toFixed(2)}/${bottomInset.toFixed(2)}in insets)`
          });
        }
      }
    }
  }

  return issues;
}

function parseHexColor(color, fallback = "000000") {
  const normalized = String(color || fallback).replace(/^#/, "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized.padStart(6, "0").slice(0, 6);

  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255
  };
}

function linearizeChannel(channel) {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  const rgb = parseHexColor(color);
  return (
    0.2126 * linearizeChannel(rgb.r) +
    0.7152 * linearizeChannel(rgb.g) +
    0.0722 * linearizeChannel(rgb.b)
  );
}

function contrastRatio(foreground, background) {
  const left = relativeLuminance(foreground);
  const right = relativeLuminance(background);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);

  return (lighter + 0.05) / (darker + 0.05);
}

function getPngDimensions(buffer) {
  if (buffer.length < 24) {
    return null;
  }

  const signature = buffer.subarray(0, 8);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!signature.equals(pngSignature)) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function getJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (segmentLength < 2) {
      return null;
    }

    const isSofMarker = (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    );

    if (isSofMarker) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function getGifDimensions(buffer) {
  if (buffer.length < 10) {
    return null;
  }

  const header = buffer.subarray(0, 6).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
}

function getImageDimensions(imagePath) {
  const buffer = fs.readFileSync(imagePath);

  return (
    getPngDimensions(buffer) ||
    getJpegDimensions(buffer) ||
    getGifDimensions(buffer)
  );
}

function findContainingPanel(element, shapes) {
  const containing = shapes
    .filter((shape) => {
      const fillColor = shape.meta.options && shape.meta.options.fill && shape.meta.options.fill.color;
      return Boolean(shape.box && fillColor && boxContains(shape.box, element.box, 0.02));
    })
    .sort((left, right) => (left.box.w * left.box.h) - (right.box.w * right.box.h));

  return containing[0] || null;
}

function validateTextContrast(reports, options = {}) {
  const issues = [];
  const minRatio = options.minRatio ?? 2.5;
  const warnRatio = options.warnRatio ?? 3;

  for (const report of reports) {
    const shapes = report.elements.filter((element) => element.type === "shape");

    for (const element of report.elements) {
      if (element.type !== "text" || !element.box || !element.meta.options) {
        continue;
      }

      const foreground = element.meta.options.color || "000000";
      const panel = findContainingPanel(element, shapes);
      const background = panel
        ? panel.meta.options.fill.color
        : report.backgroundColor || "FFFFFF";
      const ratio = contrastRatio(foreground, background);

      if (ratio < minRatio) {
        issues.push({
          level: "error",
          slide: report.slide.index,
          rule: "contrast-low",
          message: `Text box "${element.id}" has low contrast (${ratio.toFixed(2)}:1) against ${panel ? `panel "${panel.id}"` : "slide background"}`
        });
      } else if (ratio < warnRatio) {
        issues.push({
          level: "warn",
          slide: report.slide.index,
          rule: "contrast-tight",
          message: `Text box "${element.id}" is close to the contrast threshold (${ratio.toFixed(2)}:1)`
        });
      }
    }
  }

  return issues;
}

function validateImageAspectRatio(reports, options = {}) {
  const issues = [];
  const warnDelta = options.warnDelta ?? 0.03;
  const maxDelta = options.maxDelta ?? 0.08;

  for (const report of reports) {
    for (const element of report.elements) {
      if (element.type !== "image" || !element.box || !element.meta.options) {
        continue;
      }

      if (element.meta.skipAspectValidation === true) {
        continue;
      }

      const imagePath = element.meta.options.path;
      if (!imagePath) {
        continue;
      }

      let dimensions;
      try {
        dimensions = getImageDimensions(imagePath);
      } catch (error) {
        issues.push({
          level: "error",
          slide: report.slide.index,
          rule: "image-metadata",
          message: `Image "${element.id}" could not be inspected (${error.message})`
        });
        continue;
      }

      if (!dimensions || !dimensions.width || !dimensions.height) {
        issues.push({
          level: "error",
          slide: report.slide.index,
          rule: "image-metadata",
          message: `Image "${element.id}" uses an unsupported format for aspect validation`
        });
        continue;
      }

      const intrinsicRatio = dimensions.width / dimensions.height;
      const placedRatio = element.box.w / element.box.h;
      const delta = Math.abs((placedRatio / intrinsicRatio) - 1);

      if (delta > maxDelta) {
        issues.push({
          level: "error",
          slide: report.slide.index,
          rule: "image-aspect",
          message: `Image "${element.id}" distorts its source ratio (${placedRatio.toFixed(2)} placed vs ${intrinsicRatio.toFixed(2)} intrinsic)`
        });
      } else if (delta > warnDelta) {
        issues.push({
          level: "warn",
          slide: report.slide.index,
          rule: "image-aspect-tight",
          message: `Image "${element.id}" is close to aspect distortion (${placedRatio.toFixed(2)} placed vs ${intrinsicRatio.toFixed(2)} intrinsic)`
        });
      }
    }
  }

  return issues;
}

module.exports = {
  SLIDE_BOUNDS,
  contrastRatio,
  createSlideCanvas,
  normalizeText,
  validateCaptionSpacing,
  validateGeometry,
  validateImageAspectRatio,
  validateMinimumFontSize,
  validateSlideWordCount,
  validateVerticalBalance,
  validateTextContrast,
  validateTextFit,
  validateTextPadding
};
