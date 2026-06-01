import type {
  HelmV21RunThreadCloseRequest,
  HelmV21RunThreadCloseoutConfirmation,
  HelmV21RunThreadCloseoutRefresh,
  HelmV21RunThreadSettlementFlow,
  HelmV21RunThreadSettlementReview,
} from "@/lib/helm-v2/contracts";

export type HelmV21CloseSettlementHandoffReadout = {
  compactSummary: string;
  settlementSummary: string;
  closeoutSummary: string;
  closeRequestSummary: string;
  provenanceSummary: string | null;
  focusTitle: string | null;
  focusSectionId: string | null;
};

function joinParts(parts: Array<string | null>): string | null {
  const value = parts.filter(Boolean).join(" · ");
  return value || null;
}

function summarizeSettlement(
  settlementFlow: HelmV21RunThreadSettlementFlow,
  settlementReview: HelmV21RunThreadSettlementReview,
) {
  return (
    joinParts([
      settlementFlow.summary,
      `review ${settlementReview.state}`,
      settlementReview.requestedBy
        ? `requested by ${settlementReview.requestedBy}`
        : settlementReview.resolvedBy
          ? `resolved by ${settlementReview.resolvedBy}`
          : null,
      settlementReview.checkpointKey ? `checkpoint ${settlementReview.checkpointKey}` : null,
    ]) ?? settlementFlow.summary
  );
}

function summarizeCloseout(
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation,
  closeoutRefresh: HelmV21RunThreadCloseoutRefresh,
) {
  return (
    joinParts([
      closeoutConfirmation.summary,
      closeoutRefresh.summary,
      closeoutConfirmation.confirmedBy ? `confirmed by ${closeoutConfirmation.confirmedBy}` : null,
      closeoutRefresh.requestedBy ? `refresh by ${closeoutRefresh.requestedBy}` : null,
      closeoutConfirmation.checkpointKey ?? closeoutRefresh.checkpointKey
        ? `checkpoint ${closeoutConfirmation.checkpointKey ?? closeoutRefresh.checkpointKey}`
        : null,
    ]) ??
    closeoutConfirmation.summary ??
    closeoutRefresh.summary
  );
}

function summarizeCloseRequest(closeRequest: HelmV21RunThreadCloseRequest) {
  return (
    joinParts([
      closeRequest.summary,
      closeRequest.requestedBy ? `requested by ${closeRequest.requestedBy}` : null,
      closeRequest.checkpointKey ? `checkpoint ${closeRequest.checkpointKey}` : null,
    ]) ?? closeRequest.summary
  );
}

function pickFocus(input: {
  settlementReview: HelmV21RunThreadSettlementReview;
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation;
  closeoutRefresh: HelmV21RunThreadCloseoutRefresh;
  closeRequest: HelmV21RunThreadCloseRequest;
}) {
  if (
    input.settlementReview.state === "requestable" ||
    input.settlementReview.state === "requested"
  ) {
    return {
      focusTitle: "settlement review",
      focusSectionId: "run-thread-settlement-review",
    };
  }

  if (
    input.closeoutConfirmation.state === "confirmable" ||
    input.closeoutConfirmation.state === "stale"
  ) {
    return {
      focusTitle: "closeout confirmation",
      focusSectionId: "run-thread-closeout-confirmation",
    };
  }

  if (
    input.closeoutRefresh.state === "requestable" ||
    input.closeoutRefresh.state === "open"
  ) {
    return {
      focusTitle: "closeout refresh",
      focusSectionId: "run-thread-closeout-refresh",
    };
  }

  if (
    input.closeRequest.state === "requestable" ||
    input.closeRequest.state === "open" ||
    input.closeRequest.state === "stale"
  ) {
    return {
      focusTitle: "close request",
      focusSectionId: "run-thread-close-request",
    };
  }

  return {
    focusTitle: null,
    focusSectionId: null,
  };
}

export function buildCloseSettlementHandoffReadout(input: {
  settlementFlow: HelmV21RunThreadSettlementFlow;
  settlementReview: HelmV21RunThreadSettlementReview;
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation;
  closeoutRefresh: HelmV21RunThreadCloseoutRefresh;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21CloseSettlementHandoffReadout {
  const provenanceSummary = joinParts([
    input.settlementReview.sourcePage ? `review ${input.settlementReview.sourcePage}` : null,
    input.closeoutConfirmation.sourcePage
      ? `confirmation ${input.closeoutConfirmation.sourcePage}`
      : null,
    input.closeoutRefresh.sourcePage ? `refresh ${input.closeoutRefresh.sourcePage}` : null,
    input.closeRequest.sourcePage ? `close ${input.closeRequest.sourcePage}` : null,
  ]);
  const focus = pickFocus(input);

  return {
    compactSummary:
      joinParts([
        `settlement ${input.settlementFlow.state}`,
        `review ${input.settlementReview.state}`,
        `confirm ${input.closeoutConfirmation.state}`,
        `refresh ${input.closeoutRefresh.state}`,
        `close ${input.closeRequest.state}`,
      ]) ??
      `${input.settlementFlow.state} · ${input.closeRequest.state}`,
    settlementSummary: summarizeSettlement(input.settlementFlow, input.settlementReview),
    closeoutSummary: summarizeCloseout(input.closeoutConfirmation, input.closeoutRefresh),
    closeRequestSummary: summarizeCloseRequest(input.closeRequest),
    provenanceSummary,
    focusTitle: focus.focusTitle,
    focusSectionId: focus.focusSectionId,
  };
}
