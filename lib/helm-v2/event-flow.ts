import type {
  HelmV2AgentId,
  HelmV2ApiContract,
  HelmV2EventEnvelope,
  HelmV2EventType,
  HelmV2ObjectRefs,
  HelmV2Writer,
} from "@/lib/helm-v2/contracts";

export const HELM_V2_EVENT_CATALOG: Array<{
  type: HelmV2EventType;
  producer: HelmV2Writer;
  consumers: HelmV2AgentId[];
  summary: string;
}> = [
  {
    type: "meeting.ended",
    producer: "human",
    consumers: ["lead-orchestrator", "meeting-analyst"],
    summary: "会议结束，开始会议到行动的主链路。",
  },
  {
    type: "meeting.facts_created",
    producer: "meeting-analyst",
    consumers: ["lead-orchestrator", "opportunity-judge"],
    summary: "会议事实已结构化，可以进入机会判断。",
  },
  {
    type: "opportunity.delta_created",
    producer: "opportunity-judge",
    consumers: ["lead-orchestrator", "proposal-composer"],
    summary: "机会阴影变化已生成，可继续准备表达物和下一步。",
  },
  {
    type: "followup.requested",
    producer: "human",
    consumers: ["proposal-composer", "comms-scheduler"],
    summary: "请求起草跟进表达物和低风险行动草稿。",
  },
  {
    type: "draft.created",
    producer: "proposal-composer",
    consumers: ["comms-scheduler", "risk-promise-guard"],
    summary: "draft 已形成，需要进入风险与承诺边界检查。",
  },
  {
    type: "approval.requested",
    producer: "risk-promise-guard",
    consumers: ["lead-orchestrator"],
    summary: "高风险或正式系统写入前的审批请求。",
  },
  {
    type: "approval.resolved",
    producer: "human",
    consumers: ["lead-orchestrator", "comms-scheduler"],
    summary: "审批已完成，可继续低风险 draft-only 行动层。",
  },
  {
    type: "handoff.requested",
    producer: "human",
    consumers: ["lead-orchestrator", "handoff-manager"],
    summary: "成交或阶段切换后，请求生成交接 资料。",
  },
  {
    type: "handoff.created",
    producer: "handoff-manager",
    consumers: ["lead-orchestrator"],
    summary: "交接 资料 已生成，可进入交付或 CS 接手面。",
  },
];

export const HELM_V2_PRIMARY_EVENT_FLOW: Array<{
  from: HelmV2EventType;
  to: HelmV2EventType;
}> = [
  { from: "meeting.ended", to: "meeting.facts_created" },
  { from: "meeting.facts_created", to: "opportunity.delta_created" },
  { from: "opportunity.delta_created", to: "followup.requested" },
  { from: "followup.requested", to: "draft.created" },
  { from: "draft.created", to: "approval.requested" },
  { from: "approval.requested", to: "approval.resolved" },
  { from: "approval.resolved", to: "handoff.requested" },
  { from: "handoff.requested", to: "handoff.created" },
];

export const HELM_V2_API_CONTRACTS: HelmV2ApiContract[] = [
  {
    contractKey: "meeting-ended.ingest",
    suggestedPath: "/api/runtime/events/meeting-ended",
    method: "POST",
    description: "摄入会议结束事件，并触发 Meeting Analyst。",
    requestShape: "workspaceId + meetingId + transcriptRef + calendarContext + objectRefs",
    responseShape: "accepted event envelope + execution bundle id",
    approvalTier: "A0",
    plannedOnly: true,
    systemOfRecordWrite: false,
  },
  {
    contractKey: "meeting-facts.confirm",
    suggestedPath: "/api/runtime/memory/meeting-facts/confirm",
    method: "POST",
    description: "人工确认 meeting facts，并触发 object 经营记忆 晋升。",
    requestShape: "meetingId + artifact bundle id + confirmation edits + reviewer",
    responseShape: "confirmed memory refs + next event ids",
    approvalTier: "A1",
    plannedOnly: true,
    systemOfRecordWrite: false,
  },
  {
    contractKey: "opportunity-shadow.update",
    suggestedPath: "/api/runtime/opportunities/shadow-update",
    method: "POST",
    description: "写入阴影阶段 / 阻塞 / 下一步，并生成 主管关注 标记。",
    requestShape: "opportunityId + meeting facts ref + timeline refs + delta proposal",
    responseShape: "shadow delta accepted + artifact refs",
    approvalTier: "A1",
    plannedOnly: true,
    systemOfRecordWrite: false,
  },
  {
    contractKey: "artifact-review.request",
    suggestedPath: "/api/runtime/approvals/artifact-review",
    method: "POST",
    description: "对 draft 制品 发起风险与承诺边界检查和审批请求。",
    requestShape: "artifact refs + action key + policy scope + source provenance",
    responseShape: "risk review + approval requirements + sanitized artifact refs",
    approvalTier: "A2",
    plannedOnly: true,
    systemOfRecordWrite: false,
  },
  {
    contractKey: "handoff-pack.request",
    suggestedPath: "/api/runtime/handoffs/request",
    method: "POST",
    description: "在成交或交接请求后生成交接 资料 和交付 checklist。",
    requestShape: "opportunityId + promised scope refs + risk history refs + target role",
    responseShape: "handoff pack refs + checkpoint memory refs",
    approvalTier: "A2",
    plannedOnly: true,
    systemOfRecordWrite: false,
  },
];

export function buildEventEnvelope<TPayload>(
  input: Omit<HelmV2EventEnvelope<TPayload>, "eventId" | "createdAt"> & {
    eventId?: string;
    createdAt?: string;
  },
): HelmV2EventEnvelope<TPayload> {
  return {
    eventId: input.eventId ?? `evt_${input.type}_${input.workspaceId}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
  };
}

export function buildPrimaryFlowObjectRefs(input: {
  workspaceId: string;
  customerId?: string | null;
  opportunityId?: string | null;
  meetingId?: string | null;
}): HelmV2ObjectRefs {
  return {
    workspaceId: input.workspaceId,
    customerId: input.customerId ?? null,
    opportunityId: input.opportunityId ?? null,
    meetingId: input.meetingId ?? null,
  };
}
