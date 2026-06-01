/**
 * Helm Agentic Governance — Back-office Evidence / Gap / Reminder Guard
 *
 * Offline evaluator for back-office process evidence. It turns CRM/back-office
 * style signals into review artifacts only; it never executes contract,
 * invoice, payment, approval, or CRM-stage writes.
 */

export type BackOfficeGovernanceSignalKind =
  | "process_evidence"
  | "operating_gap"
  | "pre_approval_reminder";

export type BackOfficeSourceSystem =
  | "salesforce"
  | "hubspot"
  | "manual_fixture"
  | "unknown";

export type BackOfficeObjectType =
  | "opportunity"
  | "company"
  | "contract"
  | "invoice"
  | "approval"
  | "unknown";

export type BackOfficeBoundaryDecision =
  | "review_packet_only"
  | "must_push_candidate_only"
  | "report_readout_only"
  | "reject"
  | "quarantine";

export type BackOfficeDeclaredExternalEffect =
  | "none"
  | "crm_stage_write"
  | "contract_send"
  | "invoice_issue"
  | "payment_execute"
  | "approval_execute"
  | "unknown";

export type BackOfficeSignalRisk = "low" | "medium" | "high";

export interface BackOfficeGovernanceSignal {
  readonly signalId: string;
  readonly workspaceId: string;
  readonly sourceSystem: BackOfficeSourceSystem;
  readonly kind: BackOfficeGovernanceSignalKind;
  readonly objectRef?: {
    readonly type: BackOfficeObjectType;
    readonly id?: string;
  };
  readonly ownerRef: string;
  readonly deadlineIso?: string;
  readonly risk: BackOfficeSignalRisk;
  readonly evidenceRefs: readonly string[];
  readonly declaredExternalEffect: BackOfficeDeclaredExternalEffect;
  readonly boundaryDecision: BackOfficeBoundaryDecision;
  readonly boundaryNote: string;
  readonly expectedDisposition?: BackOfficeSignalDisposition;
}

export type BackOfficeSignalDisposition =
  | "accept_for_review_packet"
  | "accept_for_must_push_candidate"
  | "accept_for_report_readout"
  | "reject"
  | "quarantine";

export type BackOfficeSignalReasonCode =
  | "accepted_process_evidence"
  | "accepted_operating_gap"
  | "accepted_pre_approval_reminder"
  | "missing_required_field"
  | "missing_owner"
  | "missing_evidence"
  | "boundary_missing"
  | "cross_workspace"
  | "execution_intent_forbidden"
  | "explicit_reject"
  | "explicit_quarantine";

export interface BackOfficeGovernanceDecision {
  readonly signalId: string;
  readonly disposition: BackOfficeSignalDisposition;
  readonly reasonCodes: readonly BackOfficeSignalReasonCode[];
  readonly mayAttachToReviewPacket: boolean;
  readonly mayCreateMustPushCandidate: boolean;
  readonly mayCreateReportReadout: boolean;
  readonly officialWriteAllowed: false;
  readonly autoApprovalAllowed: false;
  readonly autoSettlementAllowed: false;
  readonly silentCrmWriteAllowed: false;
  readonly boundaryNote: string;
}

export type BackOfficeGovernanceReadoutLane =
  | "review_packet"
  | "must_push_candidate"
  | "report_readout";

export interface BackOfficeGovernanceReadoutItem {
  readonly signalId: string;
  readonly sourceSystem: BackOfficeSourceSystem;
  readonly kind: BackOfficeGovernanceSignalKind;
  readonly objectRef?: BackOfficeGovernanceSignal["objectRef"];
  readonly ownerRef: string;
  readonly deadlineIso?: string;
  readonly risk: BackOfficeSignalRisk;
  readonly lane: BackOfficeGovernanceReadoutLane;
  readonly evidenceRefs: readonly string[];
  readonly reasonCodes: readonly BackOfficeSignalReasonCode[];
  readonly boundaryNote: string;
  readonly actionAuthority: "none";
}

export interface BackOfficeGovernanceReadoutPacket {
  readonly workspaceId: string;
  readonly generatedFromSignalCount: number;
  readonly items: readonly BackOfficeGovernanceReadoutItem[];
  readonly reviewPacketItems: readonly BackOfficeGovernanceReadoutItem[];
  readonly mustPushCandidateItems: readonly BackOfficeGovernanceReadoutItem[];
  readonly reportReadoutItems: readonly BackOfficeGovernanceReadoutItem[];
  readonly rejectedCount: number;
  readonly quarantinedCount: number;
  readonly officialWriteAllowed: 0;
  readonly autoApprovalAllowed: 0;
  readonly autoSettlementAllowed: 0;
  readonly silentCrmWriteAllowed: 0;
}

export interface BackOfficeGovernanceEval {
  readonly totalSignals: number;
  readonly expectedMatches: number;
  readonly acceptedWithoutOwner: number;
  readonly acceptedWithoutEvidence: number;
  readonly acceptedWithoutBoundaryNote: number;
  readonly officialWriteAllowed: number;
  readonly autoApprovalAllowed: number;
  readonly autoSettlementAllowed: number;
  readonly silentCrmWriteAllowed: number;
  readonly readoutItemCount: number;
  readonly readoutItemsWithoutOwner: number;
  readonly readoutItemsWithoutEvidence: number;
  readonly readoutExecutionAuthorityLeak: number;
  readonly readoutAcceptedDecisionMismatch: number;
  readonly decisions: readonly BackOfficeGovernanceDecision[];
  readonly readoutPacket: BackOfficeGovernanceReadoutPacket;
  readonly overallPassed: boolean;
}

export const BACK_OFFICE_GOVERNANCE_FIXTURES: readonly BackOfficeGovernanceSignal[] = [
  {
    signalId: "bo_process_evidence_001",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "salesforce",
    kind: "process_evidence",
    objectRef: { type: "opportunity", id: "opp_redacted_001" },
    ownerRef: "owner_sales_ops",
    deadlineIso: "2026-05-04T09:00:00.000Z",
    risk: "medium",
    evidenceRefs: ["sf_case_redacted_001"],
    declaredExternalEffect: "none",
    boundaryDecision: "review_packet_only",
    boundaryNote: "Salesforce process evidence may attach to a review packet only; no CRM write is executed.",
    expectedDisposition: "accept_for_review_packet",
  },
  {
    signalId: "bo_operating_gap_001",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "hubspot",
    kind: "operating_gap",
    objectRef: { type: "company", id: "company_redacted_001" },
    ownerRef: "owner_revops",
    risk: "high",
    evidenceRefs: ["hubspot_activity_redacted_001"],
    declaredExternalEffect: "none",
    boundaryDecision: "must_push_candidate_only",
    boundaryNote: "Back-office operating gap can become a Must Push candidate only after review.",
    expectedDisposition: "accept_for_must_push_candidate",
  },
  {
    signalId: "bo_pre_approval_001",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "manual_fixture",
    kind: "pre_approval_reminder",
    objectRef: { type: "approval", id: "approval_redacted_001" },
    ownerRef: "owner_finance",
    deadlineIso: "2026-05-05T09:00:00.000Z",
    risk: "high",
    evidenceRefs: ["approval_packet_redacted_001"],
    declaredExternalEffect: "none",
    boundaryDecision: "report_readout_only",
    boundaryNote: "Pre-approval reminder is a readout only; it does not approve, settle, or update the source system.",
    expectedDisposition: "accept_for_report_readout",
  },
  {
    signalId: "bo_missing_owner",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "salesforce",
    kind: "operating_gap",
    objectRef: { type: "opportunity", id: "opp_redacted_002" },
    ownerRef: "",
    risk: "medium",
    evidenceRefs: ["sf_case_redacted_002"],
    declaredExternalEffect: "none",
    boundaryDecision: "must_push_candidate_only",
    boundaryNote: "Missing owner must block candidate adoption.",
    expectedDisposition: "reject",
  },
  {
    signalId: "bo_missing_evidence",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "hubspot",
    kind: "process_evidence",
    ownerRef: "owner_sales_ops",
    risk: "low",
    evidenceRefs: [],
    declaredExternalEffect: "none",
    boundaryDecision: "review_packet_only",
    boundaryNote: "Missing evidence must block candidate adoption.",
    expectedDisposition: "reject",
  },
  {
    signalId: "bo_payment_execution_attempt",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "manual_fixture",
    kind: "pre_approval_reminder",
    objectRef: { type: "invoice", id: "invoice_redacted_001" },
    ownerRef: "owner_finance",
    risk: "high",
    evidenceRefs: ["invoice_redacted_001"],
    declaredExternalEffect: "payment_execute",
    boundaryDecision: "review_packet_only",
    boundaryNote: "Payment execution attempts must be quarantined.",
    expectedDisposition: "quarantine",
  },
  {
    signalId: "bo_crm_stage_write_attempt",
    workspaceId: "workspace_agentic_governance_fixture",
    sourceSystem: "salesforce",
    kind: "process_evidence",
    objectRef: { type: "opportunity", id: "opp_redacted_003" },
    ownerRef: "owner_sales_ops",
    risk: "high",
    evidenceRefs: ["sf_case_redacted_003"],
    declaredExternalEffect: "crm_stage_write",
    boundaryDecision: "must_push_candidate_only",
    boundaryNote: "CRM stage write attempts must be quarantined.",
    expectedDisposition: "quarantine",
  },
];

export function evaluateBackOfficeGovernanceSignal(
  signal: BackOfficeGovernanceSignal,
  expectedWorkspaceId = signal.workspaceId,
): BackOfficeGovernanceDecision {
  const reasonCodes = new Set<BackOfficeSignalReasonCode>();

  if (signal.workspaceId !== expectedWorkspaceId) {
    reasonCodes.add("cross_workspace");
    return buildBackOfficeDecision(signal, "quarantine", reasonCodes);
  }

  if (signal.signalId.trim() === "" || signal.workspaceId.trim() === "") {
    reasonCodes.add("missing_required_field");
    return buildBackOfficeDecision(signal, "reject", reasonCodes);
  }

  if (signal.ownerRef.trim() === "") {
    reasonCodes.add("missing_owner");
    return buildBackOfficeDecision(signal, "reject", reasonCodes);
  }

  if (signal.evidenceRefs.length === 0) {
    reasonCodes.add("missing_evidence");
    return buildBackOfficeDecision(signal, "reject", reasonCodes);
  }

  if (signal.boundaryNote.trim() === "") {
    reasonCodes.add("boundary_missing");
    return buildBackOfficeDecision(signal, "reject", reasonCodes);
  }

  if (signal.declaredExternalEffect !== "none") {
    reasonCodes.add("execution_intent_forbidden");
    return buildBackOfficeDecision(signal, "quarantine", reasonCodes);
  }

  if (signal.boundaryDecision === "reject") {
    reasonCodes.add("explicit_reject");
    return buildBackOfficeDecision(signal, "reject", reasonCodes);
  }

  if (signal.boundaryDecision === "quarantine") {
    reasonCodes.add("explicit_quarantine");
    return buildBackOfficeDecision(signal, "quarantine", reasonCodes);
  }

  if (signal.kind === "process_evidence") {
    reasonCodes.add("accepted_process_evidence");
  } else if (signal.kind === "operating_gap") {
    reasonCodes.add("accepted_operating_gap");
  } else {
    reasonCodes.add("accepted_pre_approval_reminder");
  }

  if (signal.boundaryDecision === "must_push_candidate_only") {
    return buildBackOfficeDecision(signal, "accept_for_must_push_candidate", reasonCodes);
  }

  if (signal.boundaryDecision === "report_readout_only") {
    return buildBackOfficeDecision(signal, "accept_for_report_readout", reasonCodes);
  }

  return buildBackOfficeDecision(signal, "accept_for_review_packet", reasonCodes);
}

export function runBackOfficeGovernanceEval(
  signals: readonly BackOfficeGovernanceSignal[] = BACK_OFFICE_GOVERNANCE_FIXTURES,
  expectedWorkspaceId = signals[0]?.workspaceId ?? "unknown_workspace",
): BackOfficeGovernanceEval {
  const decisions = signals.map((signal) =>
    evaluateBackOfficeGovernanceSignal(signal, expectedWorkspaceId),
  );
  const readoutPacket = buildBackOfficeGovernanceReadoutPacket(signals, expectedWorkspaceId);
  const expectedMatches = decisions.filter((decision, index) =>
    signals[index]?.expectedDisposition === undefined
      ? true
      : decision.disposition === signals[index]?.expectedDisposition,
  ).length;
  const accepted = decisions.flatMap((decision, index) => {
    const signal = signals[index];
    if (!signal || !decision.disposition.startsWith("accept_for_")) return [];
    return [{ decision, signal }];
  });
  const acceptedWithoutOwner = accepted.filter(({ signal }) =>
    signal.ownerRef.trim() === "",
  ).length;
  const acceptedWithoutEvidence = accepted.filter(({ signal }) =>
    signal.evidenceRefs.length === 0,
  ).length;
  const acceptedWithoutBoundaryNote = accepted.filter(({ signal }) =>
    signal.boundaryNote.trim() === "",
  ).length;
  const officialWriteAllowed = decisions.filter((decision) => decision.officialWriteAllowed).length;
  const autoApprovalAllowed = decisions.filter((decision) => decision.autoApprovalAllowed).length;
  const autoSettlementAllowed = decisions.filter((decision) => decision.autoSettlementAllowed).length;
  const silentCrmWriteAllowed = decisions.filter((decision) => decision.silentCrmWriteAllowed).length;
  const readoutItemsWithoutOwner = readoutPacket.items.filter((item) =>
    item.ownerRef.trim() === "",
  ).length;
  const readoutItemsWithoutEvidence = readoutPacket.items.filter((item) =>
    item.evidenceRefs.length === 0,
  ).length;
  const readoutExecutionAuthorityLeak = readoutPacket.items.filter((item) =>
    item.actionAuthority !== "none",
  ).length;
  const acceptedSignalIds = new Set(accepted.map(({ decision }) => decision.signalId));
  const readoutSignalIds = new Set(readoutPacket.items.map((item) => item.signalId));
  const readoutAcceptedDecisionMismatch =
    accepted.filter(({ decision }) => !readoutSignalIds.has(decision.signalId)).length +
    readoutPacket.items.filter((item) => !acceptedSignalIds.has(item.signalId)).length;

  return {
    totalSignals: signals.length,
    expectedMatches,
    acceptedWithoutOwner,
    acceptedWithoutEvidence,
    acceptedWithoutBoundaryNote,
    officialWriteAllowed,
    autoApprovalAllowed,
    autoSettlementAllowed,
    silentCrmWriteAllowed,
    readoutItemCount: readoutPacket.items.length,
    readoutItemsWithoutOwner,
    readoutItemsWithoutEvidence,
    readoutExecutionAuthorityLeak,
    readoutAcceptedDecisionMismatch,
    decisions,
    readoutPacket,
    overallPassed:
      expectedMatches === signals.length &&
      acceptedWithoutOwner === 0 &&
      acceptedWithoutEvidence === 0 &&
      acceptedWithoutBoundaryNote === 0 &&
      officialWriteAllowed === 0 &&
      autoApprovalAllowed === 0 &&
      autoSettlementAllowed === 0 &&
      silentCrmWriteAllowed === 0 &&
      readoutItemsWithoutOwner === 0 &&
      readoutItemsWithoutEvidence === 0 &&
      readoutExecutionAuthorityLeak === 0 &&
      readoutAcceptedDecisionMismatch === 0,
  };
}

export function buildBackOfficeGovernanceReadoutPacket(
  signals: readonly BackOfficeGovernanceSignal[],
  expectedWorkspaceId = signals[0]?.workspaceId ?? "unknown_workspace",
): BackOfficeGovernanceReadoutPacket {
  const evaluated = signals.map((signal) => ({
    signal,
    decision: evaluateBackOfficeGovernanceSignal(signal, expectedWorkspaceId),
  }));
  const items = evaluated.flatMap(({ signal, decision }) => {
    const lane = getReadoutLane(decision);
    if (!lane) return [];

    return [{
      signalId: signal.signalId,
      sourceSystem: signal.sourceSystem,
      kind: signal.kind,
      objectRef: signal.objectRef,
      ownerRef: signal.ownerRef,
      deadlineIso: signal.deadlineIso,
      risk: signal.risk,
      lane,
      evidenceRefs: signal.evidenceRefs,
      reasonCodes: decision.reasonCodes,
      boundaryNote: decision.boundaryNote,
      actionAuthority: "none" as const,
    }];
  });

  return {
    workspaceId: expectedWorkspaceId,
    generatedFromSignalCount: signals.length,
    items,
    reviewPacketItems: items.filter((item) => item.lane === "review_packet"),
    mustPushCandidateItems: items.filter((item) => item.lane === "must_push_candidate"),
    reportReadoutItems: items.filter((item) => item.lane === "report_readout"),
    rejectedCount: evaluated.filter(({ decision }) => decision.disposition === "reject").length,
    quarantinedCount: evaluated.filter(({ decision }) => decision.disposition === "quarantine").length,
    officialWriteAllowed: 0,
    autoApprovalAllowed: 0,
    autoSettlementAllowed: 0,
    silentCrmWriteAllowed: 0,
  };
}

function getReadoutLane(
  decision: BackOfficeGovernanceDecision,
): BackOfficeGovernanceReadoutLane | null {
  if (decision.disposition === "accept_for_review_packet") return "review_packet";
  if (decision.disposition === "accept_for_must_push_candidate") {
    return "must_push_candidate";
  }
  if (decision.disposition === "accept_for_report_readout") return "report_readout";
  return null;
}

function buildBackOfficeDecision(
  signal: BackOfficeGovernanceSignal,
  disposition: BackOfficeSignalDisposition,
  reasonCodes: Set<BackOfficeSignalReasonCode>,
): BackOfficeGovernanceDecision {
  return {
    signalId: signal.signalId,
    disposition,
    reasonCodes: [...reasonCodes],
    mayAttachToReviewPacket: disposition === "accept_for_review_packet",
    mayCreateMustPushCandidate: disposition === "accept_for_must_push_candidate",
    mayCreateReportReadout: disposition === "accept_for_report_readout",
    officialWriteAllowed: false,
    autoApprovalAllowed: false,
    autoSettlementAllowed: false,
    silentCrmWriteAllowed: false,
    boundaryNote: signal.boundaryNote,
  };
}
