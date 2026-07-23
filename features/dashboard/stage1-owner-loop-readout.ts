import {
  buildCaioOperatingQuestionReadout,
  type CaioCurrentAcceptedG0ReadContext,
  type CaioOperatingQuestionPortfolioHeadReadRow,
  type CaioOperatingQuestionReadout,
  type CaioQuestionSelectionHeadReadRow,
} from "@/features/dashboard/caio-operating-question-readout";

export type Stage1ObservationProgramRow = {
  status: string;
  startsAt: Date;
  expiresAt: Date;
};

export type Stage1ObservationSourceRow = {
  id: string;
  sourceKey: string;
  sourceKind: string;
  status: string;
  freshnessSlaMinutes: number;
  lastObservedAt: Date | null;
  updatedAt: Date;
};

export type Stage1DecisionRow = {
  id: string;
  decisionKey: string;
  businessQuestion: string;
  status: string;
  riskLevel: string;
  ownerRef: string | null;
  validUntil: Date | null;
  updatedAt: Date;
  workPacketClaim: {
    actionItem: {
      status: string;
      dueDate: Date | null;
      executionReceipt: {
        verificationState: string;
        qualityScore: number;
      } | null;
    };
  } | null;
};

export type Stage1DecisionStatusCountRow = {
  status: string;
  _count: { _all: number };
};

export type Stage1SupervisionSignalRow = {
  id: string;
  signalKey: string;
  observedFact: string;
  severity: string;
  status: string;
  recommendedRoute: string;
  deadlineOrSla: Date | null;
  createdAt: Date;
};

export type Stage1SupervisionCountRow = {
  status: string;
  severity: string;
  _count: { _all: number };
};

export type Stage1WorkPacketReceiptRow = {
  decisionRecord: { status: string };
  actionItem: {
    status: string;
    executionReceipt: {
      verificationState: string;
      qualityScore: number;
    } | null;
  };
};

export type Stage1SourceHealth = "healthy" | "stale" | "failing" | "unknown";

export type Stage1DecisionProjection =
  | "DRAFT"
  | "EVIDENCE_READY"
  | "OWNER_CONFIRMED"
  | "DISPATCHED"
  | "IN_PROGRESS"
  | "RECEIPT_SUBMITTED"
  | "VERIFIED"
  | "EVALUATED"
  | "RECEIPT_MISSING"
  | "REJECTED"
  | "BLOCKED"
  | "EXPIRED"
  | "SUPERSEDED";

export type Stage1OwnerLoopReadout = {
  asOf: string;
  posture:
    | "not_configured"
    | "observing"
    | "owner_review_required"
    | "follow_through"
    | "learning_ready"
    | "attention_required";
  boundary: "review_first";
  observation: {
    activePrograms: number;
    totalSources: number;
    healthy: number;
    stale: number;
    failing: number;
    unknown: number;
    sources: Array<{
      id: string;
      sourceKey: string;
      sourceKind: string;
      health: Stage1SourceHealth;
      lastObservedAt: string | null;
    }>;
  };
  decisions: {
    total: number;
    pendingOwner: number;
    awaitingDispatch: number;
    inFollowThrough: number;
    evaluated: number;
    items: Array<{
      id: string;
      decisionKey: string;
      businessQuestion: string;
      projection: Stage1DecisionProjection;
      riskLevel: string;
      dueAt: string | null;
      validUntil: string | null;
      needsAttention: boolean;
    }>;
  };
  supervision: {
    open: number;
    critical: number;
    warning: number;
    items: Array<{
      id: string;
      signalKey: string;
      observedFact: string;
      severity: string;
      status: string;
      recommendedRoute: string;
      deadlineOrSla: string | null;
    }>;
  };
  receipts: {
    workPackets: number;
    verified: number;
    selfReported: number;
    missing: number;
    averageVerifiedQuality: number | null;
  };
  operatingQuestions: CaioOperatingQuestionReadout;
};

function statusCount(
  rows: readonly Stage1DecisionStatusCountRow[],
  status: string,
) {
  return rows.find((row) => row.status === status)?._count._all ?? 0;
}

function sourceHealth(
  source: Stage1ObservationSourceRow,
  now: Date,
): Stage1SourceHealth {
  if (source.status === "ERROR") return "failing";
  if (source.status !== "ACTIVE" || !source.lastObservedAt) return "unknown";
  const staleAt =
    source.lastObservedAt.getTime() + source.freshnessSlaMinutes * 60_000;
  return staleAt < now.getTime() ? "stale" : "healthy";
}

function decisionProjection(
  decision: Stage1DecisionRow,
): Stage1DecisionProjection {
  if (decision.status === "EVALUATED") return "EVALUATED";
  if (decision.status === "REJECTED") return "REJECTED";
  if (decision.status === "EXPIRED") return "EXPIRED";
  if (decision.status === "SUPERSEDED") return "SUPERSEDED";
  if (!decision.workPacketClaim) {
    if (decision.status === "EVIDENCE_READY") return "EVIDENCE_READY";
    if (decision.status === "OWNER_CONFIRMED") return "OWNER_CONFIRMED";
    return "DRAFT";
  }

  const action = decision.workPacketClaim.actionItem;
  if (action.status === "REJECTED") return "REJECTED";
  if (action.status === "BLOCKED") return "BLOCKED";
  if (action.executionReceipt?.verificationState === "VERIFIED") {
    return "VERIFIED";
  }
  if (action.executionReceipt) return "RECEIPT_SUBMITTED";
  if (action.status === "EXECUTED") return "RECEIPT_MISSING";
  if (action.status === "APPROVED") return "IN_PROGRESS";
  return "DISPATCHED";
}

function isOpenSupervisionStatus(status: string) {
  return status === "open" || status === "acknowledged" || status === "routed";
}

export function buildStage1OwnerLoopReadout(input: {
  now: Date;
  programs: readonly Stage1ObservationProgramRow[];
  sources: readonly Stage1ObservationSourceRow[];
  decisions: readonly Stage1DecisionRow[];
  decisionStatusCounts: readonly Stage1DecisionStatusCountRow[];
  supervisionSignals: readonly Stage1SupervisionSignalRow[];
  supervisionCounts: readonly Stage1SupervisionCountRow[];
  workPacketReceipts: readonly Stage1WorkPacketReceiptRow[];
  currentG0Context: CaioCurrentAcceptedG0ReadContext | null;
  operatingQuestionHead: CaioOperatingQuestionPortfolioHeadReadRow | null;
  questionSelectionHead: CaioQuestionSelectionHeadReadRow | null;
}): Stage1OwnerLoopReadout {
  const operatingQuestions = buildCaioOperatingQuestionReadout({
    now: input.now,
    currentG0Context: input.currentG0Context,
    portfolioHead: input.operatingQuestionHead,
    selectionHead: input.questionSelectionHead,
  });
  const sourceRows = input.sources.map((source) => ({
    source,
    health: sourceHealth(source, input.now),
  }));
  const healthy = sourceRows.filter((row) => row.health === "healthy").length;
  const stale = sourceRows.filter((row) => row.health === "stale").length;
  const failing = sourceRows.filter((row) => row.health === "failing").length;
  const unknown = sourceRows.filter((row) => row.health === "unknown").length;

  const claims = input.workPacketReceipts;
  const verifiedReceipts = claims.filter(
    (claim) =>
      claim.actionItem.executionReceipt?.verificationState === "VERIFIED",
  );
  const selfReported = claims.filter(
    (claim) =>
      claim.actionItem.executionReceipt?.verificationState === "SELF_REPORTED",
  ).length;
  const missing = claims.filter(
    (claim) => claim.actionItem.executionReceipt === null,
  ).length;
  const verifiedQualityTotal = verifiedReceipts.reduce(
    (sum, claim) =>
      sum + (claim.actionItem.executionReceipt?.qualityScore ?? 0),
    0,
  );

  const pendingOwner = statusCount(
    input.decisionStatusCounts,
    "EVIDENCE_READY",
  );
  const ownerConfirmedCount = statusCount(
    input.decisionStatusCounts,
    "OWNER_CONFIRMED",
  );
  const ownerConfirmedClaims = claims.filter(
    (claim) => claim.decisionRecord.status === "OWNER_CONFIRMED",
  ).length;
  const evaluated = statusCount(input.decisionStatusCounts, "EVALUATED");
  const totalDecisions = input.decisionStatusCounts.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  const openSupervisionRows = input.supervisionCounts.filter((row) =>
    isOpenSupervisionStatus(row.status),
  );
  const openSupervision = openSupervisionRows.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const critical = openSupervisionRows
    .filter((row) => row.severity === "critical")
    .reduce((sum, row) => sum + row._count._all, 0);
  const warning = openSupervisionRows
    .filter((row) => row.severity === "warning")
    .reduce((sum, row) => sum + row._count._all, 0);

  const activePrograms = input.programs.filter(
    (program) =>
      program.status === "ACTIVE" &&
      program.startsAt <= input.now &&
      program.expiresAt > input.now,
  ).length;
  const hasAnyStage1Data =
    input.programs.length > 0 ||
    input.sources.length > 0 ||
    totalDecisions > 0 ||
    input.supervisionCounts.length > 0 ||
    claims.length > 0 ||
    operatingQuestions.state !== "not_generated";

  let posture: Stage1OwnerLoopReadout["posture"] = "observing";
  if (!hasAnyStage1Data) posture = "not_configured";
  else if (
    failing > 0 ||
    critical > 0 ||
    missing > 0 ||
    operatingQuestions.state === "invalid_evidence" ||
    operatingQuestions.state === "insufficient_evidence" ||
    operatingQuestions.state === "last_valid_portfolio_stale" ||
    operatingQuestions.state === "binding_incomplete" ||
    operatingQuestions.state === "planning_incomplete"
  ) {
    posture = "attention_required";
  } else if (
    pendingOwner > 0 ||
    operatingQuestions.state === "awaiting_selection"
  ) {
    posture = "owner_review_required";
  }
  else if (
    claims.some((claim) => claim.decisionRecord.status !== "EVALUATED")
  ) {
    posture = "follow_through";
  } else if (evaluated > 0) posture = "learning_ready";

  return {
    asOf: input.now.toISOString(),
    posture,
    boundary: "review_first",
    observation: {
      activePrograms,
      totalSources: input.sources.length,
      healthy,
      stale,
      failing,
      unknown,
      sources: sourceRows.slice(0, 5).map(({ source, health }) => ({
        id: source.id,
        sourceKey: source.sourceKey,
        sourceKind: source.sourceKind,
        health,
        lastObservedAt: source.lastObservedAt?.toISOString() ?? null,
      })),
    },
    decisions: {
      total: totalDecisions,
      pendingOwner,
      awaitingDispatch: Math.max(0, ownerConfirmedCount - ownerConfirmedClaims),
      inFollowThrough: claims.filter(
        (claim) => claim.decisionRecord.status !== "EVALUATED",
      ).length,
      evaluated,
      items: input.decisions.slice(0, 5).map((decision) => {
        const projection = decisionProjection(decision);
        const normalizedRiskLevel = decision.riskLevel.trim().toLowerCase();
        return {
          id: decision.id,
          decisionKey: decision.decisionKey,
          businessQuestion: decision.businessQuestion,
          projection,
          riskLevel: decision.riskLevel,
          dueAt:
            decision.workPacketClaim?.actionItem.dueDate?.toISOString() ?? null,
          validUntil: decision.validUntil?.toISOString() ?? null,
          needsAttention:
            projection === "EVIDENCE_READY" ||
            projection === "RECEIPT_MISSING" ||
            projection === "BLOCKED" ||
            normalizedRiskLevel === "high" ||
            normalizedRiskLevel === "critical",
        };
      }),
    },
    supervision: {
      open: openSupervision,
      critical,
      warning,
      items: input.supervisionSignals.slice(0, 5).map((signal) => ({
        id: signal.id,
        signalKey: signal.signalKey,
        observedFact: signal.observedFact,
        severity: signal.severity,
        status: signal.status,
        recommendedRoute: signal.recommendedRoute,
        deadlineOrSla: signal.deadlineOrSla?.toISOString() ?? null,
      })),
    },
    receipts: {
      workPackets: claims.length,
      verified: verifiedReceipts.length,
      selfReported,
      missing,
      averageVerifiedQuality:
        verifiedReceipts.length > 0
          ? Math.round(verifiedQualityTotal / verifiedReceipts.length)
          : null,
    },
    operatingQuestions,
  };
}
