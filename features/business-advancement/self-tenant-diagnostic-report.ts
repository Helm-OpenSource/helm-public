/**
 * Helm Business Advancement — self-tenant operating checkup report builder.
 *
 * Pure builder that turns entered self-tenant operating signals into a
 * review-first "operating checkup" packet: gap map, per-gap migration
 * assessment, next-rung ladder proposal, and a review packet. Candidates
 * without evidence are demoted to advisory observations instead of being
 * presented as diagnosed gaps; insufficient signal yields an honest
 * Insufficient-Signal decision instead of a fabricated report.
 *
 * It outputs candidate needs, risks, and fit paths only. It is NOT a
 * procurement conclusion, NOT a vendor quote, NOT a contract commitment,
 * NOT a runtime adapter, NOT a DB reader, NOT an API, NOT a schema change,
 * and NOT automated execution authority.
 */

import {
  SELF_TENANT_EVENT_CLASSES,
  type SelfTenantEventClass,
} from "./self-tenant-minimal-live-gate";

export const SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION =
  "business-advancement-self-tenant-diagnostic-report/v1" as const;

export const SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE =
  "Review-First-Checkup-Only" as const;

export type SelfTenantDiagnosticDecision =
  | "Checkup-Report-Ready"
  | "Insufficient-Signal"
  | "Blocked";

export type SelfTenantDataPosture = "synthetic" | "internal_real";

export type SelfTenantMigrationFeasibility =
  | "observer_ready"
  | "needs_more_signal"
  | "not_ready";

export interface SelfTenantDiagnosticReportContext {
  readonly reportId: string;
  readonly preparedBy: string;
  readonly preparedAtIso: string;
  /** Alias only — never a real customer or person name. */
  readonly workspaceAlias: string;
  readonly dataPosture: SelfTenantDataPosture;
}

export interface SelfTenantEventClassCoverage {
  readonly eventClass: SelfTenantEventClass;
  readonly enteredCount: number;
  readonly evidenceRefs: readonly string[];
}

export interface SelfTenantGapCandidate {
  readonly gapId: string;
  readonly statement: string;
  readonly evidenceRefs: readonly string[];
  readonly confidence: "low" | "medium" | "high";
  readonly migrationFeasibility: SelfTenantMigrationFeasibility;
  readonly risks: readonly string[];
  /** Range wording only; never a committed number. */
  readonly expectedIncrementNote: string;
}

export interface SelfTenantLadderProposal {
  readonly nextDomains: readonly string[];
  readonly startMode: "observer";
  readonly promotionCriteria: readonly string[];
}

export interface SelfTenantDiagnosticReportInput {
  readonly reportContext: SelfTenantDiagnosticReportContext;
  readonly coverage: readonly SelfTenantEventClassCoverage[];
  readonly gapCandidates: readonly SelfTenantGapCandidate[];
  readonly ladderProposal: SelfTenantLadderProposal;
}

export interface SelfTenantDiagnosticReportCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface SelfTenantDiagnosticReviewPacket {
  readonly evidence: readonly string[];
  readonly recommendation: string;
  readonly risks: readonly string[];
  readonly boundaries: readonly string[];
  readonly nextSteps: readonly string[];
  readonly owner: string;
}

export interface SelfTenantDiagnosticReportPacket {
  readonly ruleVersion: typeof SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION;
  readonly posture: typeof SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE;
  readonly decision: SelfTenantDiagnosticDecision;
  readonly reportContext: SelfTenantDiagnosticReportContext;
  readonly coverage: readonly SelfTenantEventClassCoverage[];
  /** Gap candidates with evidence — the diagnosed gap map. */
  readonly diagnosedGaps: readonly SelfTenantGapCandidate[];
  /** Evidence-less candidates demoted here; never presented as diagnosed. */
  readonly advisoryObservations: readonly SelfTenantGapCandidate[];
  readonly ladderProposal: SelfTenantLadderProposal;
  readonly reviewPacket: SelfTenantDiagnosticReviewPacket;
  readonly checks: readonly SelfTenantDiagnosticReportCheck[];
  readonly blockers: readonly string[];
  readonly forbiddenOutputs: readonly string[];
}

export const SELF_TENANT_DIAGNOSTIC_FORBIDDEN_OUTPUTS = [
  "No procurement conclusion or vendor selection",
  "No vendor quote, price, or commercial terms",
  "No contract commitment or delivery date commitment",
  "No committed increment numbers; ranges with assumptions only",
  "No automatic write to CRM, memory, approvals, or customer-facing systems",
  "No customer-visible sending of any part of this report",
] as const;

export const MAX_LADDER_NEXT_DOMAINS = 2;

export const DEFAULT_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT: SelfTenantDiagnosticReportInput =
  {
    reportContext: {
      reportId: "",
      preparedBy: "",
      preparedAtIso: "",
      workspaceAlias: "",
      dataPosture: "synthetic",
    },
    coverage: [],
    gapCandidates: [],
    ladderProposal: {
      nextDomains: [],
      startMode: "observer",
      promotionCriteria: [],
    },
  };

export const POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT: SelfTenantDiagnosticReportInput =
  {
    reportContext: {
      reportId: "self-tenant-checkup-sample-001",
      preparedBy: "fde-alias-01",
      preparedAtIso: "2026-07-05T00:00:00.000Z",
      workspaceAlias: "internal-ops-alias",
      dataPosture: "synthetic",
    },
    coverage: [
      {
        eventClass: "lead_or_customer_contact",
        enteredCount: 6,
        evidenceRefs: ["fixture:lead-batch-01"],
      },
      {
        eventClass: "poc_or_project_advancement",
        enteredCount: 4,
        evidenceRefs: ["fixture:poc-batch-01"],
      },
      {
        eventClass: "work_assignment_and_acceptance",
        enteredCount: 3,
        evidenceRefs: ["fixture:work-batch-01"],
      },
      {
        eventClass: "builder_backlog",
        enteredCount: 5,
        evidenceRefs: ["fixture:backlog-batch-01"],
      },
    ],
    gapCandidates: [
      {
        gapId: "gap-followup-window",
        statement:
          "Follow-up windows after first contact are inconsistent across leads.",
        evidenceRefs: ["fixture:lead-batch-01", "fixture:poc-batch-01"],
        confidence: "medium",
        migrationFeasibility: "observer_ready",
        risks: ["Signal volume is still small; thresholds may overfit."],
        expectedIncrementNote:
          "Directional range only under stated assumptions; not a committed number.",
      },
      {
        gapId: "gap-acceptance-lag",
        statement:
          "Work acceptance confirmations lag behind completion notes.",
        evidenceRefs: ["fixture:work-batch-01"],
        confidence: "low",
        migrationFeasibility: "needs_more_signal",
        risks: ["Acceptance is manual; lag may reflect review discipline, not a gap."],
        expectedIncrementNote:
          "No range stated; needs more signal before any estimate.",
      },
      {
        gapId: "gap-unevidenced-hunch",
        statement: "Backlog triage feels slow (no evidence attached yet).",
        evidenceRefs: [],
        confidence: "low",
        migrationFeasibility: "not_ready",
        risks: [],
        expectedIncrementNote: "None.",
      },
    ],
    ladderProposal: {
      nextDomains: ["followup-window-observation"],
      startMode: "observer",
      promotionCriteria: [
        "Observer runs for a full review cycle with zero boundary incidents",
        "Human reviewers accept the observed judgement precision",
      ],
    },
  };

export function buildSelfTenantDiagnosticReport(
  input: SelfTenantDiagnosticReportInput = DEFAULT_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
): SelfTenantDiagnosticReportPacket {
  const checks = buildChecks(input);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );

  const diagnosedGaps = input.gapCandidates.filter(
    (candidate) => candidate.evidenceRefs.length > 0,
  );
  const advisoryObservations = input.gapCandidates.filter(
    (candidate) => candidate.evidenceRefs.length === 0,
  );

  const decision = buildDecision(input, blockers);

  return {
    ruleVersion: SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION,
    posture: SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE,
    decision,
    reportContext: input.reportContext,
    coverage: input.coverage,
    diagnosedGaps: decision === "Checkup-Report-Ready" ? diagnosedGaps : [],
    advisoryObservations:
      decision === "Checkup-Report-Ready" ? advisoryObservations : [],
    ladderProposal: input.ladderProposal,
    reviewPacket: buildReviewPacket(input, decision, diagnosedGaps),
    checks,
    blockers,
    forbiddenOutputs: [...SELF_TENANT_DIAGNOSTIC_FORBIDDEN_OUTPUTS],
  };
}

function buildChecks(
  input: SelfTenantDiagnosticReportInput,
): SelfTenantDiagnosticReportCheck[] {
  return [
    checkReportContext(input.reportContext),
    checkLadderProposal(input.ladderProposal),
    checkGapCandidateHygiene(input.gapCandidates),
  ];
}

function checkReportContext(
  context: SelfTenantDiagnosticReportContext,
): SelfTenantDiagnosticReportCheck {
  const strictIso = isStrictUtcIso(context.preparedAtIso);
  const pass =
    context.reportId.trim().length > 0 &&
    context.preparedBy.trim().length > 0 &&
    strictIso &&
    context.workspaceAlias.trim().length > 0;

  return {
    name: "report_context_complete",
    pass,
    detail: pass
      ? `Report ${context.reportId} prepared by ${context.preparedBy} at ${context.preparedAtIso} over alias ${context.workspaceAlias} (${context.dataPosture}).`
      : "Report context must carry reportId, preparedBy, strict UTC timestamp, and an alias-only workspace name.",
    blocker: pass
      ? undefined
      : "Report context incomplete for a self-tenant checkup report.",
  };
}

function checkLadderProposal(
  proposal: SelfTenantLadderProposal,
): SelfTenantDiagnosticReportCheck {
  const pass =
    proposal.startMode === "observer" &&
    proposal.nextDomains.length > 0 &&
    proposal.nextDomains.length <= MAX_LADDER_NEXT_DOMAINS &&
    proposal.promotionCriteria.length > 0;

  return {
    name: "ladder_proposal_observer_first",
    pass,
    detail: pass
      ? `Ladder proposes ${proposal.nextDomains.length} next domain(s) starting at observer with ${proposal.promotionCriteria.length} promotion criteria.`
      : "Ladder proposal must start at observer, name 1-2 next domains, and state human-verifiable promotion criteria.",
    blocker: pass
      ? undefined
      : "Ladder proposal must be observer-first with at most two next domains and explicit promotion criteria.",
  };
}

function checkGapCandidateHygiene(
  candidates: readonly SelfTenantGapCandidate[],
): SelfTenantDiagnosticReportCheck {
  const withEvidence = candidates.filter(
    (candidate) => candidate.evidenceRefs.length > 0,
  );
  const badIds = candidates.filter(
    (candidate) =>
      candidate.gapId.trim().length === 0 ||
      candidate.statement.trim().length === 0,
  );
  const pass = badIds.length === 0 && withEvidence.length > 0;

  return {
    name: "gap_candidates_evidence_first",
    pass,
    detail: pass
      ? `${withEvidence.length} gap candidate(s) carry evidence; ${candidates.length - withEvidence.length} demoted to advisory observations.`
      : "Gap candidates must carry ids and statements, and at least one candidate must carry evidence refs.",
    blocker: pass
      ? undefined
      : "At least one evidenced gap candidate is required; evidence-less candidates are advisory only.",
  };
}

function buildDecision(
  input: SelfTenantDiagnosticReportInput,
  blockers: readonly string[],
): SelfTenantDiagnosticDecision {
  const coveredClasses = new Set(
    input.coverage
      .filter((entry) => entry.enteredCount > 0)
      .map((entry) => entry.eventClass),
  );
  const signalSufficient = SELF_TENANT_EVENT_CLASSES.some((eventClass) =>
    coveredClasses.has(eventClass),
  );

  if (!signalSufficient) {
    return "Insufficient-Signal";
  }
  if (blockers.length > 0) {
    return "Blocked";
  }
  return "Checkup-Report-Ready";
}

function buildReviewPacket(
  input: SelfTenantDiagnosticReportInput,
  decision: SelfTenantDiagnosticDecision,
  diagnosedGaps: readonly SelfTenantGapCandidate[],
): SelfTenantDiagnosticReviewPacket {
  const boundaries = [
    "Recommendation only; not a commitment, procurement conclusion, or contract",
    "Next rung starts at observer; promotion is a human decision against stated criteria",
    "Increments are ranges under assumptions; never committed numbers",
  ];

  if (decision !== "Checkup-Report-Ready") {
    return {
      evidence: [],
      recommendation:
        decision === "Insufficient-Signal"
          ? "Do not issue a checkup report yet; keep entering real events until at least one event class carries signal."
          : "Resolve blockers before issuing a checkup report.",
      risks: ["Issuing a report without sufficient signal fabricates judgement."],
      boundaries,
      nextSteps: ["Continue minimal-live entry through standard surfaces."],
      owner: input.reportContext.preparedBy || "unassigned",
    };
  }

  return {
    evidence: diagnosedGaps.flatMap((gap) => gap.evidenceRefs),
    recommendation: `Review ${diagnosedGaps.length} evidenced gap(s) and decide whether to start observer mode on: ${input.ladderProposal.nextDomains.join(", ")}.`,
    risks: diagnosedGaps.flatMap((gap) => gap.risks),
    boundaries,
    nextSteps: [
      "Human review of the diagnosed gap map",
      "Explicit owner decision before any observer run starts",
    ],
    owner: input.reportContext.preparedBy,
  };
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
