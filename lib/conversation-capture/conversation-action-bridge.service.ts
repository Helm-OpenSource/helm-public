import {
  ActionType,
  OpportunityType,
  RiskLevel,
  SourceType,
  type ActorType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createGovernedAction } from "@/lib/policies/engine";

type ConversationActionBridgeInput = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
  sourcePage?: string;
  captureSessionId: string;
  meetingId: string;
  opportunityId?: string | null;
  contactId?: string | null;
  ownerId?: string | null;
  opportunityType?: OpportunityType | null;
  baseRiskLevel?: RiskLevel;
  candidateActions: string[];
  blockerTitle?: string | null;
  commitmentTitle?: string | null;
};

function mapActionType(
  candidate: string,
  opportunityType?: OpportunityType | null,
) {
  if (/面试|终面|安排下一轮/.test(candidate)) {
    return ActionType.SCHEDULE_INTERVIEW;
  }

  if (/会议|同步会|follow-up/.test(candidate)) {
    return ActionType.CREATE_MEETING;
  }

  if (/纪要|内部|排期|资源|brief/.test(candidate)) {
    return /纪要/.test(candidate)
      ? ActionType.DRAFT_INTERNAL_NOTE
      : ActionType.CREATE_TASK;
  }

  if (/回复|邮件|草稿|方案|反馈|确认/.test(candidate)) {
    return opportunityType === OpportunityType.RECRUITING
      ? ActionType.GENERATE_REPLY_DRAFT
      : ActionType.DRAFT_EXTERNAL_EMAIL;
  }

  if (/阶段|状态/.test(candidate)) {
    return ActionType.UPDATE_OPPORTUNITY_STAGE;
  }

  return ActionType.CREATE_TASK;
}

function inferRiskLevel(candidate: string, baseRiskLevel: RiskLevel) {
  if (/预算|法务|承诺|付款|薪资/.test(candidate)) {
    return RiskLevel.HIGH;
  }

  if (/邮件|反馈|方案|回复/.test(candidate)) {
    return baseRiskLevel === RiskLevel.CRITICAL
      ? RiskLevel.CRITICAL
      : RiskLevel.HIGH;
  }

  return baseRiskLevel;
}

export async function createConversationActions(
  input: ConversationActionBridgeInput,
) {
  const existingTitles = new Set(
    (
      await db.actionItem.findMany({
        where: {
          workspaceId: input.workspaceId,
          sourceType: SourceType.CAPTURE_SESSION,
          sourceId: input.captureSessionId,
        },
        select: {
          title: true,
        },
      })
    ).map((item) => item.title),
  );

  const created = [];

  for (const candidate of input.candidateActions.slice(0, 3)) {
    const title =
      candidate.length > 28 ? `${candidate.slice(0, 28)}...` : candidate;
    if (existingTitles.has(title)) {
      continue;
    }

    created.push(
      await createGovernedAction({
        workspaceId: input.workspaceId,
        actorName: input.actorName,
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        english: input.english,
        actionType: mapActionType(candidate, input.opportunityType),
        title,
        description: candidate,
        aiReason: [
          "该动作来自现场记录后的会话理解链路。",
          input.blockerTitle
            ? `当前最大阻塞：${input.blockerTitle}。`
            : null,
          input.commitmentTitle
            ? `当前最紧的承诺：${input.commitmentTitle}。`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
        draftContent: /邮件|反馈|方案|回复/.test(candidate)
          ? `${candidate}，并在文案里先回应当前卡点。`
          : undefined,
        riskLevel: inferRiskLevel(
          candidate,
          input.baseRiskLevel ?? RiskLevel.MEDIUM,
        ),
        meetingId: input.meetingId,
        opportunityId: input.opportunityId ?? undefined,
        contactId: input.contactId ?? undefined,
        ownerId: input.ownerId ?? undefined,
        sourceType: SourceType.CAPTURE_SESSION,
        sourceId: input.captureSessionId,
        metadata: {
          generatedFrom: "conversation_capture",
          captureSessionId: input.captureSessionId,
          candidateAction: candidate,
        },
        resultPreview:
          "Helm 会按当前策略边界决定是仅建议、进入审批还是自动执行。",
      }),
    );
  }

  return created;
}
