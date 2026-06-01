import type {
  HelmV21HandoffPayloadSkeleton,
  HelmV21InterruptReason,
  HelmV21ResumeAsk,
  HelmV21RuntimePostureSnapshot,
  HelmV21RunThreadContract,
} from "@/lib/helm-v2/contracts";
import { trimText } from "@/lib/utils";

export function buildRuntimePostureSnapshot(input: {
  runThread: HelmV21RunThreadContract;
  interruptReason: HelmV21InterruptReason;
  resumeAsk: HelmV21ResumeAsk;
  handoffPayload: HelmV21HandoffPayloadSkeleton;
}): HelmV21RuntimePostureSnapshot {
  return {
    runThread: {
      runId: input.runThread.runId,
      threadId: input.runThread.threadId,
      lifecycle: input.runThread.lifecycle,
      checkpointKey: input.runThread.latestCheckpoint?.checkpointKey ?? null,
      resumeState: input.runThread.resume.state,
      resumeToken: input.runThread.resume.resumeToken,
      humanInputCheckpointState: input.runThread.humanInputCheckpoint.state,
    },
    interruptReason: {
      state: input.interruptReason.state,
      code: input.interruptReason.code,
      source: input.interruptReason.source,
    },
    resumeAsk: {
      mode: input.resumeAsk.mode,
      checkpointKey: input.resumeAsk.checkpointKey,
      resumeToken: input.resumeAsk.resumeToken,
    },
    handoffPayload: {
      state: input.handoffPayload.state,
      handoffId: input.handoffPayload.handoffId,
      packetKey: input.handoffPayload.packetKey,
      fromAgent: input.handoffPayload.fromAgent,
      toAgent: input.handoffPayload.toAgent,
      checkpointKey: input.handoffPayload.checkpointKey,
      approvalTier: input.handoffPayload.approvalTier,
    },
  };
}

export function formatRuntimePostureSnapshotSummary(input: HelmV21RuntimePostureSnapshot) {
  return [
    input.interruptReason.code === "none"
      ? "interrupt clear"
      : `interrupt ${input.interruptReason.code}`,
    `resume ${input.resumeAsk.mode}`,
    input.handoffPayload.state === "ready"
      ? `handoff ${input.handoffPayload.toAgent ?? "ready"}`
      : "handoff none",
  ].join(" · ");
}

type RuntimeExecutionContext = {
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
};

type RuntimeRunThreadHumanExecutionInput = {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  status: string;
  executionAcknowledgementStatus: string;
  executionIntent: string;
  executionOwnerName: string | null;
  followThroughStatus: string | null;
  executedAt: Date | null;
  updatedAt: Date;
};

type RuntimeRunThreadOfficialWriteInput = {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  writeActionType: string;
  officialObjectRef: string;
  writeExecutionStatus: string;
  writeAcknowledgementStatus: string;
  acknowledgedAt: Date | null;
  updatedAt: Date;
};

type RuntimeRunThreadLimitedAutoInput = {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  limitedAutoActionType: string;
  officialObjectRef: string;
  limitedAutoExecutionStatus: string;
  limitedAutoAckStatus: string;
  acknowledgedAt: Date | null;
  updatedAt: Date;
};

type RuntimeRunThreadOfficialFollowThroughInput = {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  followThroughStatus: string;
  followThroughResolutionStatus: string;
  followThroughSummary: string | null;
  followThroughNextAction: string | null;
  updatedAt: Date;
};

type RuntimeTakeoverEventBase = {
  id: string;
  action?: string | null;
  summary?: string | null;
  checkpointKey?: string | null;
  createdAt: Date;
};

type RuntimeTakeoverRequestLifecycleEvent = RuntimeTakeoverEventBase & {
  requestedBy?: string | null;
};

type RuntimeTakeoverAcknowledgementLifecycleEvent = RuntimeTakeoverEventBase & {
  acknowledgedBy?: string | null;
};

type RuntimeTakeoverStartedLifecycleEvent = RuntimeTakeoverEventBase & {
  startedBy?: string | null;
};

type RuntimeTakeoverReleasedLifecycleEvent = RuntimeTakeoverEventBase & {
  releasedBy?: string | null;
};

type RuntimeTakeoverFollowThroughRequestLifecycleEvent = RuntimeTakeoverEventBase & {
  requestedBy?: string | null;
};

type RuntimeTakeoverFollowThroughResolvedLifecycleEvent = RuntimeTakeoverEventBase & {
  resolvedBy?: string | null;
};

type RuntimeHumanInputLifecycleEvent = {
  id: string;
  summary?: string | null;
  checkpointKey?: string | null;
  createdAt: Date;
};

type RuntimeHumanInputRequestLifecycleEvent = RuntimeHumanInputLifecycleEvent & {
  requestedBy?: string | null;
};

type RuntimeHumanInputAcknowledgementLifecycleEvent = RuntimeHumanInputLifecycleEvent & {
  acknowledgedBy?: string | null;
};

type RuntimeThreadLifecycleEventBase = {
  id: string;
  summary?: string | null;
  checkpointId?: string | null;
  checkpointKey?: string | null;
  resumeToken?: string | null;
  nextAction?: string | null;
  sourcePage?: string | null;
  createdAt: Date;
};

type RuntimeSettlementReviewRequestedLifecycleEvent = RuntimeThreadLifecycleEventBase & {
  requestedBy?: string | null;
};

type RuntimeSettlementReviewResolvedLifecycleEvent = RuntimeThreadLifecycleEventBase & {
  resolvedBy?: string | null;
};

type RuntimeCloseoutConfirmedLifecycleEvent = RuntimeThreadLifecycleEventBase & {
  confirmedBy?: string | null;
  settlementReviewResolutionEventId?: string | null;
};

type RuntimeCloseoutRefreshRequestedLifecycleEvent = RuntimeThreadLifecycleEventBase & {
  requestedBy?: string | null;
  confirmationEventId?: string | null;
};

type RuntimeCloseoutResolutionRecordedLifecycleEvent = RuntimeThreadLifecycleEventBase & {
  decision: "close_thread" | "keep_open";
  resolvedBy?: string | null;
  closeoutConfirmationEventId?: string | null;
  closeoutRefreshEventId?: string | null;
};

type RuntimeCloseoutResolutionFollowThroughRequestedLifecycleEvent =
  RuntimeThreadLifecycleEventBase & {
    decision: "close_thread" | "keep_open";
    requestedBy?: string | null;
    closeoutResolutionEventId?: string | null;
  };

type RuntimeCloseoutResolutionFollowThroughResolvedLifecycleEvent =
  RuntimeThreadLifecycleEventBase & {
    decision: "close_thread" | "keep_open";
    resolvedBy?: string | null;
    requestEventId?: string | null;
    closeoutResolutionEventId?: string | null;
  };

type RuntimeCloseRequestRequestedLifecycleEvent = RuntimeThreadLifecycleEventBase & {
  requestedBy?: string | null;
  closeoutResolutionEventId?: string | null;
  closeoutResolutionFollowThroughEventId?: string | null;
};

function sortEntriesByTimestampDesc<T extends { timestamp: Date }>(entries: T[]) {
  return entries.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
}

function matchesRuntimeExecutionContext(
  anchor: RuntimeExecutionContext,
  candidate: RuntimeExecutionContext,
) {
  if (!anchor.meetingId || anchor.meetingId !== candidate.meetingId) return false;
  if (anchor.opportunityId && candidate.opportunityId && anchor.opportunityId !== candidate.opportunityId) {
    return false;
  }
  if (anchor.companyId && candidate.companyId && anchor.companyId !== candidate.companyId) {
    return false;
  }
  return true;
}

export function buildRunThreadResultAcknowledgementInputs(input: {
  context: RuntimeExecutionContext;
  humanExecutions: RuntimeRunThreadHumanExecutionInput[];
  officialWriteIntents: RuntimeRunThreadOfficialWriteInput[];
  limitedAutoIntents: RuntimeRunThreadLimitedAutoInput[];
  officialFollowThrough: RuntimeRunThreadOfficialFollowThroughInput[];
}) {
  return sortEntriesByTimestampDesc([
    ...input.humanExecutions
      .filter((item) => matchesRuntimeExecutionContext(input.context, item))
      .map((item) => ({
        id: item.id,
        source: "human_execution" as const,
        state:
          item.executionAcknowledgementStatus === "ACKNOWLEDGED"
            ? ("acknowledged" as const)
            : item.executionAcknowledgementStatus === "BLOCKED"
              ? ("blocked" as const)
              : item.executionAcknowledgementStatus === "DEFERRED"
                ? ("deferred" as const)
                : ("pending" as const),
        summary: trimText(
          `Human execution ${item.executionAcknowledgementStatus.toLowerCase()} for ${item.executionIntent}.${item.followThroughStatus ? ` Follow-through: ${item.followThroughStatus}.` : ""}${item.executionOwnerName ? ` Owner: ${item.executionOwnerName}.` : ""}`,
          200,
        ),
        timestamp: item.executedAt ?? item.updatedAt,
      })),
    ...input.officialWriteIntents
      .filter((item) => matchesRuntimeExecutionContext(input.context, item))
      .map((item) => ({
        id: item.id,
        source: "official_write" as const,
        state:
          item.writeAcknowledgementStatus === "SUCCESS"
            ? ("acknowledged" as const)
            : item.writeAcknowledgementStatus === "FAILURE"
              ? ("failed" as const)
              : item.writeAcknowledgementStatus === "PENDING"
                ? ("pending" as const)
                : ("deferred" as const),
        summary: trimText(
          `Guarded official write ${item.writeActionType} for ${item.officialObjectRef} is ${item.writeAcknowledgementStatus.toLowerCase().replaceAll("_", " ")} while execution posture is ${item.writeExecutionStatus.toLowerCase().replaceAll("_", " ")}.`,
          200,
        ),
        timestamp: item.acknowledgedAt ?? item.updatedAt,
      })),
    ...input.limitedAutoIntents
      .filter((item) => matchesRuntimeExecutionContext(input.context, item))
      .map((item) => ({
        id: item.id,
        source: "limited_auto" as const,
        state:
          item.limitedAutoAckStatus === "SUCCESS"
            ? ("acknowledged" as const)
            : item.limitedAutoAckStatus === "FAILURE"
              ? ("failed" as const)
              : item.limitedAutoAckStatus === "PENDING"
                ? ("pending" as const)
                : ("deferred" as const),
        summary: trimText(
          `Limited auto ${item.limitedAutoActionType} for ${item.officialObjectRef} is ${item.limitedAutoAckStatus.toLowerCase().replaceAll("_", " ")} while execution posture is ${item.limitedAutoExecutionStatus.toLowerCase().replaceAll("_", " ")}.`,
          200,
        ),
        timestamp: item.acknowledgedAt ?? item.updatedAt,
      })),
    ...input.officialFollowThrough
      .filter((item) => matchesRuntimeExecutionContext(input.context, item))
      .map((item) => ({
        id: item.id,
        source: "official_followthrough" as const,
        state: ["RESOLVED", "CLOSED_NO_CHANGE"].includes(item.followThroughResolutionStatus)
          ? ("follow_through_resolved" as const)
          : ("follow_through_open" as const),
        summary: trimText(
          item.followThroughSummary?.trim() ||
            `Official follow-through is ${item.followThroughStatus.toLowerCase().replaceAll("_", " ")}${item.followThroughNextAction ? ` and next action is ${item.followThroughNextAction}.` : "."}`,
          200,
        ),
        timestamp: item.updatedAt,
      })),
  ]);
}

export function buildRunThreadRequestLifecycleInputs(input: {
  takeoverRequestEvent: RuntimeTakeoverRequestLifecycleEvent | null;
  takeoverAcknowledgementEvent: RuntimeTakeoverAcknowledgementLifecycleEvent | null;
  takeoverStartedEvent: RuntimeTakeoverStartedLifecycleEvent | null;
  takeoverReleasedEvent: RuntimeTakeoverReleasedLifecycleEvent | null;
  takeoverFollowThroughRequestEvent: RuntimeTakeoverFollowThroughRequestLifecycleEvent | null;
  takeoverFollowThroughResolvedEvent: RuntimeTakeoverFollowThroughResolvedLifecycleEvent | null;
  humanInputRequestEvent: RuntimeHumanInputRequestLifecycleEvent | null;
  humanInputAcknowledgementEvent: RuntimeHumanInputAcknowledgementLifecycleEvent | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.takeoverRequestEvent
      ? [
          {
            id: input.takeoverRequestEvent.id,
            kind: "takeover_requested" as const,
            label: `takeover requested · ${input.takeoverRequestEvent.action}`,
            summary: trimText(
              input.takeoverRequestEvent.summary ||
                `Operator takeover request recorded for ${input.takeoverRequestEvent.action} on ${input.takeoverRequestEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.takeoverRequestEvent.requestedBy ?? null,
            checkpointKey: input.takeoverRequestEvent.checkpointKey ?? null,
            timestamp: input.takeoverRequestEvent.createdAt,
          },
        ]
      : []),
    ...(input.takeoverAcknowledgementEvent
      ? [
          {
            id: input.takeoverAcknowledgementEvent.id,
            kind: "takeover_request_acknowledged" as const,
            label: `takeover acknowledged · ${input.takeoverAcknowledgementEvent.action}`,
            summary: trimText(
              input.takeoverAcknowledgementEvent.summary ||
                `Operator takeover acknowledgement recorded for ${input.takeoverAcknowledgementEvent.action} on ${input.takeoverAcknowledgementEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.takeoverAcknowledgementEvent.acknowledgedBy ?? null,
            checkpointKey: input.takeoverAcknowledgementEvent.checkpointKey ?? null,
            timestamp: input.takeoverAcknowledgementEvent.createdAt,
          },
        ]
      : []),
    ...(input.takeoverStartedEvent
      ? [
          {
            id: input.takeoverStartedEvent.id,
            kind: "takeover_active" as const,
            label: `takeover active · ${input.takeoverStartedEvent.action}`,
            summary: trimText(
              input.takeoverStartedEvent.summary ||
                `Operator takeover started for ${input.takeoverStartedEvent.action} on ${input.takeoverStartedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.takeoverStartedEvent.startedBy ?? null,
            checkpointKey: input.takeoverStartedEvent.checkpointKey ?? null,
            timestamp: input.takeoverStartedEvent.createdAt,
          },
        ]
      : []),
    ...(input.takeoverReleasedEvent
      ? [
          {
            id: input.takeoverReleasedEvent.id,
            kind: "takeover_released" as const,
            label: `takeover released · ${input.takeoverReleasedEvent.action}`,
            summary: trimText(
              input.takeoverReleasedEvent.summary ||
                `Operator takeover released for ${input.takeoverReleasedEvent.action} on ${input.takeoverReleasedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.takeoverReleasedEvent.releasedBy ?? null,
            checkpointKey: input.takeoverReleasedEvent.checkpointKey ?? null,
            timestamp: input.takeoverReleasedEvent.createdAt,
          },
        ]
      : []),
    ...(input.takeoverFollowThroughRequestEvent
      ? [
          {
            id: input.takeoverFollowThroughRequestEvent.id,
            kind: "takeover_followthrough_requested" as const,
            label: `takeover follow-through requested · ${input.takeoverFollowThroughRequestEvent.action}`,
            summary: trimText(
              input.takeoverFollowThroughRequestEvent.summary ||
                `Operator takeover follow-through requested for ${input.takeoverFollowThroughRequestEvent.action} on ${input.takeoverFollowThroughRequestEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.takeoverFollowThroughRequestEvent.requestedBy ?? null,
            checkpointKey: input.takeoverFollowThroughRequestEvent.checkpointKey ?? null,
            timestamp: input.takeoverFollowThroughRequestEvent.createdAt,
          },
        ]
      : []),
    ...(input.takeoverFollowThroughResolvedEvent
      ? [
          {
            id: input.takeoverFollowThroughResolvedEvent.id,
            kind: "takeover_followthrough_resolved" as const,
            label: `takeover follow-through resolved · ${input.takeoverFollowThroughResolvedEvent.action}`,
            summary: trimText(
              input.takeoverFollowThroughResolvedEvent.summary ||
                `Operator takeover follow-through resolved for ${input.takeoverFollowThroughResolvedEvent.action} on ${input.takeoverFollowThroughResolvedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.takeoverFollowThroughResolvedEvent.resolvedBy ?? null,
            checkpointKey: input.takeoverFollowThroughResolvedEvent.checkpointKey ?? null,
            timestamp: input.takeoverFollowThroughResolvedEvent.createdAt,
          },
        ]
      : []),
    ...(input.humanInputRequestEvent
      ? [
          {
            id: input.humanInputRequestEvent.id,
            kind: "human_input_requested" as const,
            label: "human input requested",
            summary: trimText(
              input.humanInputRequestEvent.summary ||
                `Human input checkpoint request recorded for ${input.humanInputRequestEvent.checkpointKey ?? "the current checkpoint anchor"}.`,
              220,
            ),
            actorName: input.humanInputRequestEvent.requestedBy ?? null,
            checkpointKey: input.humanInputRequestEvent.checkpointKey ?? null,
            timestamp: input.humanInputRequestEvent.createdAt,
          },
        ]
      : []),
    ...(input.humanInputAcknowledgementEvent
      ? [
          {
            id: input.humanInputAcknowledgementEvent.id,
            kind: "human_input_request_acknowledged" as const,
            label: "human input acknowledged",
            summary: trimText(
              input.humanInputAcknowledgementEvent.summary ||
                `Human input checkpoint acknowledgement recorded for ${input.humanInputAcknowledgementEvent.checkpointKey ?? "the current checkpoint anchor"}.`,
              220,
            ),
            actorName: input.humanInputAcknowledgementEvent.acknowledgedBy ?? null,
            checkpointKey: input.humanInputAcknowledgementEvent.checkpointKey ?? null,
            timestamp: input.humanInputAcknowledgementEvent.createdAt,
          },
        ]
      : []),
  ]);
}

export function buildRunThreadSettlementLifecycleInputs(input: {
  settlementReviewRequestedEvent: RuntimeSettlementReviewRequestedLifecycleEvent | null;
  settlementReviewResolvedEvent: RuntimeSettlementReviewResolvedLifecycleEvent | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.settlementReviewRequestedEvent
      ? [
          {
            id: input.settlementReviewRequestedEvent.id,
            kind: "settlement_review_requested" as const,
            summary: trimText(
              input.settlementReviewRequestedEvent.summary ||
                `Settlement review requested for ${input.settlementReviewRequestedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.settlementReviewRequestedEvent.requestedBy ?? null,
            checkpointId: input.settlementReviewRequestedEvent.checkpointId ?? null,
            checkpointKey: input.settlementReviewRequestedEvent.checkpointKey ?? null,
            resumeToken: input.settlementReviewRequestedEvent.resumeToken ?? null,
            nextAction: input.settlementReviewRequestedEvent.nextAction ?? null,
            sourcePage: input.settlementReviewRequestedEvent.sourcePage ?? null,
            timestamp: input.settlementReviewRequestedEvent.createdAt,
          },
        ]
      : []),
    ...(input.settlementReviewResolvedEvent
      ? [
          {
            id: input.settlementReviewResolvedEvent.id,
            kind: "settlement_review_resolved" as const,
            summary: trimText(
              input.settlementReviewResolvedEvent.summary ||
                `Settlement review resolved for ${input.settlementReviewResolvedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.settlementReviewResolvedEvent.resolvedBy ?? null,
            checkpointId: input.settlementReviewResolvedEvent.checkpointId ?? null,
            checkpointKey: input.settlementReviewResolvedEvent.checkpointKey ?? null,
            resumeToken: input.settlementReviewResolvedEvent.resumeToken ?? null,
            nextAction: input.settlementReviewResolvedEvent.nextAction ?? null,
            sourcePage: input.settlementReviewResolvedEvent.sourcePage ?? null,
            timestamp: input.settlementReviewResolvedEvent.createdAt,
          },
        ]
      : []),
  ]);
}

export function buildRunThreadCloseoutConfirmationLifecycleInputs(input: {
  closeoutConfirmedEvent: RuntimeCloseoutConfirmedLifecycleEvent | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.closeoutConfirmedEvent
      ? [
          {
            id: input.closeoutConfirmedEvent.id,
            kind: "closeout_confirmed" as const,
            summary: trimText(
              input.closeoutConfirmedEvent.summary ||
                `Closeout truth confirmed for ${input.closeoutConfirmedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.closeoutConfirmedEvent.confirmedBy ?? null,
            settlementReviewResolutionEventId:
              input.closeoutConfirmedEvent.settlementReviewResolutionEventId ?? null,
            checkpointId: input.closeoutConfirmedEvent.checkpointId ?? null,
            checkpointKey: input.closeoutConfirmedEvent.checkpointKey ?? null,
            resumeToken: input.closeoutConfirmedEvent.resumeToken ?? null,
            nextAction: input.closeoutConfirmedEvent.nextAction ?? null,
            sourcePage: input.closeoutConfirmedEvent.sourcePage ?? null,
            timestamp: input.closeoutConfirmedEvent.createdAt,
          },
        ]
      : []),
  ]);
}

export function buildRunThreadCloseoutRefreshLifecycleInputs(input: {
  closeoutRefreshRequestedEvent: RuntimeCloseoutRefreshRequestedLifecycleEvent | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.closeoutRefreshRequestedEvent
      ? [
          {
            id: input.closeoutRefreshRequestedEvent.id,
            kind: "closeout_refresh_requested" as const,
            summary: trimText(
              input.closeoutRefreshRequestedEvent.summary ||
                `Closeout refresh requested for ${input.closeoutRefreshRequestedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.closeoutRefreshRequestedEvent.requestedBy ?? null,
            confirmationEventId: input.closeoutRefreshRequestedEvent.confirmationEventId ?? null,
            checkpointId: input.closeoutRefreshRequestedEvent.checkpointId ?? null,
            checkpointKey: input.closeoutRefreshRequestedEvent.checkpointKey ?? null,
            resumeToken: input.closeoutRefreshRequestedEvent.resumeToken ?? null,
            nextAction: input.closeoutRefreshRequestedEvent.nextAction ?? null,
            sourcePage: input.closeoutRefreshRequestedEvent.sourcePage ?? null,
            timestamp: input.closeoutRefreshRequestedEvent.createdAt,
          },
        ]
      : []),
  ]);
}

export function buildRunThreadCloseoutResolutionLifecycleInputs(input: {
  closeoutResolutionRecordedEvent: RuntimeCloseoutResolutionRecordedLifecycleEvent | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.closeoutResolutionRecordedEvent
      ? [
          {
            id: input.closeoutResolutionRecordedEvent.id,
            kind: "closeout_resolution_recorded" as const,
            decision: input.closeoutResolutionRecordedEvent.decision,
            summary: trimText(
              input.closeoutResolutionRecordedEvent.summary ||
                (input.closeoutResolutionRecordedEvent.decision === "close_thread"
                  ? `Close-thread resolution recorded for ${input.closeoutResolutionRecordedEvent.checkpointKey ?? "the current thread anchor"}.`
                  : `Keep-open resolution recorded for ${input.closeoutResolutionRecordedEvent.checkpointKey ?? "the current thread anchor"}.`),
              220,
            ),
            actorName: input.closeoutResolutionRecordedEvent.resolvedBy ?? null,
            closeoutConfirmationEventId:
              input.closeoutResolutionRecordedEvent.closeoutConfirmationEventId ?? null,
            closeoutRefreshEventId:
              input.closeoutResolutionRecordedEvent.closeoutRefreshEventId ?? null,
            checkpointId: input.closeoutResolutionRecordedEvent.checkpointId ?? null,
            checkpointKey: input.closeoutResolutionRecordedEvent.checkpointKey ?? null,
            resumeToken: input.closeoutResolutionRecordedEvent.resumeToken ?? null,
            nextAction: input.closeoutResolutionRecordedEvent.nextAction ?? null,
            sourcePage: input.closeoutResolutionRecordedEvent.sourcePage ?? null,
            timestamp: input.closeoutResolutionRecordedEvent.createdAt,
          },
        ]
      : []),
  ]);
}

export function buildRunThreadCloseoutResolutionFollowThroughLifecycleInputs(input: {
  closeoutResolutionFollowThroughRequestedEvent:
    | RuntimeCloseoutResolutionFollowThroughRequestedLifecycleEvent
    | null;
  closeoutResolutionFollowThroughResolvedEvent:
    | RuntimeCloseoutResolutionFollowThroughResolvedLifecycleEvent
    | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.closeoutResolutionFollowThroughRequestedEvent
      ? [
          {
            id: input.closeoutResolutionFollowThroughRequestedEvent.id,
            kind: "closeout_resolution_followthrough_requested" as const,
            decision: input.closeoutResolutionFollowThroughRequestedEvent.decision,
            summary: trimText(
              input.closeoutResolutionFollowThroughRequestedEvent.summary ||
                (input.closeoutResolutionFollowThroughRequestedEvent.decision === "close_thread"
                  ? `Close-thread follow-through requested for ${input.closeoutResolutionFollowThroughRequestedEvent.checkpointKey ?? "the current thread anchor"}.`
                  : `Keep-open follow-through requested for ${input.closeoutResolutionFollowThroughRequestedEvent.checkpointKey ?? "the current thread anchor"}.`),
              220,
            ),
            actorName: input.closeoutResolutionFollowThroughRequestedEvent.requestedBy ?? null,
            closeoutResolutionEventId:
              input.closeoutResolutionFollowThroughRequestedEvent.closeoutResolutionEventId ?? null,
            checkpointId: input.closeoutResolutionFollowThroughRequestedEvent.checkpointId ?? null,
            checkpointKey: input.closeoutResolutionFollowThroughRequestedEvent.checkpointKey ?? null,
            resumeToken: input.closeoutResolutionFollowThroughRequestedEvent.resumeToken ?? null,
            nextAction: input.closeoutResolutionFollowThroughRequestedEvent.nextAction ?? null,
            sourcePage: input.closeoutResolutionFollowThroughRequestedEvent.sourcePage ?? null,
            timestamp: input.closeoutResolutionFollowThroughRequestedEvent.createdAt,
          },
        ]
      : []),
    ...(input.closeoutResolutionFollowThroughResolvedEvent
      ? [
          {
            id: input.closeoutResolutionFollowThroughResolvedEvent.id,
            kind: "closeout_resolution_followthrough_resolved" as const,
            decision: input.closeoutResolutionFollowThroughResolvedEvent.decision,
            summary: trimText(
              input.closeoutResolutionFollowThroughResolvedEvent.summary ||
                (input.closeoutResolutionFollowThroughResolvedEvent.decision === "close_thread"
                  ? `Close-thread follow-through resolved for ${input.closeoutResolutionFollowThroughResolvedEvent.checkpointKey ?? "the current thread anchor"}.`
                  : `Keep-open follow-through resolved for ${input.closeoutResolutionFollowThroughResolvedEvent.checkpointKey ?? "the current thread anchor"}.`),
              220,
            ),
            actorName: input.closeoutResolutionFollowThroughResolvedEvent.resolvedBy ?? null,
            requestEventId:
              input.closeoutResolutionFollowThroughResolvedEvent.requestEventId ?? null,
            closeoutResolutionEventId:
              input.closeoutResolutionFollowThroughResolvedEvent.closeoutResolutionEventId ?? null,
            checkpointId: input.closeoutResolutionFollowThroughResolvedEvent.checkpointId ?? null,
            checkpointKey: input.closeoutResolutionFollowThroughResolvedEvent.checkpointKey ?? null,
            resumeToken: input.closeoutResolutionFollowThroughResolvedEvent.resumeToken ?? null,
            nextAction: input.closeoutResolutionFollowThroughResolvedEvent.nextAction ?? null,
            sourcePage: input.closeoutResolutionFollowThroughResolvedEvent.sourcePage ?? null,
            timestamp: input.closeoutResolutionFollowThroughResolvedEvent.createdAt,
          },
        ]
      : []),
  ]);
}

export function buildRunThreadCloseRequestLifecycleInputs(input: {
  closeRequestRequestedEvent: RuntimeCloseRequestRequestedLifecycleEvent | null;
}) {
  return sortEntriesByTimestampDesc([
    ...(input.closeRequestRequestedEvent
      ? [
          {
            id: input.closeRequestRequestedEvent.id,
            kind: "close_request_requested" as const,
            summary: trimText(
              input.closeRequestRequestedEvent.summary ||
                `Explicit runtime close requested for ${input.closeRequestRequestedEvent.checkpointKey ?? "the current thread anchor"}.`,
              220,
            ),
            actorName: input.closeRequestRequestedEvent.requestedBy ?? null,
            closeoutResolutionEventId:
              input.closeRequestRequestedEvent.closeoutResolutionEventId ?? null,
            closeoutResolutionFollowThroughEventId:
              input.closeRequestRequestedEvent.closeoutResolutionFollowThroughEventId ?? null,
            checkpointId: input.closeRequestRequestedEvent.checkpointId ?? null,
            checkpointKey: input.closeRequestRequestedEvent.checkpointKey ?? null,
            resumeToken: input.closeRequestRequestedEvent.resumeToken ?? null,
            nextAction: input.closeRequestRequestedEvent.nextAction ?? null,
            sourcePage: input.closeRequestRequestedEvent.sourcePage ?? null,
            timestamp: input.closeRequestRequestedEvent.createdAt,
          },
        ]
      : []),
  ]);
}
