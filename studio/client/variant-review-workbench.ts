namespace StudioClientVariantReviewWorkbench {
  export function createVariantReviewWorkbench(deps) {
    const {
      createDomElement,
      customLayoutWorkbench,
      elements,
      escapeHtml,
      formatSourceCode,
      getSlideSpecPathValue,
      getVariantVisualTheme,
      hashFieldValue,
      loadSlide,
      parseSlideSpecEditor,
      pathToString,
      renderPreviews,
      request,
      setBusy,
      setDomPreviewState,
      state,
      validate,
      windowRef,
      workflowRunners
    } = deps;

    function getSlideVariants() {
      return [
        ...state.transientVariants.filter((variant) => variant.slideId === state.selectedSlideId),
        ...state.variants.filter((variant) => variant.slideId === state.selectedSlideId)
      ];
    }

    function getSelectedVariant() {
      const variants = getSlideVariants();
      if (!variants.length) {
        state.selectedVariantId = null;
        return null;
      }

      if (!variants.some((variant) => variant.id === state.selectedVariantId)) {
        state.selectedVariantId = null;
      }

      return variants.find((variant) => variant.id === state.selectedVariantId) || null;
    }

    function clearTransientVariants(slideId) {
      state.transientVariants = state.transientVariants.filter((variant) => variant.slideId !== slideId);
    }

    function replacePersistedVariantsForSlide(slideId, variants) {
      state.variants = [
        ...state.variants.filter((variant) => variant.slideId !== slideId),
        ...(Array.isArray(variants) ? variants : [])
      ];
    }

    function openGenerationControls() {
      const details = windowRef.document.querySelector(".variant-generation-details") as HTMLDetailsElement | null;
      if (details) {
        details.open = true;
      }
    }

    function summarizeDiff(currentSource, variantSource) {
      const currentLines = currentSource.split("\n");
      const variantLines = variantSource.split("\n");
      const maxLines = Math.max(currentLines.length, variantLines.length);
      let added = 0;
      let changed = 0;
      const highlights = [];
      let removed = 0;

      for (let index = 0; index < maxLines; index += 1) {
        const before = currentLines[index];
        const after = variantLines[index];

        if (before === after) {
          continue;
        }

        if (before === undefined) {
          added += 1;
        } else if (after === undefined) {
          removed += 1;
        } else {
          changed += 1;
        }

        if (highlights.length < 4) {
          highlights.push({
            after: after ? after.trim() : "(removed)",
            before: before ? before.trim() : "(no line)",
            line: index + 1
          });
        }
      }

      return {
        added,
        changed,
        highlights,
        removed
      };
    }

    function normalizeCompareValue(value) {
      if (typeof value === "string") {
        return value.replace(/\s+/g, " ").trim();
      }

      if (typeof value === "number") {
        return String(value);
      }

      if (value === null || value === undefined) {
        return "";
      }

      return JSON.stringify(value);
    }

    function formatCompareValue(value) {
      const normalized = normalizeCompareValue(value);
      return normalized || "(empty)";
    }

    function formatStructuredGroupLabel(group) {
      return ({
        bullets: "Bullets",
        cards: "Cards",
        framing: "Framing",
        guardrails: "Guardrails",
        resources: "Resources",
        signals: "Signals"
      })[group] || group;
    }

    function buildStructuredComparison(currentSpec, variantSpec) {
      if (!currentSpec || !variantSpec) {
        return null;
      }

      const changes = [];
      const groups = new Set();

      const pushChange = (group, label, before, after) => {
        const normalizedBefore = normalizeCompareValue(before);
        const normalizedAfter = normalizeCompareValue(after);

        if (normalizedBefore === normalizedAfter) {
          return;
        }

        groups.add(group);
        changes.push({
          after: formatCompareValue(after),
          before: formatCompareValue(before),
          group,
          label
        });
      };

      if (currentSpec.type !== variantSpec.type) {
        pushChange("family", "Slide family", currentSpec.type, variantSpec.type);

        return {
          changes,
          groupDetails: [
            {
              changes,
              group: "family",
              label: "Slide family"
            }
          ],
          groups: ["family"],
          summaryLines: [
            `Changed slide family from ${currentSpec.type} to ${variantSpec.type}.`,
            "Review dropped or transformed fields in the JSON diff before applying."
          ],
          totalChanges: changes.length
        };
      }

      pushChange("framing", "Title", currentSpec.title, variantSpec.title);
      if (currentSpec.type !== "divider") {
        pushChange("framing", "Eyebrow", currentSpec.eyebrow, variantSpec.eyebrow);
        pushChange("framing", "Summary", currentSpec.summary, variantSpec.summary);
      }

      switch (currentSpec.type) {
        case "divider":
          break;
        case "cover":
        case "toc":
          pushChange("framing", "Note", currentSpec.note, variantSpec.note);
          currentSpec.cards.forEach((card, index) => {
            const nextCard = variantSpec.cards[index] || {};
            pushChange("cards", `Card ${index + 1} title`, card.title, nextCard.title);
            pushChange("cards", `Card ${index + 1} body`, card.body, nextCard.body);
          });
          break;
        case "content":
          pushChange("signals", "Signals title", currentSpec.signalsTitle, variantSpec.signalsTitle);
          (currentSpec.signals || []).forEach((signal, index) => {
            const nextSignal = (variantSpec.signals || [])[index] || {};
            pushChange("signals", `Signal ${index + 1} title`, signal.title || signal.label, nextSignal.title || nextSignal.label);
            pushChange("signals", `Signal ${index + 1} body`, signal.body || signal.value, nextSignal.body || nextSignal.value);
          });
          pushChange("guardrails", "Guardrails title", currentSpec.guardrailsTitle, variantSpec.guardrailsTitle);
          (currentSpec.guardrails || []).forEach((guardrail, index) => {
            const nextGuardrail = (variantSpec.guardrails || [])[index] || {};
            pushChange("guardrails", `Guardrail ${index + 1} title`, guardrail.title || guardrail.label, nextGuardrail.title || nextGuardrail.label);
            pushChange("guardrails", `Guardrail ${index + 1} body`, guardrail.body || guardrail.value, nextGuardrail.body || nextGuardrail.value);
          });
          break;
        case "summary":
          pushChange("resources", "Resources title", currentSpec.resourcesTitle, variantSpec.resourcesTitle);
          currentSpec.bullets.forEach((bullet, index) => {
            const nextBullet = variantSpec.bullets[index] || {};
            pushChange("bullets", `Bullet ${index + 1} title`, bullet.title, nextBullet.title);
            pushChange("bullets", `Bullet ${index + 1} body`, bullet.body, nextBullet.body);
          });
          currentSpec.resources.forEach((resource, index) => {
            const nextResource = variantSpec.resources[index] || {};
            pushChange("resources", `Resource ${index + 1} title`, resource.title, nextResource.title);
            pushChange("resources", `Resource ${index + 1} body`, resource.body, nextResource.body);
          });
          break;
        default:
          return null;
      }

      if (!changes.length) {
        return {
          changes: [],
          groups: [],
          summaryLines: ["No structured field changes detected."],
          totalChanges: 0
        };
      }

      const orderedGroups = Array.from(groups);
      const groupLabels = orderedGroups.map((group) => formatStructuredGroupLabel(group)).join(", ");
      const groupDetails = orderedGroups.map((group) => ({
        changes: changes.filter((change) => change.group === group),
        group,
        label: formatStructuredGroupLabel(group)
      }));

      return {
        changes,
        groupDetails,
        groups: orderedGroups,
        summaryLines: [
          `Changed ${changes.length} structured field${changes.length === 1 ? "" : "s"} across ${orderedGroups.length} content area${orderedGroups.length === 1 ? "" : "s"}.`,
          `Areas touched: ${groupLabels}.`
        ],
        totalChanges: changes.length
      };
    }

    function collectSlideTextParts(spec) {
      if (!spec || typeof spec !== "object") {
        return [];
      }

      const parts = [
        spec.eyebrow,
        spec.title,
        spec.summary,
        spec.note,
        spec.signalsTitle,
        spec.guardrailsTitle,
        spec.resourcesTitle
      ];

      ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
        if (!Array.isArray(spec[field])) {
          return;
        }

        spec[field].forEach((item) => {
          if (!item || typeof item !== "object") {
            return;
          }

          parts.push(item.title, item.body, item.label, item.value);
        });
      });

      return parts
        .filter((part) => typeof part === "string")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    function countSlideWords(spec) {
      const text = collectSlideTextParts(spec).join(" ").trim();
      return text ? text.split(/\s+/).length : 0;
    }

    function buildVariantDecisionSupport(currentSpec, variantSpec, structuredComparison, diff) {
      const fieldChanges = structuredComparison
        ? structuredComparison.totalChanges
        : diff.changed + diff.added + diff.removed;
      const groupDetails = structuredComparison && Array.isArray(structuredComparison.groupDetails)
        ? structuredComparison.groupDetails
        : [];
      const contentAreas = groupDetails.length;
      const canCompareWords = Boolean(currentSpec && variantSpec);
      const currentWords = canCompareWords ? countSlideWords(currentSpec) : 0;
      const variantWords = canCompareWords ? countSlideWords(variantSpec) : 0;
      const wordDelta = canCompareWords ? variantWords - currentWords : null;
      const absoluteWordDelta = wordDelta === null ? 0 : Math.abs(wordDelta);
      const titleChanged = structuredComparison
        ? structuredComparison.changes.some((change) => change.label === "Title")
        : false;
      const scale = fieldChanges >= 12 || contentAreas >= 4 || absoluteWordDelta >= 24
        ? "Large"
        : fieldChanges >= 5 || contentAreas >= 2 || absoluteWordDelta >= 10
          ? "Medium"
          : "Small";
      const focusItems = groupDetails.length
        ? groupDetails.map((group) => ({
          label: group.label,
          value: `${group.changes.length} change${group.changes.length === 1 ? "" : "s"}`
        }))
        : diff.highlights.map((highlight) => ({
          label: `Line ${highlight.line}`,
          value: "source change"
        }));
      const cues = [];

      if (scale === "Large") {
        cues.push("Review the full preview and affected areas before applying.");
      } else if (scale === "Medium") {
        cues.push("Check changed areas and text fit before applying.");
      } else {
        cues.push("Preview check is likely enough for this small change.");
      }

      if (titleChanged) {
        cues.push("Headline changed; confirm it still matches the deck narrative.");
      }

      if (wordDelta !== null && wordDelta >= 10) {
        cues.push("Candidate adds visible text; check wrapping and slide density.");
      } else if (wordDelta !== null && wordDelta <= -10) {
        cues.push("Candidate removes visible text; check whether key claims remain.");
      }

      if (contentAreas >= 3) {
        cues.push("Several content areas move together; compare the visual hierarchy.");
      }

      if (structuredComparison && structuredComparison.groups.includes("family")) {
        cues.push("Slide family changes can drop incompatible fields; inspect the JSON diff before applying.");
      }

      return {
        contentAreas,
        cues,
        fieldChanges,
        focusItems,
        scale,
        wordDelta
      };
    }

    function renderVariantDecisionSupport(decisionSupport) {
      const formattedDelta = decisionSupport.wordDelta === null
        ? "n/a"
        : decisionSupport.wordDelta > 0
          ? `+${decisionSupport.wordDelta}`
          : String(decisionSupport.wordDelta);
      const focusItems = decisionSupport.focusItems.slice(0, 5);

      return `
        <section class="compare-decision-panel">
          <div class="compare-decision-head">
            <div>
              <p class="eyebrow">Decision support</p>
              <strong>${escapeHtml(decisionSupport.scale)} candidate change</strong>
            </div>
            <div class="compare-decision-metrics">
              <span><strong>${decisionSupport.fieldChanges}</strong> field${decisionSupport.fieldChanges === 1 ? "" : "s"}</span>
              <span><strong>${decisionSupport.contentAreas}</strong> area${decisionSupport.contentAreas === 1 ? "" : "s"}</span>
              <span><strong>${escapeHtml(formattedDelta)}</strong> words</span>
            </div>
          </div>
          ${focusItems.length ? `
            <div class="compare-decision-focus" aria-label="Review focus">
              ${focusItems.map((item) => `
                <span class="compare-decision-chip">
                  <strong>${escapeHtml(item.label)}</strong>
                  ${escapeHtml(item.value)}
                </span>
              `).join("")}
            </div>
          ` : ""}
          <div class="compare-decision-cues">
            ${decisionSupport.cues.map((cue) => `<p>${escapeHtml(cue)}</p>`).join("")}
          </div>
        </section>
      `;
    }

    function buildSourceDiffRows(currentSource, variantSource) {
      const beforeLines = currentSource.split("\n");
      const afterLines = variantSource.split("\n");
      const maxLines = Math.max(beforeLines.length, afterLines.length);
      const rows = [];

      for (let index = 0; index < maxLines; index += 1) {
        const before = beforeLines[index];
        const after = afterLines[index];
        const changed = before !== after;

        rows.push({
          after: after === undefined ? "" : after,
          before: before === undefined ? "" : before,
          changed,
          line: index + 1
        });
      }

      return rows;
    }

    function serializeJsonValue(value) {
      return JSON.stringify(value, null, 2);
    }

    function getCurrentComparisonSource() {
      if (state.selectedSlideStructured && state.selectedSlideSpec) {
        return serializeJsonValue(state.selectedSlideSpec);
      }

      return state.selectedSlideSource || "";
    }

    function getVariantComparisonSource(variant) {
      if (variant && variant.slideSpec) {
        return serializeJsonValue(variant.slideSpec);
      }

      return variant && variant.source ? variant.source : "";
    }

    function synchronizeCompareSourceScroll() {
      const panes = Array.from(elements.compareSourceGrid.querySelectorAll(".source-lines"));
      if (panes.length !== 2) {
        return;
      }

      let syncing = false;

      const syncPane = (source, target) => {
        source.addEventListener("scroll", () => {
          if (syncing) {
            return;
          }

          syncing = true;
          target.scrollTop = source.scrollTop;
          target.scrollLeft = source.scrollLeft;
          syncing = false;
        });
      };

      syncPane(panes[0], panes[1]);
      syncPane(panes[1], panes[0]);
    }

    function canSaveVariantLayout(variant) {
      return variant
        && (variant.operation === "redo-layout" || variant.operation === "custom-layout")
        && variant.slideSpec
        && variant.slideSpec.type
        && (variant.slideSpec.layout || variant.layoutDefinition);
    }

    function canSaveVariantLayoutAsFavorite(variant) {
      return canSaveVariantLayout(variant)
        && (variant.operation !== "custom-layout" || (variant.layoutPreview && variant.layoutPreview.mode === "multi-slide"));
    }

    function describeVariantKind(variant) {
      if (variant.operationScope && variant.operationScope.scopeLabel) {
        return `${variant.persisted === false ? "Session " : ""}${variant.operationScope.scopeLabel}`;
      }

      if (variant.kind !== "generated") {
        return "Snapshot";
      }

      const prefix = variant.persisted === false ? "Session " : "";

      if (variant.operation === "drill-wording") {
        return `${prefix}wording pass`;
      }

      if (variant.operation === "ideate-theme") {
        return `${prefix}theme pass`;
      }

      if (variant.operation === "ideate-structure") {
        return `${prefix}content rewrite`;
      }

      if (variant.operation === "redo-layout") {
        return `${prefix}layout pass`;
      }

      if (variant.operation === "custom-layout") {
        return `${prefix}custom layout`;
      }

      if (variant.generator === "llm") {
        return `${prefix}LLM ideate`;
      }

      return `${prefix}local ideate`;
    }

    function getVariantSelectionEntries(variant) {
      const scope = variant && variant.operationScope;
      if (!scope) {
        return [];
      }

      return scope.kind === "selectionGroup" && Array.isArray(scope.selections)
        ? scope.selections
        : [scope];
    }

    function getVariantSelectionStaleReason(variant) {
      const entries = getVariantSelectionEntries(variant);
      if (!entries.length || !state.selectedSlideSpec) {
        return "";
      }

      const stale = entries.find((entry) => {
        const currentValue = getSlideSpecPathValue(state.selectedSlideSpec, entry.fieldPath || entry.path);
        return currentValue === undefined || (entry.fieldHash && hashFieldValue(currentValue) !== entry.fieldHash);
      });

      return stale
        ? `Selection target changed: ${pathToString(stale.fieldPath || stale.path)}. Regenerate or rebase before applying.`
        : "";
    }

    function renderFlow() {
      if (!elements.variantFlow) {
        return;
      }

      const variants = getSlideVariants();
      const selectedVariant = variants.find((variant) => variant.id === state.selectedVariantId) || null;
      const workflow = state.runtime && state.runtime.workflow;
      const workflowRunning = workflow && workflow.status === "running";
      const currentStep = workflowRunning
        ? "generate"
        : !variants.length
          ? "generate"
          : selectedVariant
            ? "preview"
            : "select";
      const order = ["generate", "select", "preview", "apply"];
      const currentIndex = order.indexOf(currentStep);

      Array.from(elements.variantFlow.querySelectorAll("[data-step]")).forEach((step: any) => {
        const index = order.indexOf(step.dataset.step);
        const stepState = index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "pending";
        step.dataset.state = stepState;
      });
    }

    function render() {
      const variants = getSlideVariants();
      const savedCount = variants.filter((variant) => variant.persisted !== false).length;
      const sessionCount = variants.length - savedCount;
      const reviewOpen = Boolean(state.ui.variantReviewOpen && variants.length);
      elements.variantList.innerHTML = "";
      elements.variantStorageNote.textContent = savedCount > 0
        ? `${sessionCount} session-only candidate${sessionCount === 1 ? "" : "s"} and ${savedCount} saved snapshot${savedCount === 1 ? "" : "s"} are available for this slide.`
        : variants.length
          ? `${variants.length} session-only candidate${variants.length === 1 ? "" : "s"} available for this slide.`
          : "Generated candidates stay in the current session until one is applied.";

      if (!reviewOpen) {
        elements.variantReviewWorkspace.classList.add("is-empty");
        elements.workflowCompare.hidden = true;
        elements.variantList.innerHTML = "<div class=\"variant-card variant-empty-state\"><strong>No candidates yet</strong><span>Choose a count, then run a variant action to create session-only options.</span></div>";
        renderFlow();
        renderComparison();
        return;
      }

      elements.variantReviewWorkspace.classList.remove("is-empty");
      elements.workflowCompare.hidden = false;

      const selectVariantForComparison = (variant) => {
        state.selectedVariantId = variant ? variant.id : null;
        elements.operationStatus.textContent = variant
          ? `Previewing ${variant.label} in the main slide area.`
          : "Previewing the original slide.";
        renderPreviews();
        render();
      };

      const renderOriginalCard = () => {
        const selectedTitle = state.selectedSlideSpec && state.selectedSlideSpec.title || "Current slide";
        const selected = !getSelectedVariant();
        const previewButton = createDomElement("button", {
          className: "secondary",
          dataset: { action: "preview" },
          text: selected ? "Previewing" : "Preview",
          attributes: { type: "button" }
        });
        const card = createDomElement("div", {
          className: `variant-card variant-original-card${selected ? " active" : ""}`,
          attributes: {
            "aria-current": selected ? "true" : "false",
            "aria-label": "Preview original slide"
          }
        }, [
          createDomElement("div", { className: "variant-select-line" }, [
            createDomElement("span", {
              className: "variant-select-mark",
              attributes: { "aria-hidden": "true" }
            }),
            createDomElement("p", { className: "variant-kind", text: "Original" })
          ]),
          createDomElement("strong", { text: selectedTitle }),
          createDomElement("span", { className: "variant-meta", text: "Saved slide" }),
          createDomElement("span", { text: "The current saved slide before applying any candidate." }),
          createDomElement("div", { className: "variant-actions" }, [previewButton])
        ]);
        card.tabIndex = 0;
        const previewOriginal = () => selectVariantForComparison(null);
        card.addEventListener("click", (event) => {
          if ((event.target as any).closest("button")) {
            return;
          }
          previewOriginal();
        });
        card.addEventListener("keydown", (event) => {
          if ((event.target as any).closest("button")) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            previewOriginal();
          }
        });
        previewButton.addEventListener("click", previewOriginal);
        elements.variantList.appendChild(card);
      };

      renderOriginalCard();

      variants.forEach((variant) => {
        const selected = variant.id === state.selectedVariantId;
        const kindLabel = describeVariantKind(variant);
        const summary = variant.promptSummary || variant.notes || "No notes";
        const actions = [
          createDomElement("button", {
            className: "secondary",
            dataset: { action: "compare" },
            text: selected ? "Previewing" : "Preview",
            attributes: { type: "button" }
          })
        ];
        if (canSaveVariantLayout(variant)) {
          actions.push(createDomElement("button", {
            className: "secondary",
            dataset: { action: "save-layout" },
            text: "Save layout",
            attributes: { type: "button" }
          }));
          const canSaveFavorite = canSaveVariantLayoutAsFavorite(variant);
          const favoriteAttributes: any = { type: "button" };
          if (!canSaveFavorite) {
            favoriteAttributes.title = "Run a favorite-ready preview first";
          }
          actions.push(createDomElement("button", {
            className: "secondary",
            dataset: { action: "save-favorite-layout" },
            disabled: !canSaveFavorite,
            text: "Save favorite",
            attributes: favoriteAttributes
          }));
        }
        actions.push(createDomElement("button", {
          dataset: { action: "apply" },
          text: "Apply variant",
          attributes: { type: "button" }
        }));

        const card = createDomElement("div", {
          className: `variant-card${selected ? " active" : ""}`,
          attributes: {
            "aria-current": selected ? "true" : "false",
            "aria-label": `Preview ${variant.label}`
          }
        }, [
          createDomElement("div", { className: "variant-select-line" }, [
            createDomElement("span", {
              className: "variant-select-mark",
              attributes: { "aria-hidden": "true" }
            }),
            createDomElement("p", { className: "variant-kind", text: kindLabel })
          ]),
          createDomElement("strong", { text: variant.label }),
          createDomElement("span", { className: "variant-meta", text: new Date(variant.createdAt).toLocaleString() }),
          createDomElement("span", { text: summary }),
          createDomElement("div", { className: "variant-actions" }, actions)
        ]);
        card.tabIndex = 0;

        card.addEventListener("click", (event) => {
          if ((event.target as any).closest("button")) {
            return;
          }

          selectVariantForComparison(variant);
        });

        card.addEventListener("keydown", (event) => {
          if ((event.target as any).closest("button")) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectVariantForComparison(variant);
          }
        });

        card.querySelector("[data-action=\"compare\"]").addEventListener("click", () => {
          selectVariantForComparison(variant);
        });

        const saveLayoutButton = card.querySelector("[data-action=\"save-layout\"]");
        if (saveLayoutButton) {
          saveLayoutButton.addEventListener("click", () => saveVariantLayout(variant, false, saveLayoutButton).catch((error) => windowRef.alert(error.message)));
        }

        const saveFavoriteLayoutButton = card.querySelector("[data-action=\"save-favorite-layout\"]");
        if (saveFavoriteLayoutButton) {
          saveFavoriteLayoutButton.addEventListener("click", () => saveVariantLayout(variant, true, saveFavoriteLayoutButton).catch((error) => windowRef.alert(error.message)));
        }

        const applyButton = card.querySelector("[data-action=\"apply\"]");
        applyButton.addEventListener("click", async () => {
          const done = setBusy(applyButton, "Applying...");
          try {
            await applyVariantById(variant.id, {
              label: variant.label,
              validateAfter: false
            });
          } catch (error) {
            windowRef.alert(error.message);
          } finally {
            done();
          }
        });

        elements.variantList.appendChild(card);
      });

      renderFlow();
      renderComparison();
    }

    function renderComparison() {
      const variant = getSelectedVariant();
      if (!variant) {
        elements.compareEmpty.hidden = false;
        elements.compareSummary.hidden = true;
        elements.compareApplyButton.disabled = true;
        elements.compareApplyValidateButton.disabled = true;
        return;
      }

      const currentComparisonSource = getCurrentComparisonSource();
      const variantComparisonSource = getVariantComparisonSource(variant);
      const variantVisualTheme = getVariantVisualTheme(variant);
      const diff = summarizeDiff(currentComparisonSource, variantComparisonSource);
      const sourceRows = buildSourceDiffRows(currentComparisonSource, variantComparisonSource);
      const structuredComparison = state.selectedSlideStructured && variant.slideSpec
        ? buildStructuredComparison(state.selectedSlideSpec, variant.slideSpec)
        : null;
      const decisionSupport = buildVariantDecisionSupport(
        state.selectedSlideSpec,
        variant.slideSpec,
        structuredComparison,
        diff
      );
      const beforeSourceFormat = state.selectedSlideStructured ? "json" : "plain";
      const afterSourceFormat = variant.slideSpec ? "json" : "plain";
      const compareSummaryItems = Array.isArray(variant.changeSummary) && variant.changeSummary.length
        ? variant.changeSummary.slice()
        : [variant.promptSummary || variant.notes || "No change summary available."];
      const staleSelectionReason = getVariantSelectionStaleReason(variant);

      if (staleSelectionReason) {
        compareSummaryItems.unshift(staleSelectionReason);
      }

      if (structuredComparison && structuredComparison.summaryLines.length) {
        compareSummaryItems.push(...structuredComparison.summaryLines);
      }

      if (variant.layoutDefinition) {
        const slots = Array.isArray(variant.layoutDefinition.slots) ? variant.layoutDefinition.slots.length : 0;
        const regions = Array.isArray(variant.layoutDefinition.regions) ? variant.layoutDefinition.regions.length : 0;
        compareSummaryItems.push(`Layout definition: ${variant.layoutDefinition.type || "generated"}${slots || regions ? ` with ${slots} slots and ${regions} regions` : ""}.`);
      }
      if (variant.layoutPreview && variant.layoutPreview.mode) {
        compareSummaryItems.push(`Preview state: ${variant.layoutPreview.mode === "multi-slide" ? "favorite-ready multi-slide" : "current slide"}.`);
      }

      elements.compareEmpty.hidden = true;
      elements.compareSummary.hidden = false;

      elements.compareStats.innerHTML = [
        `<span class="compare-stat"><strong>${variant.persisted === false ? "session-only" : "saved"}</strong> variant mode</span>`,
        `<span class="compare-stat"><strong>${escapeHtml(variant.generator || "manual")}</strong> generator</span>`,
        structuredComparison
          ? `<span class="compare-stat"><strong>${structuredComparison.totalChanges}</strong> structured changes</span>`
          : "",
        structuredComparison
          ? `<span class="compare-stat"><strong>${structuredComparison.groups.length}</strong> content areas</span>`
          : "",
        variantVisualTheme
          ? `<span class="compare-stat"><strong>visual</strong> theme</span>`
          : "",
        variant.layoutDefinition
          ? `<span class="compare-stat"><strong>${escapeHtml(variant.layoutDefinition.type || "layout")}</strong> definition</span>`
          : "",
        variant.layoutPreview && variant.layoutPreview.state
          ? `<span class="compare-stat"><strong>${escapeHtml(variant.layoutPreview.state)}</strong> preview</span>`
          : "",
        variant.operationScope && variant.operationScope.scopeLabel
          ? `<span class="compare-stat"><strong>${escapeHtml(variant.operationScope.scopeLabel)}</strong> scope</span>`
          : "",
        variant.operationScope && variant.operationScope.allowFamilyChange
          ? `<span class="compare-stat"><strong>family</strong> change</span>`
          : "",
        `<span class="compare-stat"><strong>${diff.changed}</strong> changed lines</span>`,
        `<span class="compare-stat"><strong>${diff.added}</strong> added lines</span>`,
        `<span class="compare-stat"><strong>${diff.removed}</strong> removed lines</span>`
      ].filter(Boolean).join("");
      elements.compareChangeSummary.innerHTML = compareSummaryItems
        .map((item) => `<p class="compare-summary-item">${escapeHtml(item)}</p>`)
        .join("");
      elements.compareDecisionSupport.innerHTML = renderVariantDecisionSupport(decisionSupport);
      elements.compareSourceGrid.innerHTML = `
        <div class="source-pane">
          <p class="eyebrow">${state.selectedSlideStructured ? "Current JSON" : "Before"}</p>
          <div class="source-lines">
            ${sourceRows.map((row) => `
              <div class="source-line${row.changed ? " changed" : ""}">
                <span class="source-line-no">${row.line}</span>
                <code>${formatSourceCode(row.before, beforeSourceFormat)}</code>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="source-pane">
          <p class="eyebrow">${variant.slideSpec ? "Candidate JSON" : "After"}</p>
          <div class="source-lines">
            ${sourceRows.map((row) => `
              <div class="source-line${row.changed ? " changed" : ""}">
                <span class="source-line-no">${row.line}</span>
                <code>${formatSourceCode(row.after, afterSourceFormat)}</code>
              </div>
            `).join("")}
          </div>
        </div>
      `;
      synchronizeCompareSourceScroll();
      elements.compareHighlights.innerHTML = structuredComparison && Array.isArray(structuredComparison.groupDetails) && structuredComparison.groupDetails.length
        ? structuredComparison.groupDetails.map((group) => `
          <section class="compare-group">
            <div class="compare-group-head">
              <strong>${escapeHtml(group.label)}</strong>
              <span>${group.changes.length} change${group.changes.length === 1 ? "" : "s"}</span>
            </div>
            <div class="compare-group-items">
              ${group.changes.map((highlight) => `
                <div class="compare-highlight">
                  <strong>${escapeHtml(highlight.label)}</strong>
                  <span>Before: ${escapeHtml(highlight.before)}</span>
                  <span>After: ${escapeHtml(highlight.after)}</span>
                </div>
              `).join("")}
            </div>
          </section>
        `).join("")
        : diff.highlights.length
          ? diff.highlights.map((highlight) => `
          <div class="compare-highlight">
            <strong>Line ${highlight.line}</strong>
            <span>${escapeHtml(highlight.before)}</span>
            <span>${escapeHtml(highlight.after)}</span>
          </div>
        `).join("")
        : "<p class=\"compare-empty-copy\">No source changes detected.</p>";
      elements.compareApplyButton.disabled = Boolean(staleSelectionReason);
      elements.compareApplyValidateButton.disabled = Boolean(staleSelectionReason);
      renderFlow();
    }

    async function saveVariantLayout(variant, favorite = false, button = null) {
      if (!canSaveVariantLayout(variant)) {
        return;
      }

      const label = variant.label || `${variant.slideSpec.layout} layout`;
      const layoutName = label
        .replace(/^Use (deck|favorite) layout:\s*/i, "")
        .replace(/\s+candidate$/i, "");
      const done = button ? setBusy(button, favorite ? "Saving favorite..." : "Saving...") : () => {};
      try {
        const payload = await request("/api/layouts/candidates/save", {
          body: JSON.stringify({
            description: variant.notes || variant.promptSummary || "",
            favorite,
            layoutDefinition: variant.layoutDefinition || null,
            layoutPreview: variant.layoutPreview || null,
            name: layoutName,
            operation: variant.operation || null,
            slideSpec: variant.slideSpec
          }),
          method: "POST"
        });
        state.layouts = payload.layouts || state.layouts;
        state.favoriteLayouts = payload.favoriteLayouts || state.favoriteLayouts;
        customLayoutWorkbench.renderLibrary();
        elements.operationStatus.textContent = favorite
          ? `Saved favorite layout ${payload.favoriteLayout.name}.`
          : `Saved layout ${payload.layout.name}.`;
      } finally {
        done();
      }
    }

    function exitReview() {
      if (state.selectedSlideId) {
        clearTransientVariants(state.selectedSlideId);
      }
      state.selectedVariantId = null;
      state.ui.variantReviewOpen = false;
      elements.operationStatus.textContent = "Returned to the slide list. Generate variants to review alternatives again.";
      renderPreviews();
      render();
    }

    async function captureVariant() {
      if (!state.selectedSlideId) {
        return;
      }

      const done = setBusy(elements.captureVariantButton, "Capturing...");
      try {
        const payloadBody: any = {
          label: elements.variantLabel.value,
          slideId: state.selectedSlideId
        };

        if (state.selectedSlideStructured) {
          payloadBody.slideSpec = parseSlideSpecEditor();
        }

        const payload = await request("/api/variants/capture", {
          body: JSON.stringify(payloadBody),
          method: "POST"
        });
        state.variantStorage = payload.variantStorage || state.variantStorage;
        replacePersistedVariantsForSlide(state.selectedSlideId, payload.variants || [payload.variant]);
        clearTransientVariants(state.selectedSlideId);
        state.selectedVariantId = payload.variant.id;
        state.ui.variantReviewOpen = true;
        elements.variantLabel.value = "";
        elements.operationStatus.textContent = `Captured ${payload.variant.label} for comparison.`;
        openGenerationControls();
        render();
      } finally {
        done();
      }
    }

    async function applyVariantById(variantId, options: any = {}) {
      const variant = getSlideVariants().find((entry) => entry.id === variantId);
      if (!variant) {
        throw new Error(`Unknown variant: ${variantId}`);
      }

      let payload;
      if (variant.persisted === false) {
        if (variant.slideSpec) {
          payload = await request(`/api/slides/${variant.slideId}/slide-spec`, {
            body: JSON.stringify({
              rebuild: true,
              preserveSlidePosition: true,
              selectionScope: variant.operationScope || null,
              slideSpec: variant.slideSpec,
              visualTheme: variant.visualTheme || null
            }),
            method: "POST"
          });
        } else {
          payload = await request(`/api/slides/${variant.slideId}/source`, {
            body: JSON.stringify({
              rebuild: true,
              source: variant.source,
              visualTheme: variant.visualTheme || null
            }),
            method: "POST"
          });
        }
        payload.slideId = variant.slideId;
      } else {
        payload = await request("/api/variants/apply", {
          body: JSON.stringify({ variantId }),
          method: "POST"
        });
      }
      state.previews = payload.previews;
      state.context = payload.context || state.context;
      if (payload.domPreview) {
        setDomPreviewState(payload);
      }
      state.variantStorage = payload.variantStorage || state.variantStorage;
      elements.operationStatus.textContent = `Applied ${options.label || "variant"} to ${payload.slideId}.`;
      clearTransientVariants(payload.slideId);
      await loadSlide(payload.slideId);
      state.ui.variantReviewOpen = false;
      render();

      if (options.validateAfter) {
        await validate(false);
        elements.operationStatus.textContent = `Applied ${options.label || "variant"} and ran checks.`;
      }
    }

    function applySelectedVariant(validateAfter) {
      const variant = getSelectedVariant();
      if (!variant) {
        return;
      }

      applyVariantById(variant.id, {
        label: variant.label,
        validateAfter
      }).catch((error) => windowRef.alert(error.message));
    }

    function mount() {
      elements.ideateSlideButton.addEventListener("click", () => workflowRunners.ideateSlide().catch((error) => windowRef.alert(error.message)));
      elements.ideateStructureButton.addEventListener("click", () => workflowRunners.ideateStructure().catch((error) => windowRef.alert(error.message)));
      elements.ideateThemeButton.addEventListener("click", () => workflowRunners.ideateTheme().catch((error) => windowRef.alert(error.message)));
      elements.redoLayoutButton.addEventListener("click", () => workflowRunners.redoLayout().catch((error) => windowRef.alert(error.message)));
      elements.compareApplyButton.addEventListener("click", () => applySelectedVariant(false));
      elements.compareApplyValidateButton.addEventListener("click", () => applySelectedVariant(true));
      elements.captureVariantButton.addEventListener("click", () => captureVariant().catch((error) => windowRef.alert(error.message)));
      elements.exitVariantReviewButton.addEventListener("click", exitReview);
    }

    return {
      applyVariantById,
      clearTransientVariants,
      getSelectedVariant,
      getSlideVariants,
      mount,
      openGenerationControls,
      render,
      renderComparison,
      renderFlow,
      replacePersistedVariantsForSlide
    };
  }
}
(globalThis as any).StudioClientVariantReviewWorkbench = StudioClientVariantReviewWorkbench;
