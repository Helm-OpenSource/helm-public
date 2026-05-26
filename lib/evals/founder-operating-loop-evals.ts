/**
 * Helm — Founder Operating Loop (FOL) Phase 1 offline gate evaluator.
 *
 * OFFLINE, deterministic, no LLM, no network, no DB. Verifies the
 * checked-in Founder Loop fixture is internally consistent and that
 * the engineering-verifiable acceptance metrics referenced from the
 * public boundary brief are satisfied without contacting any real
 * runtime, customer, or tenant data.
 *
 * Public boundary anchor:
 *   docs/product/HELM_FOUNDER_OPERATING_LOOP_BOUNDARY_BRIEF.md
 *
 * Hard incident counters must each stay at 0:
 *   - boundaryBreachCount (any B1–B7 fixture not rejecting)
 *   - emptyEvidenceBundleCount
 *   - duplicateSourceIdCount
 *   - crossWorkspaceJoinCount
 *   - autoOutboundCount
 *   - nonCeoViewerCount
 *   - sensitiveIdentityRankingCount
 *   - briefingCapBreachCount
 *   - judgmentCardinalityBreachCount
 *
 * The evaluator does NOT call any LLM. It does NOT touch the DB. It
 * does NOT trigger any external side effect. It is purely a
 * structural validator over a JSON fixture.
 */

import founderCasesFixture from "@/evals/founder-operating-loop/founder-operating-loop-cases.json";
import {
  CASE_MANAGEMENT_LAYERS,
  FOUNDER_BOUNDARY_GATES,
  FOUNDER_BRIEFING_DAILY_CAP,
  FOUNDER_CEO_REVIEW_BUDGET_MINUTES,
  FOUNDER_CONNECTOR_MINIMUM_SET,
  FOUNDER_RANKING_MIX_DEFAULT,
  FOUNDER_RUN_SCOPES,
  FOUNDER_SIGNAL_FAMILIES,
  HELM_SELF_FACES,
  JUDGMENT_QUESTIONS,
  JUDGMENTS_PER_SIGNAL,
  QA_FORBIDDEN_SIDE_EFFECTS,
  QA_SCOPES,
  ROUTING_REASONS,
  SENSITIVE_IDENTITY_ATTRIBUTES,
  type CaseManagementLayer,
  type DecisionEscalation,
  type EvidenceBundle,
  type FounderBoundaryGate,
  type FounderConnectorMinimumSet,
  type FounderJudgment,
  type FounderOperatingRun,
  type FounderRunScope,
  type FounderSignalFamily,
  type HelmSelfFace,
  type JudgmentQuestion,
  type OperatingAction,
  type OperatingReadout,
  type ProductImprovementCandidate,
  type QaForbiddenSideEffect,
  type QaScope,
  type ResponsibilityRoute,
  type RoutingReason,
  type SensitiveIdentityAttribute,
} from "@/lib/founder-operating-loop/contract";

// ---------------------------------------------------------------------------
// Fixture pack shape
// ---------------------------------------------------------------------------

export type OriginateKind = "investigative" | "actionable";

export interface FounderSignalFixture {
  readonly signalId: string;
  readonly runId: string;
  readonly family: FounderSignalFamily;
  readonly severity: import("@/lib/founder-operating-loop/contract").SignalSeverity;
  readonly originateKind: OriginateKind;
  readonly sourceId: string;
  readonly evidenceBundle: EvidenceBundle;
  readonly helmSelfFace?: HelmSelfFace;
  readonly caseManagementLayer?: CaseManagementLayer;
  readonly judgments: readonly FounderJudgment[];
  readonly route: ResponsibilityRoute;
  readonly action: OperatingAction;
  readonly escalation?: DecisionEscalation;
  readonly productImprovement?: ProductImprovementCandidate;
}

export interface FounderRunFixture {
  readonly run: FounderOperatingRun;
  readonly signals: readonly FounderSignalFixture[];
  readonly readout: OperatingReadout;
  readonly auditedActionIds: readonly string[];
  readonly connectorsUsed: readonly FounderConnectorMinimumSet[];
}

export interface FounderBoundaryCase {
  readonly caseId: string;
  readonly gate: FounderBoundaryGate;
  readonly attemptedAction: string;
  readonly expectedOutcome:
    | "refused"
    | "downgraded_to_review_packet"
    | "downgraded_to_watch_only"
    | "allowed";
  readonly expectedReason: string;
  /**
   * For B6 cases only: the sensitive identity attribute that the
   * attempted ranking input would touch. Must be in
   * SENSITIVE_IDENTITY_ATTRIBUTES.
   */
  readonly sensitiveIdentityAttribute?: SensitiveIdentityAttribute;
}

export interface FounderRoutingCase {
  readonly caseId: string;
  readonly routingReason: RoutingReason;
  readonly scenario: string;
  readonly expectedQueueEntry:
    | "action_item_draft"
    | "helm_product_action_draft"
    | "decision_escalation"
    | "watch_only_or_data_quality_action"
    | "review_packet_only";
}

export interface FounderJudgmentCardinalityCase {
  readonly caseId: string;
  readonly scenario: string;
  readonly judgmentQuestionsPresent: readonly JudgmentQuestion[];
  readonly expectedOutcome: "valid" | "rejected_missing_question";
}

export interface FounderClosureCase {
  readonly caseId: string;
  readonly runId: string;
  readonly duplicateSourceIdCount: number;
  readonly auditCoverageRatio: number;
  readonly externalSideEffectCount: number;
  readonly productImprovementCapturedRatio: number;
  readonly expectedClosurePass: boolean;
}

/**
 * OQ-H Phase 1.5 surface: read-only Q&A positive case. Proves the
 * legitimate Q&A flow returns a data-extract answer with zero
 * observed side effects.
 */
export interface FounderQaPositiveCase {
  readonly caseId: string;
  readonly runId: string;
  readonly scope: QaScope;
  readonly question: string;
  readonly expectedAnswerKind: "data_extract" | "refused_out_of_scope";
  readonly observedSideEffects: readonly QaForbiddenSideEffect[];
  readonly expectedOutcome: "answered_read_only" | "refused";
}

export interface FounderEvalPolicy {
  readonly ownerStanceConfirmedDate: string;
  readonly oqADecision: "row_level_filter_no_schema_change";
  readonly originateMixDefault: { readonly investigative: number; readonly actionable: number };
  /**
   * Absolute-percentage-point tolerance allowed between observed mix
   * and the OQ-B default. 20 means a run with 80/20 still passes;
   * 81/19 fails.
   */
  readonly originateMixToleranceAbsPP: number;
  readonly briefingDailyCap: number;
  readonly ceoReviewBudgetMinutes: number;
  readonly minimumConnectorMatrix: readonly FounderConnectorMinimumSet[];
  readonly supportedSignalFamilies: readonly FounderSignalFamily[];
  readonly boundaryGates: readonly FounderBoundaryGate[];
  readonly minBoundaryCasesPerGate: number;
  readonly routingRules: readonly RoutingReason[];
  readonly judgmentQuestions: readonly JudgmentQuestion[];
  readonly supportedRunScopes: readonly FounderRunScope[];
  readonly requireHelmSelfRunCoversAllFaces: boolean;
  readonly requireCaseManagementRunCoversAllLayers: boolean;
  readonly requireConnectorMinimumSet: boolean;
  readonly requireEvidenceBundleNonEmpty: boolean;
  readonly forbidAutoOutbound: boolean;
  readonly forbidCrossWorkspaceJoin: boolean;
  readonly forbidNonCeoViewer: boolean;
  readonly forbidSensitiveIdentityRanking: boolean;
  readonly thirtyDayReoriginateCooldownDays: number;
}

export interface FounderFixturePack {
  readonly version: string;
  readonly status: string;
  readonly boundary: string;
  readonly policy: FounderEvalPolicy;
  readonly runs: readonly FounderRunFixture[];
  readonly boundaryCases: readonly FounderBoundaryCase[];
  readonly routingCases: readonly FounderRoutingCase[];
  readonly judgmentCardinalityCases: readonly FounderJudgmentCardinalityCase[];
  readonly closureCases: readonly FounderClosureCase[];
  readonly qaPositiveCases: readonly FounderQaPositiveCase[];
}

// ---------------------------------------------------------------------------
// Summary shape
// ---------------------------------------------------------------------------

export interface FounderEvalSummary {
  readonly passed: boolean;
  readonly version: string;
  readonly counts: {
    readonly runsTotal: number;
    readonly helmSelfRunsTotal: number;
    readonly customerVerticalRunsTotal: number;
    readonly signalsTotal: number;
    readonly judgmentsTotal: number;
    readonly boundaryCasesTotal: number;
    readonly routingCasesTotal: number;
    readonly judgmentCardinalityCasesTotal: number;
    readonly closureCasesTotal: number;
    readonly qaPositiveCasesTotal: number;
  };
  readonly incidents: {
    readonly boundaryBreachCount: number;
    readonly emptyEvidenceBundleCount: number;
    readonly duplicateSourceIdCount: number;
    readonly crossWorkspaceJoinCount: number;
    readonly autoOutboundCount: number;
    readonly nonCeoViewerCount: number;
    readonly sensitiveIdentityRankingCount: number;
    readonly briefingCapBreachCount: number;
    readonly judgmentCardinalityBreachCount: number;
    readonly qaSideEffectCount: number;
  };
  readonly coverage: {
    readonly helmSelfFacesCovered: readonly HelmSelfFace[];
    readonly helmSelfFacesMissing: readonly HelmSelfFace[];
    readonly caseManagementLayersCovered: readonly CaseManagementLayer[];
    readonly caseManagementLayersMissing: readonly CaseManagementLayer[];
    readonly boundaryGatesCovered: readonly FounderBoundaryGate[];
    readonly boundaryGatesUnderMinimum: readonly FounderBoundaryGate[];
    readonly routingReasonsCovered: readonly RoutingReason[];
    readonly routingReasonsMissing: readonly RoutingReason[];
    readonly connectorsCovered: readonly FounderConnectorMinimumSet[];
    readonly connectorsMissing: readonly FounderConnectorMinimumSet[];
  };
  readonly mixObservations: ReadonlyArray<{
    readonly runId: string;
    readonly investigativeRatio: number;
    readonly actionableRatio: number;
    readonly withinTolerance: boolean;
  }>;
  readonly failures: ReadonlyArray<{ caseId: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_IDENTITY_SET = new Set<string>(SENSITIVE_IDENTITY_ATTRIBUTES);

function pushFailure(
  failures: Array<{ caseId: string; reason: string }>,
  caseId: string,
  reason: string,
): void {
  failures.push({ caseId, reason });
}

function ratiosWithinTolerance(
  observed: { investigative: number; actionable: number },
  expected: { readonly investigative: number; readonly actionable: number },
  abspp: number,
): boolean {
  const dInv = Math.abs(observed.investigative - expected.investigative) * 100;
  const dAct = Math.abs(observed.actionable - expected.actionable) * 100;
  return dInv <= abspp && dAct <= abspp;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export function runFounderOperatingLoopEval(
  fixturePack: FounderFixturePack = founderCasesFixture as unknown as FounderFixturePack,
): FounderEvalSummary {
  const failures: Array<{ caseId: string; reason: string }> = [];
  const policy = fixturePack.policy;

  // ---- Incident counters ----
  let boundaryBreachCount = 0;
  let emptyEvidenceBundleCount = 0;
  let duplicateSourceIdCount = 0;
  let crossWorkspaceJoinCount = 0;
  let autoOutboundCount = 0;
  let nonCeoViewerCount = 0;
  let sensitiveIdentityRankingCount = 0;
  let briefingCapBreachCount = 0;
  let judgmentCardinalityBreachCount = 0;
  let qaSideEffectCount = 0;

  // ---- Coverage trackers ----
  const helmSelfFacesSeen = new Set<HelmSelfFace>();
  const caseManagementLayersSeen = new Set<CaseManagementLayer>();
  const boundaryGateCounts = new Map<FounderBoundaryGate, number>();
  const routingReasonsSeen = new Set<RoutingReason>();
  const connectorsSeen = new Set<FounderConnectorMinimumSet>();
  const mixObservations: Array<{
    runId: string;
    investigativeRatio: number;
    actionableRatio: number;
    withinTolerance: boolean;
  }> = [];

  // ---- Policy sanity ----
  if (policy.oqADecision !== "row_level_filter_no_schema_change") {
    pushFailure(
      failures,
      "__policy__",
      `oq_a_decision_mismatch:${policy.oqADecision}`,
    );
  }
  // OQ-D is a confirmed owner stance; the fixture may not opt out of
  // the connector minimum check or alter the minimum set.
  if (policy.requireConnectorMinimumSet !== true) {
    pushFailure(
      failures,
      "__policy__",
      "oq_d_requireConnectorMinimumSet_must_be_true",
    );
  }
  const expectedConnectorSet = [...FOUNDER_CONNECTOR_MINIMUM_SET]
    .slice()
    .sort()
    .join(",");
  const observedConnectorSet = [...policy.minimumConnectorMatrix]
    .slice()
    .sort()
    .join(",");
  if (expectedConnectorSet !== observedConnectorSet) {
    pushFailure(
      failures,
      "__policy__",
      `oq_d_minimumConnectorMatrix_mismatch:${observedConnectorSet}!=${expectedConnectorSet}`,
    );
  }
  if (policy.briefingDailyCap !== FOUNDER_BRIEFING_DAILY_CAP) {
    pushFailure(
      failures,
      "__policy__",
      `briefing_cap_mismatch:${policy.briefingDailyCap}!=${FOUNDER_BRIEFING_DAILY_CAP}`,
    );
  }
  if (policy.ceoReviewBudgetMinutes !== FOUNDER_CEO_REVIEW_BUDGET_MINUTES) {
    pushFailure(
      failures,
      "__policy__",
      `review_budget_mismatch:${policy.ceoReviewBudgetMinutes}!=${FOUNDER_CEO_REVIEW_BUDGET_MINUTES}`,
    );
  }
  if (
    policy.originateMixDefault.investigative !==
      FOUNDER_RANKING_MIX_DEFAULT.investigative ||
    policy.originateMixDefault.actionable !==
      FOUNDER_RANKING_MIX_DEFAULT.actionable
  ) {
    pushFailure(failures, "__policy__", "originate_mix_default_mismatch");
  }
  for (const family of policy.supportedSignalFamilies) {
    if (!FOUNDER_SIGNAL_FAMILIES.includes(family)) {
      pushFailure(failures, "__policy__", `unknown_signal_family:${family}`);
    }
  }
  for (const gate of policy.boundaryGates) {
    if (!FOUNDER_BOUNDARY_GATES.includes(gate)) {
      pushFailure(failures, "__policy__", `unknown_boundary_gate:${gate}`);
    }
  }
  for (const r of policy.routingRules) {
    if (!ROUTING_REASONS.includes(r)) {
      pushFailure(failures, "__policy__", `unknown_routing_reason:${r}`);
    }
  }
  for (const q of policy.judgmentQuestions) {
    if (!JUDGMENT_QUESTIONS.includes(q)) {
      pushFailure(failures, "__policy__", `unknown_judgment_question:${q}`);
    }
  }
  for (const s of policy.supportedRunScopes) {
    if (!FOUNDER_RUN_SCOPES.includes(s)) {
      pushFailure(failures, "__policy__", `unknown_run_scope:${s}`);
    }
  }

  // ---- Iterate runs ----
  let helmSelfRunsTotal = 0;
  let customerVerticalRunsTotal = 0;
  let signalsTotal = 0;
  let judgmentsTotal = 0;

  for (const runFixture of fixturePack.runs) {
    const { run, signals, readout, auditedActionIds } = runFixture;

    if (run.scope === "helm_self") helmSelfRunsTotal += 1;
    if (run.scope === "customer_vertical") customerVerticalRunsTotal += 1;

    // Per OQ-L confirmed 2026-05-21: a run is bound to exactly one
    // workspace. Any signal whose sourceId carries a workspace
    // prefix that disagrees with run.workspaceId is a B5 breach.
    const workspaceAcrossSignals = new Set<string>();
    workspaceAcrossSignals.add(run.workspaceId);

    const sourceIdsSeen = new Map<string, number>();
    const actionIdsSeen = new Set<string>();
    const expectedAuditCoverage = new Set<string>();

    let invCount = 0;
    let actCount = 0;

    if (signals.length === 0) {
      pushFailure(failures, run.runId, "run_has_no_signals");
    }

    for (const signal of signals) {
      signalsTotal += 1;

      if (signal.runId !== run.runId) {
        pushFailure(
          failures,
          signal.signalId,
          `signal_run_mismatch:${signal.runId}!=${run.runId}`,
        );
      }

      // Per-signal family must be a known §5.2 family. Without this
      // assertion a typo or drift in the fixture would silently bypass
      // the 8-step input/output mapping the evaluator is supposed to
      // gate.
      if (!FOUNDER_SIGNAL_FAMILIES.includes(signal.family)) {
        pushFailure(
          failures,
          signal.signalId,
          `unknown_signal_family:${signal.family}`,
        );
      }

      // B3: Evidence Bundle must be non-empty for every signal.
      if (signal.evidenceBundle.length === 0) {
        emptyEvidenceBundleCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          "evidence_bundle_empty_violates_B3",
        );
      }

      // B5: cross-workspace join detection. sourceId carries a
      // `workspace:<id>:...` prefix; any prefix that disagrees with
      // run.workspaceId is a B5 breach.
      const prefixMatch = /^workspace:([^:]+):/.exec(signal.sourceId);
      if (prefixMatch) {
        const prefixedWorkspace = prefixMatch[1];
        workspaceAcrossSignals.add(prefixedWorkspace);
        if (prefixedWorkspace !== run.workspaceId) {
          crossWorkspaceJoinCount += 1;
          pushFailure(
            failures,
            signal.signalId,
            `cross_workspace_join_violates_B5:${prefixedWorkspace}!=${run.workspaceId}`,
          );
        }
      }

      // §6.4: duplicate sourceId rate must be 0.
      const prev = sourceIdsSeen.get(signal.sourceId) ?? 0;
      sourceIdsSeen.set(signal.sourceId, prev + 1);

      // §9 face / layer coverage.
      if (run.scope === "helm_self") {
        if (signal.helmSelfFace) {
          if (!HELM_SELF_FACES.includes(signal.helmSelfFace)) {
            pushFailure(
              failures,
              signal.signalId,
              `unknown_helm_self_face:${signal.helmSelfFace}`,
            );
          } else {
            helmSelfFacesSeen.add(signal.helmSelfFace);
          }
        }
        if (signal.caseManagementLayer) {
          pushFailure(
            failures,
            signal.signalId,
            "helm_self_signal_must_not_carry_case_management_layer",
          );
        }
      } else if (run.scope === "customer_vertical") {
        if (signal.caseManagementLayer) {
          if (!CASE_MANAGEMENT_LAYERS.includes(signal.caseManagementLayer)) {
            pushFailure(
              failures,
              signal.signalId,
              `unknown_case_management_layer:${signal.caseManagementLayer}`,
            );
          } else {
            caseManagementLayersSeen.add(signal.caseManagementLayer);
          }
        }
        if (signal.helmSelfFace) {
          pushFailure(
            failures,
            signal.signalId,
            "customer_vertical_signal_must_not_carry_helm_self_face",
          );
        }
      }

      // §6.2 cardinality: four judgments, one per Q1..Q4.
      const seenQuestions = new Set<JudgmentQuestion>();
      for (const j of signal.judgments) {
        judgmentsTotal += 1;
        if (j.signalId !== signal.signalId) {
          pushFailure(
            failures,
            signal.signalId,
            `judgment_signal_mismatch:${j.signalId}`,
          );
        }
        if (!JUDGMENT_QUESTIONS.includes(j.question)) {
          pushFailure(
            failures,
            signal.signalId,
            `unknown_judgment_question:${j.question}`,
          );
        }
        if (seenQuestions.has(j.question)) {
          judgmentCardinalityBreachCount += 1;
          pushFailure(
            failures,
            signal.signalId,
            `duplicate_judgment_question:${j.question}`,
          );
        }
        seenQuestions.add(j.question);
        if (j.confidence < 0 || j.confidence > 1) {
          pushFailure(
            failures,
            signal.signalId,
            `judgment_confidence_out_of_range:${j.confidence}`,
          );
        }
      }
      if (signal.judgments.length !== JUDGMENTS_PER_SIGNAL) {
        judgmentCardinalityBreachCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          `judgment_count_mismatch:${signal.judgments.length}!=${JUDGMENTS_PER_SIGNAL}`,
        );
      }
      const missingQuestions = JUDGMENT_QUESTIONS.filter(
        (q) => !seenQuestions.has(q),
      );
      if (missingQuestions.length > 0) {
        judgmentCardinalityBreachCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          `missing_judgment_questions:${missingQuestions.join(",")}`,
        );
      }

      // §6.3 routing: reviewer must always be CEO.
      if (signal.route.reviewer !== "ceo") {
        nonCeoViewerCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          `route_reviewer_must_be_ceo:${signal.route.reviewer}`,
        );
      }
      if (!ROUTING_REASONS.includes(signal.route.routingReason)) {
        pushFailure(
          failures,
          signal.signalId,
          `unknown_routing_reason:${signal.route.routingReason}`,
        );
      }
      routingReasonsSeen.add(signal.route.routingReason);

      // §6.3 R3: no_owner_escalate must produce a DecisionEscalation.
      if (signal.route.routingReason === "no_owner_escalate") {
        if (!signal.escalation) {
          pushFailure(
            failures,
            signal.signalId,
            "R3_no_owner_must_produce_decision_escalation",
          );
        }
      }

      // §6.3 R5: external_side_effect must yield review_packet_only
      // and no draft execution.
      if (signal.route.routingReason === "external_side_effect") {
        if (signal.action.actionType !== "review_packet_only") {
          pushFailure(
            failures,
            signal.signalId,
            `R5_external_side_effect_must_be_review_packet_only:${signal.action.actionType}`,
          );
        }
      }

      // B4 Phase 1 invariant: in the offline contract no CEO event has
      // ever occurred, so every action must be in its initial
      // review-pending state. Any non-initial status or executionMode
      // is treated as evidence of auto-advance — including the
      // "ceo_approved + ceo_advanced_*" pair which is a runtime
      // post-advance state and has no business appearing in a Phase 1
      // fixture. Phase 2.5+ will need its own evaluator that admits
      // advanced states paired with audited CEO events.
      if (signal.action.status !== "awaiting_ceo_review") {
        autoOutboundCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          `phase_1_action_status_must_be_awaiting_ceo_review:${signal.action.status}`,
        );
      }
      if (signal.action.executionMode !== "awaiting_ceo_review") {
        autoOutboundCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          `phase_1_action_execution_mode_must_be_awaiting_ceo_review:${signal.action.executionMode}`,
        );
      }

      // Action evidence bundle should mirror signal evidence bundle.
      if (signal.action.evidenceRefs.length === 0) {
        emptyEvidenceBundleCount += 1;
        pushFailure(
          failures,
          signal.signalId,
          "action_evidence_bundle_empty_violates_B3",
        );
      }

      // Track action ID + audit expectation.
      if (actionIdsSeen.has(signal.action.actionId)) {
        pushFailure(
          failures,
          signal.signalId,
          `duplicate_action_id:${signal.action.actionId}`,
        );
      }
      actionIdsSeen.add(signal.action.actionId);
      expectedAuditCoverage.add(signal.action.actionId);

      // §6.2 Q4 -> ProductImprovementCandidate when gap exposed.
      const q4 = signal.judgments.find((j) => j.question === "Q4");
      if (q4 && q4.answer === "gap_present" && !signal.productImprovement) {
        pushFailure(
          failures,
          signal.signalId,
          "Q4_gap_present_must_produce_product_improvement_candidate",
        );
      }

      // OQ-B mix accounting.
      if (signal.originateKind === "investigative") invCount += 1;
      else if (signal.originateKind === "actionable") actCount += 1;
      else {
        pushFailure(
          failures,
          signal.signalId,
          `unknown_originate_kind:${signal.originateKind as string}`,
        );
      }
    }

    // §6.4 duplicate sourceId.
    for (const [sourceId, count] of sourceIdsSeen) {
      if (count > 1) {
        duplicateSourceIdCount += count - 1;
        pushFailure(
          failures,
          run.runId,
          `duplicate_source_id:${sourceId}:${count}`,
        );
      }
    }

    // §6.4 audit coverage: every action must be in auditedActionIds.
    const auditedSet = new Set(auditedActionIds);
    for (const expectedId of expectedAuditCoverage) {
      if (!auditedSet.has(expectedId)) {
        pushFailure(
          failures,
          run.runId,
          `audit_missing_for_action:${expectedId}`,
        );
      }
    }

    // OQ-G briefing cap.
    if (readout.runId !== run.runId) {
      pushFailure(
        failures,
        run.runId,
        `readout_run_mismatch:${readout.runId}!=${run.runId}`,
      );
    }
    if (readout.nextSafeActions.length > policy.briefingDailyCap) {
      briefingCapBreachCount += 1;
      pushFailure(
        failures,
        run.runId,
        `briefing_cap_breach:${readout.nextSafeActions.length}>${policy.briefingDailyCap}`,
      );
    }
    if (readout.actionsCreated !== expectedAuditCoverage.size) {
      pushFailure(
        failures,
        run.runId,
        `readout_actions_created_mismatch:${readout.actionsCreated}!=${expectedAuditCoverage.size}`,
      );
    }
    for (const nsa of readout.nextSafeActions) {
      if (nsa.evidenceRefs.length === 0) {
        emptyEvidenceBundleCount += 1;
        pushFailure(
          failures,
          run.runId,
          `next_safe_action_evidence_bundle_empty:${nsa.title}`,
        );
      }
    }

    // OQ-D connector minimum set.
    for (const c of runFixture.connectorsUsed) {
      connectorsSeen.add(c);
    }
    if (policy.requireConnectorMinimumSet) {
      const missing = FOUNDER_CONNECTOR_MINIMUM_SET.filter(
        (c) => !runFixture.connectorsUsed.includes(c),
      );
      if (missing.length > 0) {
        pushFailure(
          failures,
          run.runId,
          `connector_minimum_set_missing:${missing.join(",")}`,
        );
      }
    }

    // OQ-B mix tolerance.
    const total = invCount + actCount;
    if (total > 0) {
      const observed = {
        investigative: invCount / total,
        actionable: actCount / total,
      };
      const within = ratiosWithinTolerance(
        observed,
        policy.originateMixDefault,
        policy.originateMixToleranceAbsPP,
      );
      mixObservations.push({
        runId: run.runId,
        investigativeRatio: observed.investigative,
        actionableRatio: observed.actionable,
        withinTolerance: within,
      });
      if (!within) {
        pushFailure(
          failures,
          run.runId,
          `originate_mix_out_of_tolerance:inv=${observed.investigative.toFixed(2)},act=${observed.actionable.toFixed(2)}`,
        );
      }
    }
  }

  // §9 face / layer coverage (across all runs of a scope).
  if (policy.requireHelmSelfRunCoversAllFaces) {
    const missing = HELM_SELF_FACES.filter((f) => !helmSelfFacesSeen.has(f));
    if (helmSelfRunsTotal > 0 && missing.length > 0) {
      pushFailure(
        failures,
        "__coverage__",
        `helm_self_faces_missing:${missing.join(",")}`,
      );
    }
    if (helmSelfRunsTotal === 0) {
      pushFailure(failures, "__coverage__", "helm_self_run_missing");
    }
  }
  if (policy.requireCaseManagementRunCoversAllLayers) {
    const missing = CASE_MANAGEMENT_LAYERS.filter(
      (l) => !caseManagementLayersSeen.has(l),
    );
    if (customerVerticalRunsTotal > 0 && missing.length > 0) {
      pushFailure(
        failures,
        "__coverage__",
        `case_management_layers_missing:${missing.join(",")}`,
      );
    }
    if (customerVerticalRunsTotal === 0) {
      pushFailure(failures, "__coverage__", "customer_vertical_run_missing");
    }
  }

  // ---- Boundary cases ----
  for (const bc of fixturePack.boundaryCases) {
    if (!FOUNDER_BOUNDARY_GATES.includes(bc.gate)) {
      pushFailure(failures, bc.caseId, `unknown_boundary_gate:${bc.gate}`);
      continue;
    }
    boundaryGateCounts.set(bc.gate, (boundaryGateCounts.get(bc.gate) ?? 0) + 1);

    if (bc.expectedOutcome === "allowed") {
      boundaryBreachCount += 1;
      pushFailure(
        failures,
        bc.caseId,
        `boundary_case_must_not_be_allowed:${bc.gate}`,
      );
    }
    if (!bc.expectedReason.trim()) {
      pushFailure(failures, bc.caseId, "boundary_case_missing_reason");
    }

    if (bc.gate === "B6_no_sensitive_identity_ranking") {
      if (!bc.sensitiveIdentityAttribute) {
        pushFailure(
          failures,
          bc.caseId,
          "B6_case_must_name_sensitive_identity_attribute",
        );
      } else if (!SENSITIVE_IDENTITY_SET.has(bc.sensitiveIdentityAttribute)) {
        sensitiveIdentityRankingCount += 1;
        pushFailure(
          failures,
          bc.caseId,
          `B6_attribute_not_in_pipl_set:${bc.sensitiveIdentityAttribute}`,
        );
      }
    }
  }
  const boundaryGatesUnderMinimum = FOUNDER_BOUNDARY_GATES.filter(
    (g) => (boundaryGateCounts.get(g) ?? 0) < policy.minBoundaryCasesPerGate,
  );
  if (boundaryGatesUnderMinimum.length > 0) {
    pushFailure(
      failures,
      "__coverage__",
      `boundary_gates_under_minimum:${boundaryGatesUnderMinimum
        .map((g) => `${g}=${boundaryGateCounts.get(g) ?? 0}`)
        .join(",")}`,
    );
  }

  // ---- Routing rules ----
  for (const rc of fixturePack.routingCases) {
    if (!ROUTING_REASONS.includes(rc.routingReason)) {
      pushFailure(
        failures,
        rc.caseId,
        `unknown_routing_reason:${rc.routingReason}`,
      );
    } else {
      routingReasonsSeen.add(rc.routingReason);
    }
    if (!rc.scenario.trim()) {
      pushFailure(failures, rc.caseId, "routing_case_missing_scenario");
    }
  }
  const routingReasonsMissing = ROUTING_REASONS.filter(
    (r) => !routingReasonsSeen.has(r),
  );
  if (routingReasonsMissing.length > 0) {
    pushFailure(
      failures,
      "__coverage__",
      `routing_reasons_missing:${routingReasonsMissing.join(",")}`,
    );
  }

  // ---- Judgment cardinality cases ----
  for (const jc of fixturePack.judgmentCardinalityCases) {
    const presentSet = new Set(jc.judgmentQuestionsPresent);
    const missing = JUDGMENT_QUESTIONS.filter((q) => !presentSet.has(q));
    const isComplete = missing.length === 0;
    const cardinalityValid = isComplete;
    const expectedValid = jc.expectedOutcome === "valid";
    if (cardinalityValid !== expectedValid) {
      judgmentCardinalityBreachCount += 1;
      pushFailure(
        failures,
        jc.caseId,
        `judgment_cardinality_case_mismatch:expected=${jc.expectedOutcome},actualComplete=${isComplete}`,
      );
    }
  }

  // ---- Closure cases ----
  for (const cc of fixturePack.closureCases) {
    if (!fixturePack.runs.some((r) => r.run.runId === cc.runId)) {
      pushFailure(failures, cc.caseId, `closure_case_unknown_run:${cc.runId}`);
    }
    if (cc.duplicateSourceIdCount > 0 && cc.expectedClosurePass) {
      pushFailure(
        failures,
        cc.caseId,
        "closure_case_duplicate_should_block_pass",
      );
    }
    if (cc.auditCoverageRatio < 1 && cc.expectedClosurePass) {
      pushFailure(
        failures,
        cc.caseId,
        `closure_case_audit_below_full_blocks_pass:${cc.auditCoverageRatio}`,
      );
    }
    if (cc.externalSideEffectCount > 0 && cc.expectedClosurePass) {
      pushFailure(
        failures,
        cc.caseId,
        `closure_case_external_side_effect_blocks_pass:${cc.externalSideEffectCount}`,
      );
    }
  }

  // ---- Q&A positive cases (OQ-H Phase 1.5 read-only surface) ----
  const knownRunIds = new Set(fixturePack.runs.map((r) => r.run.runId));
  for (const qc of fixturePack.qaPositiveCases) {
    if (!knownRunIds.has(qc.runId)) {
      pushFailure(failures, qc.caseId, `qa_case_unknown_run:${qc.runId}`);
    }
    if (!QA_SCOPES.includes(qc.scope)) {
      pushFailure(failures, qc.caseId, `qa_case_unknown_scope:${qc.scope}`);
    }
    if (!qc.question.trim()) {
      pushFailure(failures, qc.caseId, "qa_case_missing_question");
    }
    for (const se of qc.observedSideEffects) {
      if (!QA_FORBIDDEN_SIDE_EFFECTS.includes(se)) {
        pushFailure(
          failures,
          qc.caseId,
          `qa_case_unknown_side_effect:${se as string}`,
        );
      }
    }
    if (qc.observedSideEffects.length > 0) {
      qaSideEffectCount += qc.observedSideEffects.length;
      pushFailure(
        failures,
        qc.caseId,
        `qa_observed_forbidden_side_effects:${qc.observedSideEffects.join(",")}`,
      );
    }
    if (
      qc.expectedAnswerKind === "data_extract" &&
      qc.expectedOutcome !== "answered_read_only"
    ) {
      pushFailure(
        failures,
        qc.caseId,
        `qa_data_extract_must_be_answered_read_only:${qc.expectedOutcome}`,
      );
    }
    if (
      qc.expectedAnswerKind === "refused_out_of_scope" &&
      qc.expectedOutcome !== "refused"
    ) {
      pushFailure(
        failures,
        qc.caseId,
        `qa_refused_out_of_scope_must_be_refused:${qc.expectedOutcome}`,
      );
    }
  }
  if (fixturePack.qaPositiveCases.length === 0) {
    pushFailure(
      failures,
      "__coverage__",
      "qa_positive_cases_missing_must_have_at_least_one",
    );
  }

  const connectorsMissing = FOUNDER_CONNECTOR_MINIMUM_SET.filter(
    (c) => !connectorsSeen.has(c),
  );

  const incidents = {
    boundaryBreachCount,
    emptyEvidenceBundleCount,
    duplicateSourceIdCount,
    crossWorkspaceJoinCount,
    autoOutboundCount,
    nonCeoViewerCount,
    sensitiveIdentityRankingCount,
    briefingCapBreachCount,
    judgmentCardinalityBreachCount,
    qaSideEffectCount,
  } as const;

  const helmSelfFacesMissing = HELM_SELF_FACES.filter(
    (f) => !helmSelfFacesSeen.has(f),
  );
  const caseManagementLayersMissing = CASE_MANAGEMENT_LAYERS.filter(
    (l) => !caseManagementLayersSeen.has(l),
  );

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    counts: {
      runsTotal: fixturePack.runs.length,
      helmSelfRunsTotal,
      customerVerticalRunsTotal,
      signalsTotal,
      judgmentsTotal,
      boundaryCasesTotal: fixturePack.boundaryCases.length,
      routingCasesTotal: fixturePack.routingCases.length,
      judgmentCardinalityCasesTotal: fixturePack.judgmentCardinalityCases.length,
      closureCasesTotal: fixturePack.closureCases.length,
      qaPositiveCasesTotal: fixturePack.qaPositiveCases.length,
    },
    incidents,
    coverage: {
      helmSelfFacesCovered: Array.from(helmSelfFacesSeen).sort(),
      helmSelfFacesMissing,
      caseManagementLayersCovered: Array.from(caseManagementLayersSeen).sort(),
      caseManagementLayersMissing,
      boundaryGatesCovered: Array.from(boundaryGateCounts.keys()).sort(),
      boundaryGatesUnderMinimum,
      routingReasonsCovered: Array.from(routingReasonsSeen).sort(),
      routingReasonsMissing: ROUTING_REASONS.filter(
        (r) => !routingReasonsSeen.has(r),
      ),
      connectorsCovered: Array.from(connectorsSeen).sort(),
      connectorsMissing,
    },
    mixObservations,
    failures,
  };
}
