const { getValidationConstraintOptions, readDesignConstraints } = require("./design-constraints");
const { createStandaloneSlideHtml, withBrowser } = require("./dom-export");
const { getDomPreviewState } = require("./dom-preview");
const { readValidationSettings, resolveValidationLevel } = require("./validation-settings");

const PX_PER_INCH = 96;
const PT_PER_PX = 72 / 96;
function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function createIssue(slide, level, rule, message) {
  return {
    level,
    message,
    rule,
    slide
  };
}

function createConfiguredIssue(slide, fallbackLevel, rule, message, validationSettings) {
  return createIssue(
    slide,
    resolveValidationLevel(rule, fallbackLevel, validationSettings),
    rule,
    message
  );
}

function summarizeIssues(issues) {
  return {
    errors: issues.filter((issue) => issue.level === "error"),
    issues,
    ok: !issues.some((issue) => issue.level === "error")
  };
}

function normalizeRect(rect) {
  return {
    bottom: Number(rect.bottom || 0),
    height: Number(rect.height || 0),
    left: Number(rect.left || 0),
    right: Number(rect.right || 0),
    top: Number(rect.top || 0),
    width: Number(rect.width || 0)
  };
}

function describeDomNode(item, fallback = "media") {
  const label = String(
    item.label ||
    item.alt ||
    item.className ||
    item.tagName ||
    fallback
  ).replace(/\s+/g, " ").trim();

  return label || fallback;
}

function shortestDistanceBetweenRects(first, second) {
  const a = normalizeRect(first);
  const b = normalizeRect(second);
  const horizontalOverlap = a.left < b.right && a.right > b.left;
  const verticalOverlap = a.top < b.bottom && a.bottom > b.top;

  if (horizontalOverlap) {
    if (b.top >= a.bottom) {
      return b.top - a.bottom;
    }
    if (a.top >= b.bottom) {
      return a.top - b.bottom;
    }
  }

  if (verticalOverlap) {
    if (b.left >= a.right) {
      return b.left - a.right;
    }
    if (a.left >= b.right) {
      return a.left - b.right;
    }
  }

  if (horizontalOverlap || verticalOverlap) {
    return -Math.min(
      Math.abs(a.bottom - b.top),
      Math.abs(b.bottom - a.top),
      Math.abs(a.right - b.left),
      Math.abs(b.right - a.left)
    );
  }

  const dx = Math.max(a.left - b.right, b.left - a.right, 0);
  const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
  return Math.sqrt((dx * dx) + (dy * dy));
}

function findNearestMedia(caption, mediaItems) {
  let nearest = null;

  mediaItems.forEach((media) => {
    const distance = shortestDistanceBetweenRects(media.rect, caption.rect);
    const absoluteDistance = Math.abs(distance);

    if (!nearest || absoluteDistance < nearest.absoluteDistance) {
      nearest = {
        absoluteDistance,
        distance,
        media
      };
    }
  });

  return nearest;
}

function unionRects(current, next) {
  if (!current) {
    return { ...next };
  }

  return {
    bottom: Math.max(current.bottom, next.bottom),
    height: Math.max(current.bottom, next.bottom) - Math.min(current.top, next.top),
    left: Math.min(current.left, next.left),
    right: Math.max(current.right, next.right),
    top: Math.min(current.top, next.top),
    width: Math.max(current.right, next.right) - Math.min(current.left, next.left)
  };
}

function parseCssColor(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return null;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const full = raw.length === 3
      ? raw.split("").map((char) => char + char).join("")
      : raw;
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16)
    };
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) {
    return null;
  }

  const parts = rgbMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return null;
  }

  return {
    r: Number(parts[0]),
    g: Number(parts[1]),
    b: Number(parts[2])
  };
}

function linearizeChannel(channel) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  return (
    0.2126 * linearizeChannel(color.r) +
    0.7152 * linearizeChannel(color.g) +
    0.0722 * linearizeChannel(color.b)
  );
}

function contrastRatio(foreground, background) {
  const fg = parseCssColor(foreground);
  const bg = parseCssColor(background);
  if (!fg || !bg) {
    return Number.POSITIVE_INFINITY;
  }

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function evaluateSlideInDom(slideEntry, previewState) {
  const html = createStandaloneSlideHtml(previewState, slideEntry);

  return async (page) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.setContent(html, { waitUntil: "load" });

    return page.evaluate(() => {
      function countWords(value) {
        return String(value || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .length;
      }

      const slide = document.querySelector(".dom-slide");
      if (!slide) {
        return {
          captionItems: [],
          contentRects: [],
          mediaItems: [],
          panelBoxes: [],
          progressRect: null,
          sectionHeaderRect: null,
          slideRect: null,
          textItems: [],
          wordCount: 0,
          workflowRegions: {}
        };
      }

      const slideRect = slide.getBoundingClientRect();
      const slideStyle = window.getComputedStyle(slide);

      function isVisibleBackground(value) {
        return value && value !== "transparent" && !/^rgba\(0,\s*0,\s*0,\s*0\)$/.test(value);
      }

      function findEffectiveBackground(element) {
        let current = element;

        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          if (isVisibleBackground(style.backgroundColor)) {
            return style.backgroundColor;
          }
          current = current.parentElement;
        }

        return slideStyle.backgroundColor;
      }

      const textSelector = ".dom-slide h1, .dom-slide h2, .dom-slide h3, .dom-slide p, .dom-slide span, .dom-slide strong";
      const textItems = Array.from(document.querySelectorAll(textSelector))
        .map((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return {
            backgroundColor: findEffectiveBackground(element),
            className: element.className || element.tagName.toLowerCase(),
            clientHeight: element.clientHeight || rect.height,
            clientWidth: element.clientWidth || rect.width,
            color: style.color,
            fontSizePx: Number.parseFloat(style.fontSize) || 0,
            parentClassName: element.parentElement && element.parentElement.className
              ? element.parentElement.className
              : "",
            rect: {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width
            },
            scrollHeight: element.scrollHeight || rect.height,
            scrollWidth: element.scrollWidth || rect.width,
            text
          };
        })
        .filter(Boolean);

      function getSerializableRect(element) {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width
        };
      }

      function getClassName(element) {
        if (!element || !element.className) {
          return "";
        }

        if (typeof element.className === "string") {
          return element.className;
        }

        return element.className.baseVal || "";
      }

      function isDecorativeMedia(element) {
        const className = getClassName(element);
        const role = String(element.getAttribute("role") || "").toLowerCase();
        const dataMedia = String(element.getAttribute("data-media") || "").toLowerCase();

        return element.getAttribute("aria-hidden") === "true" ||
          role === "presentation" ||
          role === "none" ||
          dataMedia === "decorative" ||
          /\b(icon|badge|decorative)\b/.test(className);
      }

      const mediaSelector = [
        ".dom-slide img",
        ".dom-slide svg",
        ".dom-slide canvas",
        ".dom-slide video",
        ".dom-slide [data-media]",
        ".dom-slide .dom-media",
        ".dom-slide .dom-screenshot",
        ".dom-slide .dom-diagram"
      ].join(", ");

      const mediaItems = Array.from(new Set(Array.from(document.querySelectorAll(mediaSelector))))
        .filter((element) => !isDecorativeMedia(element))
        .map((element) => {
          const tagName = element.tagName.toLowerCase();
          const accessibleLabel = element.getAttribute("aria-label") ||
            element.getAttribute("alt") ||
            element.getAttribute("data-label") ||
            "";
          const label = accessibleLabel ||
            element.getAttribute("data-media") ||
            getClassName(element) ||
            tagName;

          return {
            accessibleLabel,
            alt: element.getAttribute("alt") || "",
            className: getClassName(element),
            complete: typeof element.complete === "boolean" ? element.complete : true,
            label,
            naturalHeight: Number(element.naturalHeight || element.videoHeight || 0),
            naturalWidth: Number(element.naturalWidth || element.videoWidth || 0),
            rect: getSerializableRect(element),
            tagName
          };
        })
        .filter((item) => item.rect.width > 1 && item.rect.height > 1);

      const captionSelector = [
        ".dom-slide figcaption",
        ".dom-slide [data-caption]",
        ".dom-slide [data-source]",
        ".dom-slide .caption",
        ".dom-slide .source",
        ".dom-slide .credit",
        ".dom-slide .dom-caption",
        ".dom-slide .dom-source",
        ".dom-slide .dom-credit"
      ].join(", ");

      const captionItems = Array.from(document.querySelectorAll(captionSelector))
        .map((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            return null;
          }

          return {
            className: getClassName(element) || element.tagName.toLowerCase(),
            rect: getSerializableRect(element),
            tagName: element.tagName.toLowerCase(),
            text
          };
        })
        .filter(Boolean);

      const panelBoxes = Array.from(document.querySelectorAll(".dom-card, .dom-panel"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const textRects = Array.from(element.querySelectorAll("h1, h2, h3, p, span, strong"))
            .map((textElement) => {
              const text = (textElement.textContent || "").replace(/\s+/g, " ").trim();
              if (!text) {
                return null;
              }
              const textRect = textElement.getBoundingClientRect();
              return {
                bottom: textRect.bottom,
                left: textRect.left,
                right: textRect.right,
                top: textRect.top
              };
            })
            .filter(Boolean);

          return {
            className: element.className || "panel",
            rect: {
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              top: rect.top
            },
            textRects
          };
        });

      function getRect(selector) {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top
        };
      }

      function collectGroupGaps(selector, childSelector) {
        return Array.from(document.querySelectorAll(selector))
          .map((container) => {
            const children = Array.from(container.querySelectorAll(`:scope > ${childSelector}`))
              .map((child) => {
                const rect = child.getBoundingClientRect();
                return {
                  className: child.className || child.tagName.toLowerCase(),
                  rect: {
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top
                  }
                };
              });

            const gaps = [];

            for (let index = 1; index < children.length; index += 1) {
              const previous = children[index - 1].rect;
              const current = children[index].rect;
              const horizontalGap = current.left - previous.right;
              const verticalGap = current.top - previous.bottom;
              const gap = horizontalGap >= -1 ? horizontalGap : verticalGap;

              gaps.push({
                currentClassName: children[index].className,
                gap,
                previousClassName: children[index - 1].className
              });
            }

            return {
              className: container.className || selector,
              gaps
            };
          })
          .filter((entry) => entry.gaps.length);
      }

      const contentRects = [
        ".dom-slide__toc-body",
        ".dom-slide__content-columns",
        ".dom-slide__summary-columns"
      ]
        .map(getRect)
        .filter(Boolean);

      return {
        captionItems,
        contentRects,
        contentGroupGaps: [
          ...collectGroupGaps(".dom-slide__cover-cards", ".dom-card"),
          ...collectGroupGaps(".dom-slide__toc-cards", ".dom-card"),
          ...collectGroupGaps(".dom-slide__content-columns", ".dom-panel"),
          ...collectGroupGaps(".dom-slide__summary-columns", ".dom-bullet-list, .dom-panel"),
          ...collectGroupGaps(".dom-resource-list", ".dom-card")
        ],
        mediaItems,
        panelBoxes,
        progressRect: getRect(".dom-slide__badge"),
        sectionHeaderRect: getRect(".dom-slide__section-header"),
        slideRect: {
          bottom: slideRect.bottom,
          left: slideRect.left,
          right: slideRect.right,
          top: slideRect.top
        },
        textItems,
        wordCount: countWords(slide.textContent || "")
      };
    });
  };
}

function collectGeometryIssues(slideEntry, domData, validationOptions, validationSettings) {
  const issues = [];
  const slideRect = domData.slideRect ? normalizeRect(domData.slideRect) : null;
  if (!slideRect) {
    return issues;
  }
  const minContentGapIn = validationOptions.contentSpacing && validationOptions.contentSpacing.minGap
    ? validationOptions.contentSpacing.minGap
    : 0.18;
  const minContentGapPx = minContentGapIn * PX_PER_INCH;

  domData.textItems.forEach((item) => {
    const rect = normalizeRect(item.rect);
    const outside = (
      rect.left < slideRect.left - 1 ||
      rect.top < slideRect.top - 1 ||
      rect.right > slideRect.right + 1 ||
      rect.bottom > slideRect.bottom + 1
    );

    if (outside) {
      issues.push(createIssue(
        slideEntry.index,
        resolveValidationLevel("bounds", "error", validationSettings),
        "bounds",
        `Text block "${item.className}" exceeds the slide viewport`
      ));
    }
  });

  const minHorizontal = ((validationOptions.textPadding && validationOptions.textPadding.minHorizontal) || 0.08) * PX_PER_INCH;
  const minTop = ((validationOptions.textPadding && validationOptions.textPadding.minTop) || 0.08) * PX_PER_INCH;
  const minBottom = ((validationOptions.textPadding && validationOptions.textPadding.minBottom) || 0.05) * PX_PER_INCH;

  domData.panelBoxes.forEach((panel) => {
    if (!panel.textRects.length) {
      return;
    }

    const rect = normalizeRect(panel.rect);
    const leftInset = Math.min(...panel.textRects.map((textRect) => textRect.left - rect.left));
    const rightInset = Math.min(...panel.textRects.map((textRect) => rect.right - textRect.right));
    const topInset = Math.min(...panel.textRects.map((textRect) => textRect.top - rect.top));
    const bottomInset = Math.min(...panel.textRects.map((textRect) => rect.bottom - textRect.bottom));

    if (leftInset < minHorizontal || rightInset < minHorizontal || topInset < minTop || bottomInset < minBottom) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "text-padding",
        `Panel "${panel.className}" has tight text insets (${(leftInset / PX_PER_INCH).toFixed(2)}/${(topInset / PX_PER_INCH).toFixed(2)}/${(rightInset / PX_PER_INCH).toFixed(2)}/${(bottomInset / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }
  });

  const contentGroupGaps = Array.isArray(domData.contentGroupGaps) ? domData.contentGroupGaps : [];
  contentGroupGaps.forEach((group) => {
    group.gaps.forEach((entry) => {
      if (entry.gap < minContentGapPx - 2) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "content-gap-tight",
          `Content group "${group.className}" is tighter than the ${minContentGapIn.toFixed(2)}in minimum (${(entry.gap / PX_PER_INCH).toFixed(2)}in between "${entry.previousClassName}" and "${entry.currentClassName}")`,
          validationSettings
        ));
      }
    });
  });

  const sectionHeaderRect = domData.sectionHeaderRect ? normalizeRect(domData.sectionHeaderRect) : null;
  const progressRect = domData.progressRect ? normalizeRect(domData.progressRect) : null;
  const contentBox = Array.isArray(domData.contentRects)
    ? domData.contentRects.map(normalizeRect).reduce((current, rect) => unionRects(current, rect), null)
    : null;

  if (sectionHeaderRect && progressRect && contentBox) {
    const minGap = minContentGapPx;
    const ratioThreshold = 1.7;
    const differenceThreshold = 24;
    const topGap = contentBox.top - sectionHeaderRect.bottom;
    const bottomGap = progressRect.top - contentBox.bottom;

    if (topGap >= minGap && bottomGap >= minGap) {
      const largerGap = Math.max(topGap, bottomGap);
      const smallerGap = Math.max(Math.min(topGap, bottomGap), Number.EPSILON);
      const ratio = largerGap / smallerGap;
      const difference = Math.abs(topGap - bottomGap);

      if (ratio > ratioThreshold && difference > differenceThreshold) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "vertical-balance",
          `Content is vertically imbalanced (${(topGap / PX_PER_INCH).toFixed(2)}in below header vs ${(bottomGap / PX_PER_INCH).toFixed(2)}in above progress)`,
          validationSettings
        ));
      }
    }
  }

  return issues;
}

function collectTextIssues(slideEntry, domData, validationOptions, validationSettings) {
  const issues = [];
  const minFontSizePt = validationOptions.minimumFontSize && validationOptions.minimumFontSize.minFontSizePt
    ? validationOptions.minimumFontSize.minFontSizePt
    : 10;
  const maxWordsPerSlide = validationOptions.slideWordCount && validationOptions.slideWordCount.maxWordsPerSlide
    ? validationOptions.slideWordCount.maxWordsPerSlide
    : 80;

  domData.textItems.forEach((item) => {
    const className = String(item.className || "");
    const parentClassName = String(item.parentClassName || "");
    const isMicrocopy = (
      /eyebrow|badge-label/.test(className) ||
      /eyebrow|badge/.test(parentClassName) ||
      parentClassName.includes("dom-signal__meta")
    );

    if (isMicrocopy) {
      return;
    }

    const fontSizePt = item.fontSizePx * PT_PER_PX;
    if (fontSizePt < minFontSizePt) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "font-size-small",
        `Text block "${item.className}" uses ${fontSizePt.toFixed(1)}pt text below the ${minFontSizePt.toFixed(1)}pt minimum`,
        validationSettings
      ));
    }

    const ratio = contrastRatio(item.color, item.backgroundColor);
    if (ratio < 2.5) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "error",
        "contrast-low",
        `Text block "${item.className}" has low contrast (${ratio.toFixed(2)}:1)`,
        validationSettings
      ));
    } else if (ratio < 3) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "contrast-tight",
        `Text block "${item.className}" is close to the contrast threshold (${ratio.toFixed(2)}:1)`,
        validationSettings
      ));
    }
  });

  if (domData.wordCount > maxWordsPerSlide) {
    issues.push(createConfiguredIssue(
      slideEntry.index,
      "warn",
      "slide-word-count",
      `Slide carries ${domData.wordCount} visible words above the ${maxWordsPerSlide}-word maximum`,
      validationSettings
    ));
  }

  return issues;
}

function collectMediaIssues(slideEntry, domData, validationOptions, validationSettings) {
  const mode = validationSettings && validationSettings.mediaValidationMode === "complete"
    ? "complete"
    : "fast";

  if (mode === "fast") {
    return [];
  }

  const issues = [];
  const mediaItems = Array.isArray(domData.mediaItems) ? domData.mediaItems : [];
  const captionItems = Array.isArray(domData.captionItems) ? domData.captionItems : [];
  const minCaptionGapIn = validationOptions.captionSpacing && validationOptions.captionSpacing.minGap
    ? validationOptions.captionSpacing.minGap
    : 0.1;
  const minCaptionGapPx = minCaptionGapIn * PX_PER_INCH;

  mediaItems.forEach((item) => {
    const rect = normalizeRect(item.rect);
    const descriptor = describeDomNode(item);
    const shortEdge = Math.min(rect.width, rect.height);
    const area = rect.width * rect.height;
    const isRaster = item.tagName === "img" || item.tagName === "video";

    if (shortEdge < 96 || area < 180 * 120) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" renders small enough to risk legibility (${(rect.width / PX_PER_INCH).toFixed(2)}in x ${(rect.height / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }

    if (isRaster && item.complete === false) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" did not finish loading before validation`,
        validationSettings
      ));
    }

    if (item.tagName === "img" && (!item.naturalWidth || !item.naturalHeight)) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Image "${descriptor}" has no readable native dimensions`,
        validationSettings
      ));
    }

    if (isRaster && item.naturalWidth && item.naturalHeight) {
      const widthScale = rect.width / item.naturalWidth;
      const heightScale = rect.height / item.naturalHeight;
      const maxScale = Math.max(widthScale, heightScale);
      const naturalRatio = item.naturalWidth / item.naturalHeight;
      const renderedRatio = rect.width / rect.height;
      const ratioDelta = Math.abs(renderedRatio - naturalRatio) / naturalRatio;

      if (maxScale > 1.15) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "media-legibility",
          `Media "${descriptor}" is scaled above native resolution (${maxScale.toFixed(2)}x)`,
          validationSettings
        ));
      }

      if (ratioDelta > 0.08) {
        issues.push(createConfiguredIssue(
          slideEntry.index,
          "warn",
          "media-legibility",
          `Media "${descriptor}" distorts its native aspect ratio (${naturalRatio.toFixed(2)} native vs ${renderedRatio.toFixed(2)} rendered)`,
          validationSettings
        ));
      }
    }

    const needsReadableLabel = item.tagName === "img" ||
      item.tagName === "svg" ||
      /\b(dom-screenshot|dom-diagram|dom-media)\b/.test(String(item.className || ""));
    if (needsReadableLabel && !String(item.accessibleLabel || "").trim()) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "media-legibility",
        `Media "${descriptor}" is missing a readable alt or aria label`,
        validationSettings
      ));
    }
  });

  if (!mediaItems.length) {
    return issues;
  }

  captionItems.forEach((caption) => {
    const nearest = findNearestMedia(caption, mediaItems);
    if (!nearest) {
      return;
    }

    if (nearest.distance < minCaptionGapPx) {
      issues.push(createConfiguredIssue(
        slideEntry.index,
        "warn",
        "caption-source-spacing",
        `Caption/source "${describeDomNode(caption, "caption")}" is closer than ${minCaptionGapIn.toFixed(2)}in to media "${describeDomNode(nearest.media)}" (${(nearest.distance / PX_PER_INCH).toFixed(2)}in)`,
        validationSettings
      ));
    }
  });

  return issues;
}

async function validateDeckInDom() {
  const previewState = getDomPreviewState();
  const validationOptions = getValidationConstraintOptions(readDesignConstraints());
  const validationSettings = readValidationSettings();
  const geometryIssues = [];
  const mediaIssues = [];
  const textIssues = [];

  await withBrowser(async (browser) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });

    for (const slideEntry of previewState.slides) {
      if (!slideEntry || !slideEntry.slideSpec) {
        continue;
      }

      const domData = await evaluateSlideInDom(slideEntry, previewState)(page);
      geometryIssues.push(...collectGeometryIssues(slideEntry, domData, validationOptions, validationSettings));
      mediaIssues.push(...collectMediaIssues(slideEntry, domData, validationOptions, validationSettings));
      textIssues.push(...collectTextIssues(slideEntry, domData, validationOptions, validationSettings));
    }

    await page.close();
  });

  return {
    geometry: summarizeIssues(geometryIssues.concat(mediaIssues)),
    text: summarizeIssues(textIssues)
  };
}

module.exports = {
  _test: {
    collectMediaIssues
  },
  validateDeckInDom
};
