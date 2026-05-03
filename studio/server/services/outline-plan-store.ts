import * as fs from "fs";

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

function createSlug(value: unknown, fallback = "presentation"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return slug || fallback;
}

function normalizeCompactText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

export function createOutlinePlanStore(deps: OutlinePlanStoreDependencies) {
  function readOutlinePlansStore(id: unknown = deps.getActivePresentationId()): OutlinePlansStore {
    const paths = deps.getPresentationPaths(id);
    deps.ensureAllowedDir(paths.stateDir);
    if (!fs.existsSync(paths.outlinePlansFile)) {
      deps.writeJson(paths.outlinePlansFile, { plans: [] });
    }

    return normalizeOutlinePlansStore(deps.readJson(paths.outlinePlansFile, { plans: [] }));
  }

  function writeOutlinePlansStore(id: unknown, store: unknown): OutlinePlansStore {
    const paths = deps.getPresentationPaths(id);
    deps.ensureAllowedDir(paths.stateDir);
    const normalized = normalizeOutlinePlansStore(store);
    deps.writeJson(paths.outlinePlansFile, normalized);
    return normalized;
  }

  function listOutlinePlans(id: unknown = deps.getActivePresentationId(), options: { includeArchived?: boolean } = {}): OutlinePlan[] {
    const plans = readOutlinePlansStore(id).plans;
    return options.includeArchived === true
      ? plans
      : plans.filter((plan: OutlinePlan) => !plan.archivedAt);
  }

  function getOutlinePlan(id: unknown, planId: unknown): OutlinePlan {
    const plan = listOutlinePlans(id, { includeArchived: true }).find((entry: OutlinePlan) => entry.id === planId);
    if (!plan) {
      throw new Error(`Unknown outline plan: ${planId}`);
    }

    return plan;
  }

  function saveOutlinePlan(id: unknown, plan: unknown): OutlinePlan | undefined {
    const safeId = deps.assertPresentationId(id);
    deps.ensurePresentationExists(safeId);

    const normalized = normalizeOutlinePlan(plan, {
      sourcePresentationId: safeId
    });
    const current = readOutlinePlansStore(safeId);
    const existing = current.plans.filter((entry: OutlinePlan) => entry.id !== normalized.id);
    const next = writeOutlinePlansStore(safeId, {
      plans: [
        normalized,
        ...existing
      ]
    });

    return next.plans.find((entry: OutlinePlan) => entry.id === normalized.id);
  }

  function deleteOutlinePlan(id: unknown, planId: unknown): OutlinePlan[] {
    const safeId = deps.assertPresentationId(id);
    const current = readOutlinePlansStore(safeId);
    if (!current.plans.some((plan: OutlinePlan) => plan.id === planId)) {
      throw new Error(`Unknown outline plan: ${planId}`);
    }

    return writeOutlinePlansStore(safeId, {
      plans: current.plans.filter((plan: OutlinePlan) => plan.id !== planId)
    }).plans;
  }

  function duplicateOutlinePlan(id: unknown, planId: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
    const safeId = deps.assertPresentationId(id);
    const sourcePlan = getOutlinePlan(safeId, planId);
    const current = readOutlinePlansStore(safeId);
    const baseName = normalizeCompactText(fields.name, `${sourcePlan.name} copy`);
    let candidateId = createSlug(fields.id || baseName, "outline-plan-copy");
    let suffix = 2;

    while (current.plans.some((plan: OutlinePlan) => plan.id === candidateId)) {
      candidateId = `${createSlug(baseName, "outline-plan-copy")}-${suffix}`;
      suffix += 1;
    }

    return saveOutlinePlan(safeId, {
      ...sourcePlan,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      id: candidateId,
      name: baseName,
      parentPlanId: sourcePlan.id,
      updatedAt: null
    });
  }

  function archiveOutlinePlan(id: unknown, planId: unknown): OutlinePlan | undefined {
    const safeId = deps.assertPresentationId(id);
    const sourcePlan = getOutlinePlan(safeId, planId);
    return saveOutlinePlan(safeId, {
      ...sourcePlan,
      archivedAt: new Date().toISOString()
    });
  }

  return {
    archiveOutlinePlan,
    deleteOutlinePlan,
    duplicateOutlinePlan,
    getOutlinePlan,
    listOutlinePlans,
    readOutlinePlansStore,
    saveOutlinePlan,
    writeOutlinePlansStore
  };
}
