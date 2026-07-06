import "server-only";

import {
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  SourceType,
  type FirstLoopType,
  type Workspace,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { createGovernedAction } from "@/lib/policies/engine";
import { assertReservedWorkspaceForDiagnosticSession } from "./queries";

// ---------------------------------------------------------------------------
// Diagnostic session -> governed work packet bridge.
//
// A DiagnosticSession that passed the first-loop gate (FIRST_LOOP_SELECTED,
// V2.3 §6.5) so far ended as a reviewed conclusion with no executable object.
// This bridge turns the selected first-loop candidate into ONE governed
// ActionItem through the standard policy engine — so it inherits the entire
// review chain this repo already enforces: policy-resolved approval mode,
// audit trail, separation-of-duties gate, structured rejection taxonomy, and
// the execution receipt on closure. Advice-only boundary: the packet is a
// review-first suggestion; nothing executes without the approval gate.
//
// Idempotent AND concurrency-safe: the DiagnosticSessionWorkPacket claim
// ledger (unique diagnosticSessionId) is the arbiter — one work packet per
// session, racing calls resolve to a single winner and the loser withdraws
// its duplicate. Re-running the bridge cannot flood the approval queue.
// ---------------------------------------------------------------------------

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class DiagnosticFirstLoopGateNotPassedError extends Error {
  constructor(english = false) {
    super(
      english
        ? "The diagnostic session has not passed the first-loop gate; select and review a first loop before creating a work packet."
        : "诊断会话尚未通过首环门：请先复核并选定首环，再生成推进任务。",
    );
    this.name = "DiagnosticFirstLoopGateNotPassedError";
  }
}

export const FIRST_LOOP_TYPE_LABELS: Record<FirstLoopType, { zh: string; en: string }> = {
  LEAD_FOLLOW_UP: { zh: "线索跟进", en: "Lead follow-up" },
  CUSTOMER_REVIEW: { zh: "客户复盘", en: "Customer review" },
  DELIVERY_RISK: { zh: "交付风险", en: "Delivery risk" },
  OPPORTUNITY_JUDGEMENT: { zh: "商机判断", en: "Opportunity judgement" },
  RENEWAL_EXPANSION: { zh: "续费扩容", en: "Renewal and expansion" },
  OTHER: { zh: "其他首环", en: "Other first loop" },
};

export function buildDiagnosticSessionWorkPacketSourceId(sessionId: string): string {
  return `diagnostic-session:${sessionId}`;
}

export async function createFirstLoopWorkPacketFromDiagnosticSession(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  sessionId: string;
  actorName: string;
  actorUserId?: string | null;
  english?: boolean;
}): Promise<{ actionItemId: string; approvalTaskId?: string; created: boolean }> {
  const english = input.english ?? false;
  assertReservedWorkspaceForDiagnosticSession(input.workspace, english);

  const session = await db.diagnosticSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });

  if (!session) {
    throw new Error(english ? "Diagnostic session not found" : "诊断会话不存在");
  }

  if (session.status !== "FIRST_LOOP_SELECTED" || !session.firstLoopCandidateType) {
    throw new DiagnosticFirstLoopGateNotPassedError(english);
  }

  const sourceId = buildDiagnosticSessionWorkPacketSourceId(session.id);

  const resolveExistingPacket = async (actionItemId: string) => {
    const actionItem = await db.actionItem.findFirst({
      where: { id: actionItemId, workspaceId: input.workspaceId },
      select: { id: true, approvalTask: { select: { id: true } } },
    });
    return {
      actionItemId,
      approvalTaskId: actionItem?.approvalTask?.id,
      created: false as const,
    };
  };

  const existingPacket = await db.diagnosticSessionWorkPacket.findUnique({
    where: { diagnosticSessionId: session.id },
  });
  if (existingPacket) {
    return resolveExistingPacket(existingPacket.actionItemId);
  }

  const label = FIRST_LOOP_TYPE_LABELS[session.firstLoopCandidateType];
  const labelText = english ? label.en : label.zh;

  const result = await createGovernedAction({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.CREATE_TASK,
    title: english ? `First loop kickoff: ${labelText}` : `首环启动：${labelText}`,
    description:
      session.firstLoopCandidateNote?.trim() ||
      (english
        ? `Kick off the selected first loop for business goal: ${session.businessGoal}`
        : `围绕经营目标启动已选定的首环：${session.businessGoal}`),
    aiReason: english
      ? `Diagnostic session ${session.diagnosticKey} was reviewed and its first loop selected. This packet turns the reviewed conclusion into a governed, review-first task.`
      : `诊断会话 ${session.diagnosticKey} 已复核并选定首环。本任务把复核结论转成走标准审批链的推进任务。`,
    riskLevel: "MEDIUM",
    sourceType: SourceType.SYSTEM_INFERENCE,
    sourceId,
    metadata: {
      diagnosticSessionId: session.id,
      diagnosticKey: session.diagnosticKey,
      firstLoopCandidateType: session.firstLoopCandidateType,
      generatedFrom: "diagnostic_session_first_loop",
    },
  });

  try {
    await db.diagnosticSessionWorkPacket.create({
      data: {
        workspaceId: input.workspaceId,
        diagnosticSessionId: session.id,
        actionItemId: result.actionItemId,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
    // A concurrent bridge call won the unique claim between our lookup and
    // this insert. Withdraw the duplicate we just created (audit-visible, no
    // deletion) and hand back the winner's packet.
    await db.actionItem.update({
      where: { id: result.actionItemId },
      data: {
        status: ActionStatus.WITHDRAWN,
        executionStatus: "withdrawn",
        statusReason: english
          ? "Duplicate first-loop packet from a concurrent bridge call; superseded by the existing packet"
          : "并发生成的重复首环任务，已撤回，沿用既有任务",
      },
    });
    if (result.approvalTaskId) {
      await db.approvalTask.update({
        where: { id: result.approvalTaskId },
        data: {
          status: ApprovalStatus.WITHDRAWN,
          reviewedAt: new Date(),
          decisionReason: english
            ? "Withdrawn: duplicate first-loop packet"
            : "已撤回：重复的首环任务",
        },
      });
    }
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      actor: input.actorName,
      actorType: ActorType.USER,
      actionType: "DIAGNOSTIC_FIRST_LOOP_DUPLICATE_WITHDRAWN",
      targetType: "ActionItem",
      targetId: result.actionItemId,
      summary: english
        ? "Concurrent first-loop packet duplicate withdrawn"
        : "并发重复的首环任务已撤回",
      payload: { diagnosticSessionId: session.id },
    });

    const winner = await db.diagnosticSessionWorkPacket.findUnique({
      where: { diagnosticSessionId: session.id },
    });
    if (!winner) {
      throw error;
    }
    return resolveExistingPacket(winner.actionItemId);
  }

  return {
    actionItemId: result.actionItemId,
    approvalTaskId: result.approvalTaskId,
    created: true,
  };
}
