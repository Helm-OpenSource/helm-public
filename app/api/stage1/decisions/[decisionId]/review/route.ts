import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  confirmStage1DecisionRecord,
  dispatchStage1DecisionWorkPacket,
  recordStage1OwnerReviewOutcome,
  Stage1DecisionGateError,
} from "@/lib/stage1-owner-loop/decision-follow-through.service";

const reviewSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    conclusion: z.string().trim().min(3).max(2_000),
    executionTargetRef: z.string().trim().min(3).max(191),
    portfolioRef: z
      .string()
      .trim()
      .min(13)
      .max(203)
      .regex(/^opportunity:[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/u),
    goal: z.string().trim().min(3).max(2_000),
    workAction: z.string().trim().min(3).max(4_000),
    dueAt: z.string().datetime({ offset: true }),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    evidenceRequirements: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    invalidationConditions: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    escalationOwnerRef: z.string().trim().min(3).max(191),
  }).strict(),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(2_000),
  }).strict(),
  z.object({
    action: z.literal("defer"),
    reason: z.string().trim().min(3).max(2_000),
    deferUntil: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    action: z.literal("request_evidence"),
    reason: z.string().trim().min(3).max(2_000),
  }).strict(),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ decisionId: string }> },
) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  if (membership.role !== "OWNER") {
    return Response.json({ errorCode: "OWNER_REQUIRED" }, { status: 403 });
  }
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errorCode: "MALFORMED_REQUEST" }, { status: 400 });
  }
  const { decisionId } = await context.params;
  try {
    if (parsed.data.action !== "approve") {
      const decision = await recordStage1OwnerReviewOutcome({
        workspaceId: workspace.id,
        decisionRecordId: decisionId,
        action: parsed.data.action,
        reason: parsed.data.reason,
        deferUntil:
          parsed.data.action === "defer" ? parsed.data.deferUntil : null,
        actorName: user.name,
        actorUserId: user.id,
      });
      return Response.json({ decisionId: decision.id, status: decision.status });
    }

    const dueAt = new Date(parsed.data.dueAt);
    if (dueAt.getTime() <= Date.now()) {
      return Response.json({ errorCode: "FUTURE_DUE_AT_REQUIRED" }, { status: 400 });
    }
    const decision = await confirmStage1DecisionRecord({
      workspaceId: workspace.id,
      decisionRecordId: decisionId,
      conclusion: parsed.data.conclusion,
      actorName: user.name,
      actorUserId: user.id,
    });
    const packet = await dispatchStage1DecisionWorkPacket({
      workspaceId: workspace.id,
      decisionRecordId: decision.id,
      actorName: user.name,
      actorUserId: user.id,
      command: {
        commandId: `owner-command:${decision.id}`,
        workspaceRef: `workspace:${workspace.id}`,
        decisionRef: decision.id,
        ownerRef: user.id,
        executionTargetRef: parsed.data.executionTargetRef,
        portfolioRef: parsed.data.portfolioRef,
        goal: parsed.data.goal,
        action: parsed.data.workAction,
        dueAt: parsed.data.dueAt,
        acceptanceCriteria: parsed.data.acceptanceCriteria,
        evidenceRequirements: parsed.data.evidenceRequirements,
        invalidationConditions: parsed.data.invalidationConditions,
        escalationOwnerRef: parsed.data.escalationOwnerRef,
        automationLevel: "assist",
        allowedToolRefs: ["qoderwork:draft_proposal_only"],
        externalSideEffects: [],
        policyEnvelopeRef: null,
        status: "owner_confirmed",
      },
    });
    return Response.json({ decisionId: decision.id, status: "DISPATCHED", workPacket: packet });
  } catch (error) {
    if (error instanceof Stage1DecisionGateError) {
      return Response.json(
        { errorCode: "DECISION_GATE_DENIED", reasons: error.reasons },
        { status: error.reasons.includes("decision_not_found") ? 404 : 409 },
      );
    }
    return Response.json({ errorCode: "SAFE_INTERNAL_ERROR" }, { status: 500 });
  }
}
