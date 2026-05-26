import type {
  HelmV21OperatorDebuggerReadModel,
  HelmV21OperatorDebuggerRecoveryExecutionContract,
  HelmV21OperatorDebuggerRecoveryExecutionGuardContract,
  HelmV21OperatorDebuggerRecoveryExecutionGuardMove,
  HelmV21OperatorDebuggerRecoveryLifecycleContractTransition,
} from "@/lib/helm-v2/contracts";
import { trimText } from "@/lib/utils";

type RecoveryExecutionGuardInput = Pick<
  HelmV21OperatorDebuggerReadModel,
  | "recoveryExecutionContract"
  | "humanInputRequest"
  | "takeoverRequest"
  | "takeoverActivation"
  | "takeoverFollowThrough"
> & {
  move: HelmV21OperatorDebuggerRecoveryExecutionGuardMove;
};

const BLOCKED_SUMMARY_BY_MOVE: Record<HelmV21OperatorDebuggerRecoveryExecutionGuardMove, string> = {
  request_human_input: "No bounded human input checkpoint request is currently available on this run thread.",
  acknowledge_human_input:
    "No bounded human input checkpoint request is currently waiting for acknowledgement.",
  request_takeover: "No bounded operator takeover request is currently available on this run thread.",
  acknowledge_takeover: "No bounded operator takeover request is currently waiting for acknowledgement.",
  start_takeover: "No acknowledged operator takeover request is currently ready to start.",
  release_takeover: "No active operator takeover is currently running on this run thread.",
  request_followthrough: "No operator takeover follow-through is currently requestable on this run thread.",
  resolve_followthrough: "No operator takeover follow-through is currently open on this run thread.",
};

const EXPECTED_TRANSITION_BY_MOVE: Record<
  HelmV21OperatorDebuggerRecoveryExecutionGuardMove,
  HelmV21OperatorDebuggerRecoveryLifecycleContractTransition
> = {
  request_human_input: "review_recovery",
  acknowledge_human_input: "review_recovery",
  request_takeover: "request_takeover",
  acknowledge_takeover: "acknowledge_takeover",
  start_takeover: "start_takeover",
  release_takeover: "release_takeover",
  request_followthrough: "request_followthrough",
  resolve_followthrough: "resolve_followthrough",
};

const EXPECTED_EXECUTION_STATE_BY_MOVE: Record<
  HelmV21OperatorDebuggerRecoveryExecutionGuardMove,
  HelmV21OperatorDebuggerRecoveryExecutionContract["state"]
> = {
  request_human_input: "review_required",
  acknowledge_human_input: "review_required",
  request_takeover: "executable",
  acknowledge_takeover: "pending",
  start_takeover: "executable",
  release_takeover: "active",
  request_followthrough: "executable",
  resolve_followthrough: "pending",
};

function formatAnchorSummary(
  input: Pick<
    HelmV21OperatorDebuggerRecoveryExecutionContract,
    "anchor" | "checkpointKey"
  >,
) {
  return input.anchor === "none"
    ? "the current thread"
    : `${input.anchor} anchor ${input.checkpointKey ?? "on the current thread"}`;
}

function buildMissingRequirements(input: RecoveryExecutionGuardInput) {
  switch (input.move) {
    case "request_human_input":
      return [
        input.humanInputRequest.prompt ? null : "human input prompt is missing",
        input.humanInputRequest.checkpointKey ? null : "human input checkpoint key is missing",
      ].filter((item): item is string => Boolean(item));
    case "acknowledge_human_input":
      return [
        input.humanInputRequest.prompt ? null : "human input prompt is missing",
        input.humanInputRequest.requestEventId ? null : "human input request event id is missing",
      ].filter((item): item is string => Boolean(item));
    case "request_takeover":
      return input.takeoverRequest.action ? [] : ["takeover request action is missing"];
    case "acknowledge_takeover":
      return [
        input.takeoverRequest.action ? null : "takeover request action is missing",
        input.takeoverRequest.requestEventId ? null : "takeover request event id is missing",
      ].filter((item): item is string => Boolean(item));
    case "start_takeover":
      return [
        input.takeoverRequest.action ? null : "takeover request action is missing",
        input.takeoverRequest.requestEventId ? null : "takeover request event id is missing",
        input.takeoverRequest.acknowledgementEventId
          ? null
          : "takeover acknowledgement event id is missing",
      ].filter((item): item is string => Boolean(item));
    case "release_takeover":
      return [
        input.takeoverActivation.action ? null : "takeover activation action is missing",
        input.takeoverActivation.startEventId ? null : "takeover start event id is missing",
      ].filter((item): item is string => Boolean(item));
    case "request_followthrough":
      return [
        input.takeoverFollowThrough.action ? null : "takeover follow-through action is missing",
        input.takeoverFollowThrough.releaseEventId
          ? null
          : "takeover release event id is missing",
      ].filter((item): item is string => Boolean(item));
    case "resolve_followthrough":
      return [
        input.takeoverFollowThrough.action ? null : "takeover follow-through action is missing",
        input.takeoverFollowThrough.requestEventId
          ? null
          : "takeover follow-through request event id is missing",
      ].filter((item): item is string => Boolean(item));
  }
}

function isReusedMove(input: RecoveryExecutionGuardInput) {
  switch (input.move) {
    case "request_human_input":
      return input.humanInputRequest.state === "requested";
    case "acknowledge_human_input":
      return input.humanInputRequest.state === "acknowledged";
    case "request_takeover":
      return input.takeoverRequest.state === "requested";
    case "acknowledge_takeover":
      return input.takeoverRequest.state === "acknowledged";
    case "start_takeover":
      return input.takeoverActivation.state === "active";
    case "release_takeover":
      return input.takeoverActivation.state === "released";
    case "request_followthrough":
      return (
        input.takeoverFollowThrough.state === "open" ||
        input.takeoverFollowThrough.state === "resolved"
      );
    case "resolve_followthrough":
      return input.takeoverFollowThrough.state === "resolved";
  }
}

function isAllowedMove(input: RecoveryExecutionGuardInput) {
  const expectedTransition = EXPECTED_TRANSITION_BY_MOVE[input.move];
  const expectedExecutionState = EXPECTED_EXECUTION_STATE_BY_MOVE[input.move];
  const executionMatches =
    input.recoveryExecutionContract.state === expectedExecutionState &&
    input.recoveryExecutionContract.currentTransition === expectedTransition;

  if (!executionMatches || buildMissingRequirements(input).length > 0) {
    return false;
  }

  switch (input.move) {
    case "request_human_input":
      return (
        input.recoveryExecutionContract.requiresReview &&
        input.recoveryExecutionContract.anchor === "human_input" &&
        input.humanInputRequest.state === "requestable"
      );
    case "acknowledge_human_input":
      return (
        input.recoveryExecutionContract.requiresReview &&
        input.recoveryExecutionContract.anchor === "human_input" &&
        input.humanInputRequest.state === "requested"
      );
    case "request_takeover":
      return (
        input.recoveryExecutionContract.canExecute &&
        input.takeoverRequest.state === "requestable"
      );
    case "acknowledge_takeover":
      return input.recoveryExecutionContract.canExecute && input.takeoverRequest.state === "requested";
    case "start_takeover":
      return (
        input.recoveryExecutionContract.canExecute &&
        input.takeoverRequest.state === "acknowledged"
      );
    case "release_takeover":
      return input.takeoverActivation.state === "active";
    case "request_followthrough":
      return (
        input.recoveryExecutionContract.canExecute &&
        input.takeoverFollowThrough.state === "requestable"
      );
    case "resolve_followthrough":
      return (
        input.recoveryExecutionContract.canExecute &&
        input.takeoverFollowThrough.state === "open"
      );
  }
}

export function buildOperatorDebuggerRecoveryExecutionGuardContract(
  input: RecoveryExecutionGuardInput,
): HelmV21OperatorDebuggerRecoveryExecutionGuardContract {
  const execution = input.recoveryExecutionContract;
  const expectedTransition = EXPECTED_TRANSITION_BY_MOVE[input.move];
  const anchorSummary = formatAnchorSummary(execution);
  const missingRequirements = buildMissingRequirements(input);
  const action =
    input.takeoverFollowThrough.action ??
    input.takeoverActivation.action ??
    input.takeoverRequest.action ??
    execution.action;
  const checkpointId =
    input.takeoverFollowThrough.checkpointId ??
    input.takeoverActivation.checkpointId ??
    input.takeoverRequest.checkpointId ??
    execution.checkpointId;
  const checkpointKey =
    input.takeoverFollowThrough.checkpointKey ??
    input.takeoverActivation.checkpointKey ??
    input.takeoverRequest.checkpointKey ??
    execution.checkpointKey;
  const resumeToken =
    input.takeoverFollowThrough.resumeToken ??
    input.takeoverActivation.resumeToken ??
    input.takeoverRequest.resumeToken ??
    execution.resumeToken;
  const base = {
    move: input.move,
    driver: execution.driver,
    anchor: execution.anchor,
    action,
    executionState: execution.state,
    currentTransition: execution.currentTransition,
    expectedTransition,
    canExecute: execution.canExecute,
    requiresReview: execution.requiresReview,
    checkpointId,
    checkpointKey,
    resumeToken,
    humanInputRequestState: input.humanInputRequest.state,
    takeoverRequestState: input.takeoverRequest.state,
    takeoverActivationState: input.takeoverActivation.state,
    takeoverFollowThroughState: input.takeoverFollowThrough.state,
    missingRequirements,
    nextAction: execution.nextAction,
    boundaryNote: execution.boundaryNote,
  } satisfies Omit<
    HelmV21OperatorDebuggerRecoveryExecutionGuardContract,
    "state" | "summary" | "reason"
  >;

  if (isReusedMove(input)) {
    return {
      ...base,
      state: "reused",
      summary: trimText(
        `Recovery execution guard reuses ${input.move} on ${anchorSummary}; no new bounded write is required right now.`,
        220,
      ),
      reason: trimText(
        `${input.move} already has a persisted bounded event state. humanInput=${input.humanInputRequest.state}, request=${input.takeoverRequest.state}, activation=${input.takeoverActivation.state}, followThrough=${input.takeoverFollowThrough.state}.`,
        220,
      ),
    };
  }

  if (isAllowedMove(input)) {
    return {
      ...base,
      state: "allowed",
      summary: trimText(
        `Recovery execution guard allows ${input.move} on ${anchorSummary}. Execution truth is ${execution.state}/${execution.currentTransition} and the bounded prerequisites are satisfied.`,
        220,
      ),
      reason: trimText(
        `${input.move} matches ${execution.state}/${execution.currentTransition}. humanInput=${input.humanInputRequest.state}, request=${input.takeoverRequest.state}, activation=${input.takeoverActivation.state}, followThrough=${input.takeoverFollowThrough.state}.`,
        220,
      ),
    };
  }

  return {
    ...base,
    state: "blocked",
    summary: BLOCKED_SUMMARY_BY_MOVE[input.move],
    reason: trimText(
      [
        `Recovery execution guard blocked ${input.move} on ${anchorSummary}.`,
        `Expected ${EXPECTED_EXECUTION_STATE_BY_MOVE[input.move]}/${expectedTransition}, got ${execution.state}/${execution.currentTransition}.`,
        `humanInput=${input.humanInputRequest.state}, request=${input.takeoverRequest.state}, activation=${input.takeoverActivation.state}, followThrough=${input.takeoverFollowThrough.state}.`,
        missingRequirements.length ? `Missing: ${missingRequirements.join(", ")}.` : null,
        execution.nextAction ? `Next: ${execution.nextAction}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      280,
    ),
  };
}
