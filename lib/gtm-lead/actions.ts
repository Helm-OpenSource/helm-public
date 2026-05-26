import "server-only";

import { db } from "@/lib/db";
import {
  GtmLeadReservedOnlyError,
  assertReservedWorkspaceForGtmLead,
  mapGtmLeadRow,
} from "./queries";
import type {
  GtmLeadCreateInput,
  GtmLeadRecord,
  GtmLeadStage,
  GtmLeadUpdateInput,
} from "./types";
import { isValidGtmLeadStageTransition } from "./types";
import type { Workspace } from "@prisma/client";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class GtmLeadStageTransitionError extends Error {
  constructor(public readonly from: GtmLeadStage, public readonly to: GtmLeadStage) {
    super(`GtmLead stage transition not allowed: ${from} → ${to}`);
    this.name = "GtmLeadStageTransitionError";
  }
}

function normalizeEvidenceRefs(refs: readonly string[] | undefined) {
  if (!refs || refs.length === 0) return null;
  // dedup + trim 空字符串，序列化为 JSON。
  const cleaned = [...new Set(refs.map((s) => s.trim()).filter(Boolean))];
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export async function createGtmLead(input: {
  workspace: ReservedWorkspaceLike;
  data: GtmLeadCreateInput;
}): Promise<GtmLeadRecord> {
  assertReservedWorkspaceForGtmLead(input.workspace);
  if (input.data.workspaceId !== "" && !input.data.workspaceId) {
    throw new Error("workspaceId is required");
  }
  if (!input.data.leadKey?.trim()) {
    throw new Error("leadKey is required");
  }
  if (!input.data.companyName?.trim()) {
    throw new Error("companyName is required");
  }
  const row = await db.gtmLead.create({
    data: {
      workspaceId: input.data.workspaceId,
      leadKey: input.data.leadKey.trim(),
      sourceType: input.data.sourceType,
      sourceRef: input.data.sourceRef ?? null,
      referrerMembershipId: input.data.referrerMembershipId ?? null,
      companyName: input.data.companyName.trim(),
      industry: input.data.industry?.trim() || null,
      icpFit: input.data.icpFit ?? "UNKNOWN",
      readinessStage: input.data.readinessStage ?? "UNKNOWN",
      ownerMembershipId: input.data.ownerMembershipId ?? null,
      stage: input.data.stage ?? "CAPTURED",
      nextAction: input.data.nextAction?.trim() || null,
      blocker: input.data.blocker?.trim() || null,
      evidenceRefsJson: normalizeEvidenceRefs(input.data.evidenceRefs),
      internalNotes: input.data.internalNotes?.trim() || null,
    },
  });
  return mapGtmLeadRow(row);
}

export async function updateGtmLeadStage(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  leadKey: string;
  nextStage: GtmLeadStage;
  // V2.3 §10.10：append-first source trace — 任何 stage 推进都必须带一条 reason note
  // 进 internalNotes，避免静默推进。
  reasonNote: string;
}): Promise<GtmLeadRecord> {
  assertReservedWorkspaceForGtmLead(input.workspace);
  if (!input.reasonNote?.trim()) {
    throw new Error("reasonNote is required for stage transitions (V2.3 §10.10 append-first)");
  }
  const existing = await db.gtmLead.findUnique({
    where: {
      workspaceId_leadKey: {
        workspaceId: input.workspaceId,
        leadKey: input.leadKey,
      },
    },
  });
  if (!existing) {
    throw new Error(`GtmLead not found: ${input.leadKey}`);
  }
  if (!isValidGtmLeadStageTransition(existing.stage, input.nextStage)) {
    throw new GtmLeadStageTransitionError(existing.stage, input.nextStage);
  }
  const appendedNotes = appendReasonNote(
    existing.internalNotes,
    existing.stage,
    input.nextStage,
    input.reasonNote,
  );
  const updated = await db.gtmLead.update({
    where: {
      workspaceId_leadKey: {
        workspaceId: input.workspaceId,
        leadKey: input.leadKey,
      },
    },
    data: {
      stage: input.nextStage,
      internalNotes: appendedNotes,
    },
  });
  return mapGtmLeadRow(updated);
}

export async function updateGtmLeadDetails(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  leadKey: string;
  patch: GtmLeadUpdateInput;
}): Promise<GtmLeadRecord> {
  assertReservedWorkspaceForGtmLead(input.workspace);
  if (input.patch.stage !== undefined) {
    throw new Error(
      "Use updateGtmLeadStage() to change stage (it enforces the V2.3 transition gate).",
    );
  }
  const data: Record<string, unknown> = {};
  if (input.patch.icpFit !== undefined) data.icpFit = input.patch.icpFit;
  if (input.patch.readinessStage !== undefined)
    data.readinessStage = input.patch.readinessStage;
  if (input.patch.ownerMembershipId !== undefined)
    data.ownerMembershipId = input.patch.ownerMembershipId;
  if (input.patch.nextAction !== undefined)
    data.nextAction = input.patch.nextAction?.trim() || null;
  if (input.patch.blocker !== undefined)
    data.blocker = input.patch.blocker?.trim() || null;
  if (input.patch.evidenceRefs !== undefined)
    data.evidenceRefsJson = normalizeEvidenceRefs(input.patch.evidenceRefs);
  if (input.patch.internalNotes !== undefined)
    data.internalNotes = input.patch.internalNotes?.trim() || null;
  if (Object.keys(data).length === 0) {
    const existing = await db.gtmLead.findUnique({
      where: {
        workspaceId_leadKey: {
          workspaceId: input.workspaceId,
          leadKey: input.leadKey,
        },
      },
    });
    if (!existing) throw new Error(`GtmLead not found: ${input.leadKey}`);
    return mapGtmLeadRow(existing);
  }
  const updated = await db.gtmLead.update({
    where: {
      workspaceId_leadKey: {
        workspaceId: input.workspaceId,
        leadKey: input.leadKey,
      },
    },
    data,
  });
  return mapGtmLeadRow(updated);
}

function appendReasonNote(
  existing: string | null,
  from: GtmLeadStage,
  to: GtmLeadStage,
  reason: string,
) {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${from} → ${to}: ${reason.trim()}`;
  const trimmed = (existing ?? "").trim();
  return trimmed ? `${trimmed}\n${line}` : line;
}

// 重新导出 caller 可能用到的 error 类型，避免再 import queries.ts。
export { GtmLeadReservedOnlyError };
