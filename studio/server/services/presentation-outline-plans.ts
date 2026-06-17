import * as presentations from "./presentations.ts";
import * as fs from "fs";
import { getActivePresentationId } from "./active-presentation.ts";
import { ensureAllowedDir } from "./ensure-allowed-dir.ts";
import { createOutlinePlanStore } from "./outline-plan-store.ts";
import {
  type OutlinePlan
} from "./outline-plans.ts";
import {
  assertPresentationId
} from "./presentation-paths.ts";
import {
  type JsonObject
} from "./presentation-state.ts";
import { readJson, writeJson } from "./json-io.ts";

const getPresentationPaths = presentations.getPresentationPaths;
const createOutlinePlanFromDeckPlan = presentations.createOutlinePlanFromDeckPlan;
const createOutlinePlanFromPresentation = presentations.createOutlinePlanFromPresentation;
const derivePresentationFromOutlinePlan = presentations.derivePresentationFromOutlinePlan;
const outlinePlanToDeckPlan = presentations.outlinePlanToDeckPlan;
const proposeDeckChangesFromOutlinePlan = presentations.proposeDeckChangesFromOutlinePlan;

const outlinePlanStore = createOutlinePlanStore({
  assertPresentationId,
  ensureAllowedDir,
  ensurePresentationExists(id: string): void {
    if (!fs.existsSync(getPresentationPaths(id).rootDir)) {
      throw new Error(`Unknown presentation: ${id}`);
    }
  },
  getActivePresentationId,
  getPresentationPaths,
  readJson,
  writeJson
});

function listOutlinePlans(id: unknown = getActivePresentationId(), options: { includeArchived?: boolean } = {}): OutlinePlan[] {
  return outlinePlanStore.listOutlinePlans(id, options);
}

function getActiveOutlinePlanId(id: unknown = getActivePresentationId()): string {
  return outlinePlanStore.getActiveOutlinePlanId(id);
}

function getOutlinePlan(id: unknown, planId: unknown): OutlinePlan {
  return outlinePlanStore.getOutlinePlan(id, planId);
}

function saveOutlinePlan(id: unknown, plan: unknown): OutlinePlan | undefined {
  return outlinePlanStore.saveOutlinePlan(id, plan);
}

function deleteOutlinePlan(id: unknown, planId: unknown): OutlinePlan[] {
  return outlinePlanStore.deleteOutlinePlan(id, planId);
}

function duplicateOutlinePlan(id: unknown, planId: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
  return outlinePlanStore.duplicateOutlinePlan(id, planId, fields);
}

function archiveOutlinePlan(id: unknown, planId: unknown): OutlinePlan | undefined {
  return outlinePlanStore.archiveOutlinePlan(id, planId);
}

function setActiveOutlinePlan(id: unknown, planId: unknown): string {
  return outlinePlanStore.setActiveOutlinePlan(id, planId).activePlanId;
}

export {
  archiveOutlinePlan,
  createOutlinePlanFromDeckPlan,
  createOutlinePlanFromPresentation,
  deleteOutlinePlan,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  getActiveOutlinePlanId,
  getOutlinePlan,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  proposeDeckChangesFromOutlinePlan,
  saveOutlinePlan,
  setActiveOutlinePlan
};
