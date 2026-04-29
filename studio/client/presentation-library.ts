namespace StudioClientPresentationLibrary {
  export function createPresentationLibrary(deps) {
    const {
      elements,
      escapeHtml,
      getPresentationState,
      refreshState,
      renderDomSlide,
      request,
      setBusy,
      setCurrentPage,
      state,
      windowRef
    } = deps;

    function formatPresentationDate(value) {
      if (!value) {
        return "";
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      try {
        return new Intl.DateTimeFormat(undefined, {
          day: "numeric",
          month: "short"
        }).format(date);
      } catch (error) {
        return date.toISOString().slice(0, 10);
      }
    }

    function buildPresentationFacts(presentation) {
      const facts = [
        `${presentation.slideCount || 0} slide${presentation.slideCount === 1 ? "" : "s"}`
      ];
      if (presentation.targetSlideCount) {
        facts.push(`${presentation.targetSlideCount} target`);
      }
      const updated = formatPresentationDate(presentation.updatedAt);
      if (updated) {
        facts.push(`Updated ${updated}`);
      }
      if (presentation.audience) {
        facts.push(presentation.audience);
      }
      if (presentation.tone) {
        facts.push(presentation.tone);
      }

      return facts.slice(0, 4);
    }

    function getPresentationSearchText(presentation) {
      return [
        presentation.title,
        presentation.description,
        presentation.audience,
        presentation.objective,
        presentation.subject,
        presentation.tone,
        presentation.targetSlideCount ? `${presentation.targetSlideCount} target` : ""
      ].map((value) => String(value || "").toLowerCase()).join(" ");
    }

    function comparePresentationUpdatedAt(left, right) {
      const leftTime = Date.parse(left.updatedAt || "") || 0;
      const rightTime = Date.parse(right.updatedAt || "") || 0;
      return rightTime - leftTime;
    }

    function resetSelection() {
      state.selectedSlideId = null;
      state.selectedSlideIndex = 1;
      state.selectedSlideSpec = null;
      state.selectedSlideSpecDraftError = null;
      state.selectedSlideSpecError = null;
      state.selectedSlideStructured = false;
      state.selectedSlideSource = "";
      state.selectedVariantId = null;
      state.transientVariants = [];
    }

    async function selectPresentation(presentationId, button = null) {
      const presentationState = getPresentationState();
      if (presentationId === presentationState.activePresentationId) {
        setCurrentPage("studio");
        return;
      }

      const done = button ? setBusy(button, "Selecting...") : null;
      try {
        await request("/api/presentations/select", {
          body: JSON.stringify({ presentationId }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
        setCurrentPage("studio");
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function duplicatePresentation(presentation, button = null) {
      const title = `${presentation.title || presentation.id} copy`;
      const done = button ? setBusy(button, "Duplicating...") : null;
      try {
        await request("/api/presentations/duplicate", {
          body: JSON.stringify({
            presentationId: presentation.id,
            title
          }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
        setCurrentPage("studio");
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function regeneratePresentation(presentation, button = null) {
      const confirmed = windowRef.confirm(`Regenerate "${presentation.title || presentation.id}" from its saved context? This replaces the current slide files.`);
      if (!confirmed) {
        return;
      }

      const done = button ? setBusy(button, "Regenerating...") : null;
      try {
        await request("/api/presentations/regenerate", {
          body: JSON.stringify({
            presentationId: presentation.id
          }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
        setCurrentPage("studio");
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function deletePresentation(presentation, button = null) {
      const confirmed = windowRef.confirm(`Delete "${presentation.title || presentation.id}"? This removes the presentation folder from this workspace.`);
      if (!confirmed) {
        return;
      }

      const done = button ? setBusy(button, "Deleting...") : null;
      try {
        await request("/api/presentations/delete", {
          body: JSON.stringify({ presentationId: presentation.id }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
      } finally {
        if (done) {
          done();
        }
      }
    }

    function render() {
      const presentationState = getPresentationState();
      const query = String(elements.presentationSearch.value || "").trim().toLowerCase();
      const presentations = presentationState.presentations
        .slice()
        .sort((left, right) => {
          if (left.id === presentationState.activePresentationId) {
            return -1;
          }
          if (right.id === presentationState.activePresentationId) {
            return 1;
          }

          return comparePresentationUpdatedAt(left, right);
        })
        .filter((presentation) => !query || getPresentationSearchText(presentation).includes(query));
      elements.presentationList.innerHTML = "";
      elements.presentationResultCount.textContent = `${presentations.length} of ${presentationState.presentations.length} presentation${presentationState.presentations.length === 1 ? "" : "s"}`;

      if (!presentations.length) {
        elements.presentationList.innerHTML = `
          <div class="presentation-empty">
            <strong>${query ? "No matching presentations" : "No presentations found"}</strong>
            <span>${query ? "Clear the filter or search for a different title, audience, tone, or objective." : "Create one from constraints and an initial generated deck."}</span>
          </div>
        `;
        return;
      }

      presentations.forEach((presentation) => {
        const active = presentation.id === presentationState.activePresentationId;
        const facts = buildPresentationFacts(presentation);
        const card = document.createElement("article");
        card.className = `presentation-card${active ? " active" : ""}`;
        card.dataset.presentationId = presentation.id;
        card.innerHTML = `
          <div class="presentation-card-preview" aria-hidden="true"></div>
          <div class="presentation-card-body">
            <div class="presentation-card-title-row">
              <h3>${escapeHtml(presentation.title || presentation.id)}</h3>
              ${active ? "<span class=\"presentation-active-pill\">Active</span>" : ""}
            </div>
            <p>${escapeHtml(presentation.description || "No brief saved yet.")}</p>
            <div class="presentation-card-facts" aria-label="Presentation metadata">
              ${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}
            </div>
          </div>
          <div class="presentation-card-actions">
            <button class="secondary presentation-select-button" type="button">${active ? "Open" : "Select"}</button>
            <button class="secondary presentation-regenerate-button" type="button">Regenerate</button>
            <button class="secondary presentation-duplicate-button" type="button">Duplicate</button>
            <button class="secondary presentation-delete-button" type="button"${presentations.length <= 1 ? " disabled" : ""}>Delete</button>
          </div>
        `;

        const preview = card.querySelector(".presentation-card-preview");
        if (presentation.firstSlideSpec) {
          renderDomSlide(preview, presentation.firstSlideSpec, {
            index: 1,
            theme: presentation.theme,
            totalSlides: presentation.slideCount || 1
          });
        }

        const selectButton = card.querySelector(".presentation-select-button");
        const regenerateButton = card.querySelector(".presentation-regenerate-button");
        const duplicateButton = card.querySelector(".presentation-duplicate-button");
        const deleteButton = card.querySelector(".presentation-delete-button");

        selectButton.addEventListener("click", () => {
          selectPresentation(presentation.id, selectButton).catch((error) => windowRef.alert(error.message));
        });
        duplicateButton.addEventListener("click", () => {
          duplicatePresentation(presentation, duplicateButton).catch((error) => windowRef.alert(error.message));
        });
        regenerateButton.addEventListener("click", () => {
          regeneratePresentation(presentation, regenerateButton).catch((error) => windowRef.alert(error.message));
        });
        deleteButton.addEventListener("click", () => {
          deletePresentation(presentation, deleteButton).catch((error) => windowRef.alert(error.message));
        });
        card.addEventListener("click", (event) => {
          const target = event.target as Element | null;
          if (target && target.closest("button")) {
            return;
          }

          selectPresentation(presentation.id, selectButton).catch((error) => windowRef.alert(error.message));
        });

        elements.presentationList.appendChild(card);
      });
    }

    return {
      deletePresentation,
      duplicatePresentation,
      regeneratePresentation,
      render,
      resetSelection,
      selectPresentation
    };
  }
}
