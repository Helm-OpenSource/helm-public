import type {
  HelmV21OperatorDebuggerRecoveryLifecycleContract,
  HelmV21OperatorDebuggerTakeoverActivation,
  HelmV21OperatorDebuggerTakeoverAssistance,
  HelmV21OperatorDebuggerTakeoverFollowThrough,
  HelmV21OperatorDebuggerTakeoverRequest,
} from "@/lib/helm-v2/contracts";

type HelmV21LatestRemediationHandoff = {
  id: string;
  action: string;
  executionStatus: string;
  summary: string;
  rollbackAnchorSummary: string | null;
  triggeredBy: string | null;
  createdAt: Date;
} | null;

export type HelmV21TakeoverRemediationHandoffReadout = {
  compactSummary: string;
  assistanceSummary: string;
  lifecycleSummary: string;
  requestSummary: string;
  activationSummary: string;
  followThroughSummary: string;
  remediationSummary: string | null;
  provenanceSummary: string | null;
};

function joinParts(parts: Array<string | null>): string | null {
  const value = parts.filter(Boolean).join(" · ");
  return value || null;
}

function summarizeTakeoverRequest(request: HelmV21OperatorDebuggerTakeoverRequest) {
  return (
    joinParts([
      request.summary,
      request.requestedBy ? `requested by ${request.requestedBy}` : null,
      request.acknowledgedBy ? `acknowledged by ${request.acknowledgedBy}` : null,
      request.checkpointKey ? `checkpoint ${request.checkpointKey}` : null,
    ]) ?? request.summary
  );
}

function summarizeTakeoverActivation(activation: HelmV21OperatorDebuggerTakeoverActivation) {
  return (
    joinParts([
      activation.summary,
      activation.currentOwner ? `owner ${activation.currentOwner}` : null,
      activation.startedBy ? `started by ${activation.startedBy}` : null,
      activation.releasedBy ? `released by ${activation.releasedBy}` : null,
      activation.checkpointKey ? `checkpoint ${activation.checkpointKey}` : null,
    ]) ?? activation.summary
  );
}

function summarizeTakeoverFollowThrough(followThrough: HelmV21OperatorDebuggerTakeoverFollowThrough) {
  return (
    joinParts([
      followThrough.summary,
      followThrough.requestedBy ? `requested by ${followThrough.requestedBy}` : null,
      followThrough.resolvedBy ? `resolved by ${followThrough.resolvedBy}` : null,
      followThrough.checkpointKey ? `checkpoint ${followThrough.checkpointKey}` : null,
    ]) ?? followThrough.summary
  );
}

function summarizeLatestRemediation(latestRemediation: HelmV21LatestRemediationHandoff) {
  if (!latestRemediation) return null;
  return (
    joinParts([
      `${latestRemediation.executionStatus} ${latestRemediation.action}`,
      latestRemediation.summary,
      latestRemediation.rollbackAnchorSummary,
    ]) ?? `${latestRemediation.executionStatus} ${latestRemediation.action}`
  );
}

export function buildTakeoverRemediationHandoffReadout(input: {
  takeoverAssistance: HelmV21OperatorDebuggerTakeoverAssistance;
  takeoverRequest: HelmV21OperatorDebuggerTakeoverRequest;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  takeoverFollowThrough: HelmV21OperatorDebuggerTakeoverFollowThrough;
  recoveryLifecycleContract: Pick<
    HelmV21OperatorDebuggerRecoveryLifecycleContract,
    "state" | "driver" | "nextTransition" | "summary"
  >;
  latestRemediation: HelmV21LatestRemediationHandoff;
}): HelmV21TakeoverRemediationHandoffReadout {
  const remediationSummary = summarizeLatestRemediation(input.latestRemediation);
  const provenanceSummary = joinParts([
    input.takeoverRequest.sourcePage ? `request ${input.takeoverRequest.sourcePage}` : null,
    input.takeoverActivation.sourcePage ? `activation ${input.takeoverActivation.sourcePage}` : null,
    input.takeoverFollowThrough.sourcePage
      ? `follow-through ${input.takeoverFollowThrough.sourcePage}`
      : null,
    input.latestRemediation?.triggeredBy ? `remediation ${input.latestRemediation.triggeredBy}` : null,
  ]);

  return {
    compactSummary:
      joinParts([
        `lane ${input.recoveryLifecycleContract.state}`,
        `takeover ${input.takeoverAssistance.posture}`,
        `request ${input.takeoverRequest.state}`,
        `activation ${input.takeoverActivation.state}`,
        `follow-through ${input.takeoverFollowThrough.state}`,
      ]) ??
      `${input.recoveryLifecycleContract.state} · ${input.takeoverAssistance.posture}`,
    assistanceSummary: input.takeoverAssistance.summary,
    lifecycleSummary:
      joinParts([
        input.recoveryLifecycleContract.summary,
        input.recoveryLifecycleContract.driver !== "observe"
          ? `next ${input.recoveryLifecycleContract.nextTransition}`
          : null,
      ]) ?? input.recoveryLifecycleContract.summary,
    requestSummary: summarizeTakeoverRequest(input.takeoverRequest),
    activationSummary: summarizeTakeoverActivation(input.takeoverActivation),
    followThroughSummary: summarizeTakeoverFollowThrough(input.takeoverFollowThrough),
    remediationSummary,
    provenanceSummary,
  };
}
