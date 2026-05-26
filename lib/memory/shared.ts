import { addDays, endOfDay, startOfDay } from "date-fns";
import {
  ActionType,
  ActorType,
  BlockerStatus,
  CommitmentStatus,
  MemoryCorrectionType,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  type Blocker,
  type Commitment,
  type MemoryFact,
} from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { logEvent } from "@/lib/analytics";
import { jsonStringify, safeParseJson } from "@/lib/utils";

export type MemoryActorContext = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
  sourcePage?: string;
  suppressEvolutionRefresh?: boolean;
};

export type ObjectReference = {
  objectType: ObjectType;
  objectId: string;
};

export type TimelineEvent =
  | {
      type: "MEMORY_FACT";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "COMMITMENT";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "BLOCKER";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "MEMORY_CORRECTION";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "MEMORY_ENTRY";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "MEETING";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "ACTION";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "APPROVAL";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    }
  | {
      type: "EMAIL_THREAD";
      id: string;
      title: string;
      occurredAt: Date;
      status: string;
      sourceLabel: string;
    };

export function successResponse<T>(data: T, message = "ok") {
  return Response.json({ success: true, data, message });
}

export function errorResponse(message: string, errorCode = "INVALID_REQUEST", status = 400) {
  return Response.json(
    {
      success: false,
      errorCode,
      message,
    },
    { status },
  );
}

export function splitIntoSentences(...values: Array<string | null | undefined>) {
  const source = values
    .filter(Boolean)
    .join("\n")
    .split(/[\n。！？]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(source));
}

export function parseDueDateHint(baseDate: Date, text: string) {
  const normalized = text.replace(/\s+/g, "");

  if (/下周三前|下周三/.test(normalized)) {
    const start = startOfDay(baseDate);
    const day = start.getDay();
    const delta = ((3 - day + 7) % 7 || 7) + 7;
    return endOfDay(addDays(start, delta));
  }

  if (/48小时内/.test(normalized)) {
    return addDays(baseDate, 2);
  }

  if (/两天内|2天内/.test(normalized)) {
    return endOfDay(addDays(baseDate, 2));
  }

  if (/今日内|今天内/.test(normalized)) {
    return endOfDay(baseDate);
  }

  if (/本周内/.test(normalized)) {
    return endOfDay(addDays(baseDate, 4));
  }

  if (/尽快|尽早|24小时内/.test(normalized)) {
    return addDays(baseDate, 1);
  }

  return null;
}

export function inferFactType(text: string): MemoryFactType {
  if (/偏好|更关心|更愿意|喜欢/.test(text)) return MemoryFactType.PREFERENCE;
  if (/支持|认可|积极|champion|愿意推进/i.test(text)) return MemoryFactType.RELATIONSHIP;
  if (/风险|回复变慢|预算|担心|顾虑|冲突|卡住|阻塞/.test(text)) return MemoryFactType.RISK_SIGNAL;
  if (/下周|发送|安排|跟进|同步|确认|下一步|需要/.test(text)) return MemoryFactType.NEXT_STEP;
  return MemoryFactType.SUMMARY;
}

export function inferObjectTypeFromContext(args: {
  preferred?: ObjectType;
  text: string;
  hasOpportunity: boolean;
  hasContact: boolean;
  hasCompany: boolean;
}) {
  if (args.preferred) return args.preferred;
  if (/预算|付款|交付|方案|试点|候选人|面试|合作/.test(args.text)) {
    if (args.hasOpportunity) return ObjectType.OPPORTUNITY;
  }
  if (/对方|联系人|候选人|采购|总监|创始人/.test(args.text) && args.hasContact) {
    return ObjectType.CONTACT;
  }
  if (/内部|资源|排期|法务|公司/.test(args.text) && args.hasCompany) {
    return ObjectType.COMPANY;
  }
  return ObjectType.MEETING;
}

export async function writeMemoryAuditAndEvent(args: MemoryActorContext & {
  actionType: string;
  targetType: string;
  targetId: string;
  summary: string;
  eventName: string;
  eventCategory: string;
  metadata?: unknown;
}) {
  await writeAuditLog({
    workspaceId: args.workspaceId,
    userId: args.actorUserId,
    actor: args.actorName,
    actorType: args.actorType ?? ActorType.SYSTEM,
    actionType: args.actionType,
    targetType: args.targetType,
    targetId: args.targetId,
    summary: args.summary,
    payload: args.metadata,
    sourcePage: args.sourcePage,
  });

  await logEvent({
    workspaceId: args.workspaceId,
    userId: args.actorUserId ?? undefined,
    eventName: args.eventName,
    eventCategory: args.eventCategory,
    targetType: args.targetType,
    targetId: args.targetId,
    metadata: (args.metadata ?? {}) as Record<string, unknown>,
    sourcePage: args.sourcePage,
  });
}

export function serializeIds(items: Array<{ id: string }>) {
  return jsonStringify(items.map((item) => item.id));
}

export function deserializeIds(value?: string | null) {
  return safeParseJson<string[]>(value, []);
}

export function deriveCommitmentStatus(input: { dueDate?: Date | null; status?: CommitmentStatus }) {
  if (input.status === CommitmentStatus.FULFILLED || input.status === CommitmentStatus.CANCELED) {
    return input.status;
  }

  if (input.dueDate && input.dueDate.getTime() < Date.now()) {
    return CommitmentStatus.OVERDUE;
  }

  if (input.status === CommitmentStatus.IN_PROGRESS) {
    return CommitmentStatus.IN_PROGRESS;
  }

  return CommitmentStatus.OPEN;
}

export function deriveOverdueFlag(input: { dueDate?: Date | null; status?: CommitmentStatus }) {
  return deriveCommitmentStatus(input) === CommitmentStatus.OVERDUE;
}

export function blockerSeverityTone(severity: number) {
  if (severity >= 80) return "高风险";
  if (severity >= 60) return "中高风险";
  if (severity >= 40) return "需关注";
  return "轻度阻塞";
}

export async function getObjectExists(workspaceId: string, objectType: ObjectType, objectId: string) {
  switch (objectType) {
    case ObjectType.CONTACT:
      return Boolean(await db.contact.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.COMPANY:
      return Boolean(await db.company.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.OPPORTUNITY:
      return Boolean(await db.opportunity.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.MEETING:
      return Boolean(await db.meeting.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.ACTION_ITEM:
      return Boolean(await db.actionItem.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.APPROVAL_TASK:
      return Boolean(await db.approvalTask.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.POLICY_RULE:
      return Boolean(await db.policyRule.findFirst({ where: { workspaceId, id: objectId } }));
    case ObjectType.EMAIL_THREAD:
      return Boolean(await db.emailThread.findFirst({ where: { workspaceId, id: objectId } }));
    default:
      return false;
  }
}

export function isFactRelevant(fact: Pick<MemoryFact, "status">) {
  return fact.status === MemoryStatus.ACTIVE || fact.status === MemoryStatus.OBSERVED;
}

export function isBlockerActive(blocker: Pick<Blocker, "status">) {
  return blocker.status === BlockerStatus.OPEN || blocker.status === BlockerStatus.MONITORING;
}

export function isCommitmentOpen(commitment: Pick<Commitment, "status">) {
  return (
    commitment.status === CommitmentStatus.OPEN ||
    commitment.status === CommitmentStatus.IN_PROGRESS ||
    commitment.status === CommitmentStatus.OVERDUE
  );
}

export function toMemoryCorrectionPayload(input: { beforeValue?: unknown; afterValue?: unknown; reason?: string | null; correctionType: MemoryCorrectionType }) {
  return {
    correctionType: input.correctionType,
    beforeValue: input.beforeValue,
    afterValue: input.afterValue,
    reason: input.reason ?? null,
  };
}

export function recommendationActionTypeForObject(objectType: ObjectType, text: string) {
  if (objectType === ObjectType.CONTACT || /发送|回复|邮件|消息/.test(text)) {
    return ActionType.DRAFT_EXTERNAL_EMAIL;
  }

  if (objectType === ObjectType.MEETING || /会议|约/.test(text)) {
    return ActionType.CREATE_MEETING;
  }

  if (/阶段|推进/.test(text)) {
    return ActionType.UPDATE_OPPORTUNITY_STAGE;
  }

  return ActionType.CREATE_TASK;
}
