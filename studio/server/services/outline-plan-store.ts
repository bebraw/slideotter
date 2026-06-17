import * as fs from "fs";

import { createSlug, normalizeCompactText } from "./compact-text.ts";
import {
  normalizeOutlinePlan,
  normalizeOutlinePlansStore,
  type OutlinePlan,
  type OutlinePlansStore
} from "./outline-plans.ts";

type JsonObject = Record<string, unknown>;

type OutlinePlanStorePaths = {
  outlinePlansFile: string;
  stateDir: string;
};

type OutlinePlanStoreDependencies = {
  assertPresentationId: (id: unknown) => string;
  ensureAllowedDir: (pathName: string) => void;
  ensurePresentationExists: (id: string) => void;
  getActivePresentationId: () => string;
  getPresentationPaths: (id: unknown) => OutlinePlanStorePaths;
  readJson: (fileName: string, fallback: unknown) => unknown;
  writeJson: (fileName: string, value: unknown) => void;
};

function readOutlinePlansStoreFromDeps(deps: OutlinePlanStoreDependencies, id: unknown = deps.getActivePresentationId()): OutlinePlansStore {
  const paths = deps.getPresentationPaths(id);
  deps.ensureAllowedDir(paths.stateDir);
  if (!fs.existsSync(paths.outlinePlansFile)) {
    deps.writeJson(paths.outlinePlansFile, { plans: [] });
  }

  return normalizeOutlinePlansStore(deps.readJson(paths.outlinePlansFile, { plans: [] }));
}

function writeOutlinePlansStoreFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, store: unknown): OutlinePlansStore {
  const paths = deps.getPresentationPaths(id);
  deps.ensureAllowedDir(paths.stateDir);
  const normalized = normalizeOutlinePlansStore(store);
  deps.writeJson(paths.outlinePlansFile, normalized);
  return normalized;
}

function listOutlinePlansFromDeps(
  deps: OutlinePlanStoreDependencies,
  id: unknown = deps.getActivePresentationId(),
  options: { includeArchived?: boolean } = {}
): OutlinePlan[] {
  const plans = readOutlinePlansStoreFromDeps(deps, id).plans;
  return options.includeArchived === true
    ? plans
    : plans.filter((plan: OutlinePlan) => !plan.archivedAt);
}

function getOutlinePlanFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, planId: unknown): OutlinePlan {
  const plan = listOutlinePlansFromDeps(deps, id, { includeArchived: true }).find((entry: OutlinePlan) => entry.id === planId);
  if (!plan) {
    throw new Error(`Unknown outline plan: ${planId}`);
  }

  return plan;
}

function saveOutlinePlanFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, plan: unknown): OutlinePlan | undefined {
  const safeId = deps.assertPresentationId(id);
  deps.ensurePresentationExists(safeId);
  const normalized = normalizeOutlinePlan(plan, {
    sourcePresentationId: safeId
  });
  const current = readOutlinePlansStoreFromDeps(deps, safeId);
  const existing = current.plans.filter((entry: OutlinePlan) => entry.id !== normalized.id);
  const next = writeOutlinePlansStoreFromDeps(deps, safeId, {
    activePlanId: current.activePlanId || normalized.id,
    plans: [
      normalized,
      ...existing
    ]
  });

  return next.plans.find((entry: OutlinePlan) => entry.id === normalized.id);
}

function deleteOutlinePlanFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, planId: unknown): OutlinePlan[] {
  const safeId = deps.assertPresentationId(id);
  const current = readOutlinePlansStoreFromDeps(deps, safeId);
  if (!current.plans.some((plan: OutlinePlan) => plan.id === planId)) {
    throw new Error(`Unknown outline plan: ${planId}`);
  }

  return writeOutlinePlansStoreFromDeps(deps, safeId, {
    activePlanId: current.activePlanId === planId ? "" : current.activePlanId,
    plans: current.plans.filter((plan: OutlinePlan) => plan.id !== planId)
  }).plans;
}

function createDuplicateOutlinePlanId(current: OutlinePlansStore, fields: JsonObject, sourcePlan: OutlinePlan): { baseName: string; candidateId: string } {
  const baseName = normalizeCompactText(fields.name, `${sourcePlan.name} copy`);
  let candidateId = createSlug(fields.id || baseName, "outline-plan-copy");
  let suffix = 2;

  while (current.plans.some((plan: OutlinePlan) => plan.id === candidateId)) {
    candidateId = `${createSlug(baseName, "outline-plan-copy")}-${suffix}`;
    suffix += 1;
  }

  return { baseName, candidateId };
}

function duplicateOutlinePlanFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, planId: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
  const safeId = deps.assertPresentationId(id);
  const sourcePlan = getOutlinePlanFromDeps(deps, safeId, planId);
  const current = readOutlinePlansStoreFromDeps(deps, safeId);
  const { baseName, candidateId } = createDuplicateOutlinePlanId(current, fields, sourcePlan);

  return saveOutlinePlanFromDeps(deps, safeId, {
    ...sourcePlan,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    id: candidateId,
    name: baseName,
    parentPlanId: sourcePlan.id,
    updatedAt: null
  });
}

function archiveOutlinePlanFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, planId: unknown): OutlinePlan | undefined {
  const safeId = deps.assertPresentationId(id);
  const sourcePlan = getOutlinePlanFromDeps(deps, safeId, planId);
  return saveOutlinePlanFromDeps(deps, safeId, {
    ...sourcePlan,
    archivedAt: new Date().toISOString()
  });
}

function setActiveOutlinePlanFromDeps(deps: OutlinePlanStoreDependencies, id: unknown, planId: unknown): OutlinePlansStore {
  const safeId = deps.assertPresentationId(id);
  const current = readOutlinePlansStoreFromDeps(deps, safeId);
  const activePlan = current.plans.find((plan: OutlinePlan) => plan.id === planId);
  if (!activePlan) {
    throw new Error(`Unknown outline plan: ${planId}`);
  }
  if (activePlan.archivedAt) {
    throw new Error("Archived outline plans cannot be active.");
  }

  return writeOutlinePlansStoreFromDeps(deps, safeId, {
    activePlanId: activePlan.id,
    plans: current.plans
  });
}

export function createOutlinePlanStore(deps: OutlinePlanStoreDependencies) {
  return {
    archiveOutlinePlan: (id: unknown, planId: unknown) => archiveOutlinePlanFromDeps(deps, id, planId),
    deleteOutlinePlan: (id: unknown, planId: unknown) => deleteOutlinePlanFromDeps(deps, id, planId),
    duplicateOutlinePlan: (id: unknown, planId: unknown, fields: JsonObject = {}) => duplicateOutlinePlanFromDeps(deps, id, planId, fields),
    getActiveOutlinePlanId: (id: unknown = deps.getActivePresentationId()) => readOutlinePlansStoreFromDeps(deps, id).activePlanId,
    getOutlinePlan: (id: unknown, planId: unknown) => getOutlinePlanFromDeps(deps, id, planId),
    listOutlinePlans: (id: unknown = deps.getActivePresentationId(), options: { includeArchived?: boolean } = {}) => listOutlinePlansFromDeps(deps, id, options),
    readOutlinePlansStore: (id: unknown = deps.getActivePresentationId()) => readOutlinePlansStoreFromDeps(deps, id),
    saveOutlinePlan: (id: unknown, plan: unknown) => saveOutlinePlanFromDeps(deps, id, plan),
    setActiveOutlinePlan: (id: unknown, planId: unknown) => setActiveOutlinePlanFromDeps(deps, id, planId),
    writeOutlinePlansStore: (id: unknown, store: unknown) => writeOutlinePlansStoreFromDeps(deps, id, store)
  };
}
