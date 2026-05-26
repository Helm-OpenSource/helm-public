import "server-only";

import { db } from "@/lib/db";
import {
  OperatingControlLineCandidateReservedOnlyError,
  assertReservedWorkspaceForControlLineCandidate,
  mapControlLineCandidateRow,
} from "./queries";
import type {
  OperatingControlLineCandidateCreateInput,
  OperatingControlLineCandidateEvidenceNote,
  OperatingControlLineCandidateEvidenceReadiness,
  OperatingControlLineCandidateRecord,
  OperatingControlLineCandidateStatus,
} from "./types";
import {
  canEnterTrialPremise,
  isValidControlLineStatusTransition,
  isValidEvidenceReadinessTransition,
} from "./types";
import type { Workspace } from "@prisma/client";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class ControlLineStatusTransitionError extends Error {
  constructor(
    public readonly from: OperatingControlLineCandidateStatus,
    public readonly to: OperatingControlLineCandidateStatus,
  ) {
    super(
      `OperatingControlLineCandidate status transition not allowed: ${from} → ${to}`,
    );
    this.name = "ControlLineStatusTransitionError";
  }
}

export class EvidenceReadinessTransitionError extends Error {
  constructor(
    public readonly from: OperatingControlLineCandidateEvidenceReadiness,
    public readonly to: OperatingControlLineCandidateEvidenceReadiness,
  ) {
    super(
      `Evidence readiness transition not allowed: ${from} → ${to}`,
    );
    this.name = "EvidenceReadinessTransitionError";
  }
}

export class TrialPremiseRequiresVerifiedEvidenceError extends Error {
  constructor(
    public readonly evidenceReadiness: OperatingControlLineCandidateEvidenceReadiness,
  ) {
    super(
      `TRIAL_PREMISE requires evidenceReadiness=VERIFIED (current: ${evidenceReadiness}). V2.3 §10.8 Pain is not Evidence.`,
    );
    this.name = "TrialPremiseRequiresVerifiedEvidenceError";
  }
}

function jsonOr<T>(value: T | null | undefined, fallback: T): string {
  return JSON.stringify(value ?? fallback);
}

function appendEvidenceNote(
  existing: OperatingControlLineCandidateEvidenceNote[],
  note: OperatingControlLineCandidateEvidenceNote,
) {
  return [...existing, note];
}

function safeJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function createControlLineCandidate(input: {
  workspace: ReservedWorkspaceLike;
  data: OperatingControlLineCandidateCreateInput;
}): Promise<OperatingControlLineCandidateRecord> {
  assertReservedWorkspaceForControlLineCandidate(input.workspace);
  const { data } = input;
  if (!data.workspaceId) throw new Error("workspaceId is required");
  if (!data.briefId) throw new Error("briefId is required");
  if (!data.candidateKey?.trim()) throw new Error("candidateKey is required");
  if (!data.painTag?.trim()) throw new Error("painTag is required");
  if (!data.targetBusinessObject?.trim())
    throw new Error("targetBusinessObject is required");

  const row = await db.operatingControlLineCandidate.create({
    data: {
      workspaceId: data.workspaceId,
      briefId: data.briefId,
      candidateKey: data.candidateKey.trim(),
      painTag: data.painTag.trim(),
      controlLineTemplate: data.controlLineTemplate,
      targetBusinessObject: data.targetBusinessObject.trim(),
      resourceInputsJson: jsonOr(data.resourceInputs, []),
      // V2.3 §10.8：销售收集的资源默认 DECLARED，绝不允许 caller 在创建时直接给
      // PARTIAL/READY/VERIFIED。
      evidenceReadiness: "DECLARED",
      status: "DRAFT",
      evidenceNotesJson: jsonOr([], []),
      reviewerNotes: null,
    },
  });
  return mapControlLineCandidateRow(row);
}

export async function updateEvidenceReadiness(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  candidateKey: string;
  nextReadiness: OperatingControlLineCandidateEvidenceReadiness;
  actor: string;
  origin: OperatingControlLineCandidateEvidenceNote["origin"];
  note: string;
}): Promise<OperatingControlLineCandidateRecord> {
  assertReservedWorkspaceForControlLineCandidate(input.workspace);
  if (!input.note?.trim()) {
    throw new Error("note is required (V2.3 §10.10 append-first)");
  }
  // V2.3 §10.8：只有 internal_review origin 才能让证据进入 VERIFIED。
  if (input.nextReadiness === "VERIFIED" && input.origin !== "internal_review") {
    throw new Error(
      "evidenceReadiness=VERIFIED can only be set via origin=internal_review (V2.3 §10.8 Pain is not Evidence)",
    );
  }
  const existing = await db.operatingControlLineCandidate.findUnique({
    where: {
      workspaceId_candidateKey: {
        workspaceId: input.workspaceId,
        candidateKey: input.candidateKey,
      },
    },
  });
  if (!existing) {
    throw new Error(`OperatingControlLineCandidate not found: ${input.candidateKey}`);
  }
  if (
    !isValidEvidenceReadinessTransition(
      existing.evidenceReadiness,
      input.nextReadiness,
    )
  ) {
    throw new EvidenceReadinessTransitionError(
      existing.evidenceReadiness,
      input.nextReadiness,
    );
  }
  const trace = appendEvidenceNote(
    safeJsonArray<OperatingControlLineCandidateEvidenceNote>(
      existing.evidenceNotesJson,
    ),
    {
      ts: new Date().toISOString(),
      origin: input.origin,
      actor: input.actor,
      beforeReadiness: existing.evidenceReadiness,
      afterReadiness: input.nextReadiness,
      note: input.note.trim(),
    },
  );
  // V2.3 §10.8：如果证据下降到 PARTIAL/DECLARED 而 status 是 TRIAL_PREMISE，
  // 自动把 status 降级为 REVIEW_REQUIRED（不允许带不足证据保留 trial premise）。
  let nextStatus = existing.status;
  if (
    existing.status === "TRIAL_PREMISE" &&
    (input.nextReadiness === "DECLARED" || input.nextReadiness === "PARTIAL")
  ) {
    nextStatus = "REVIEW_REQUIRED";
  }
  const updated = await db.operatingControlLineCandidate.update({
    where: {
      workspaceId_candidateKey: {
        workspaceId: input.workspaceId,
        candidateKey: input.candidateKey,
      },
    },
    data: {
      evidenceReadiness: input.nextReadiness,
      evidenceNotesJson: JSON.stringify(trace),
      status: nextStatus,
    },
  });
  return mapControlLineCandidateRow(updated);
}

export async function updateControlLineCandidateStatus(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  candidateKey: string;
  nextStatus: OperatingControlLineCandidateStatus;
  reviewerActor: string;
  reasonNote: string;
}): Promise<OperatingControlLineCandidateRecord> {
  assertReservedWorkspaceForControlLineCandidate(input.workspace);
  if (!input.reasonNote?.trim()) {
    throw new Error("reasonNote is required for status transitions (V2.3 §10.10 append-first)");
  }
  const existing = await db.operatingControlLineCandidate.findUnique({
    where: {
      workspaceId_candidateKey: {
        workspaceId: input.workspaceId,
        candidateKey: input.candidateKey,
      },
    },
  });
  if (!existing) {
    throw new Error(`OperatingControlLineCandidate not found: ${input.candidateKey}`);
  }
  if (!isValidControlLineStatusTransition(existing.status, input.nextStatus)) {
    throw new ControlLineStatusTransitionError(existing.status, input.nextStatus);
  }
  // V2.3 §10.8 硬约束：TRIAL_PREMISE 必须 evidenceReadiness=VERIFIED。
  if (!canEnterTrialPremise(existing.evidenceReadiness, input.nextStatus)) {
    throw new TrialPremiseRequiresVerifiedEvidenceError(existing.evidenceReadiness);
  }
  // status transition 也以 evidence note 的形式追加，origin=internal_review。
  const trace = appendEvidenceNote(
    safeJsonArray<OperatingControlLineCandidateEvidenceNote>(
      existing.evidenceNotesJson,
    ),
    {
      ts: new Date().toISOString(),
      origin: "internal_review",
      actor: input.reviewerActor,
      beforeReadiness: existing.evidenceReadiness,
      afterReadiness: existing.evidenceReadiness,
      note: `status: ${existing.status} → ${input.nextStatus}: ${input.reasonNote.trim()}`,
    },
  );
  const nextReviewerNotes = (() => {
    const prev = existing.reviewerNotes?.trim() ?? "";
    const ts = new Date().toISOString();
    const line = `[${ts}] ${existing.status} → ${input.nextStatus} · ${input.reviewerActor}: ${input.reasonNote.trim()}`;
    return prev ? `${prev}\n${line}` : line;
  })();
  const updated = await db.operatingControlLineCandidate.update({
    where: {
      workspaceId_candidateKey: {
        workspaceId: input.workspaceId,
        candidateKey: input.candidateKey,
      },
    },
    data: {
      status: input.nextStatus,
      evidenceNotesJson: JSON.stringify(trace),
      reviewerNotes: nextReviewerNotes,
    },
  });
  return mapControlLineCandidateRow(updated);
}

export { OperatingControlLineCandidateReservedOnlyError };
