// Phase 1 offline gate only: this file must stay fixture-backed and must not
// import runtime queries, Prisma, UI, API handlers, provider SDKs, or LLM SDKs.
import fixturePack from "@/evals/operating-signal-flow/signal-flow-cases.json";
import {
  OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET,
  OPERATING_SIGNAL_BLOCKED_STATES,
  OPERATING_SIGNAL_LEGAL_TRANSITIONS,
  OPERATING_SIGNAL_REQUIRED_STATES,
  type OperatingSignalFlowCase,
  type OperatingSignalFlowCaseResult,
  type OperatingSignalFlowEvalSummary,
  type OperatingSignalFlowEvent,
  type OperatingSignalFlowFixturePack,
  type OperatingSignalFlowSnapshot,
} from "@/lib/operating-signal-flow/contract";
import { selectHighestPressurePath } from "@/lib/operating-signal-flow/projection";
import {
  containsForbiddenAuthorityText,
  findForbiddenAuthorityKeyFragment,
} from "@/lib/shared/forbidden-authority-keys";

export { selectHighestPressurePath };

export type {
  OperatingSignalBlocker,
  OperatingSignalDataPosture,
  OperatingSignalFamily,
  OperatingSignalFlowCase,
  OperatingSignalFlowCaseResult,
  OperatingSignalFlowEdge,
  OperatingSignalFlowEvalSummary,
  OperatingSignalFlowEvent,
  OperatingSignalFlowFixturePack,
  OperatingSignalFlowNode,
  OperatingSignalFlowSnapshot,
  OperatingSignalState,
  OperatingSignalTrigger,
} from "@/lib/operating-signal-flow/contract";

export function runOperatingSignalFlowEval(
  pack: OperatingSignalFlowFixturePack = fixturePack as OperatingSignalFlowFixturePack,
): OperatingSignalFlowEvalSummary {
  const caseResults = pack.cases.map((item) => evaluateOperatingSignalFlowCase(item));
  const allEvents = caseResults.flatMap((result) => {
    const sourceCase = pack.cases.find((item) => item.id === result.caseId);
    return sourceCase?.snapshot.events ?? [];
  });
  const signalFamilyCount = new Set(allEvents.map((item) => item.signalFamily)).size;
  const blockerCoverageCount = new Set(
    allEvents.flatMap((item) => (item.currentBlockerType ? [item.currentBlockerType] : [])),
  ).size;
  const requiredStateCoverageCount = OPERATING_SIGNAL_REQUIRED_STATES.filter((state) =>
    allEvents.some((item) => item.transitionTo === state),
  ).length;
  const failures = caseResults.flatMap((item) =>
    item.failures.map((reason) => ({ caseId: item.caseId, reason })),
  );
  const crossTenantProjectionCount = sum(caseResults, "crossTenantProjectionCount");
  const llmTransitionCount = sum(caseResults, "llmTransitionCount");
  const llmRankingCount = sum(caseResults, "llmRankingCount");
  const rawPayloadEchoCount = sum(caseResults, "rawPayloadEchoCount");
  const authorityLeakCount = sum(caseResults, "authorityLeakCount");
  const invalidRouteCount = sum(caseResults, "invalidRouteCount");

  pushSummaryFailure(failures, pack.cases.length < pack.targets.minimumTotalCases, "minimum_total_cases");
  pushSummaryFailure(
    failures,
    !pack.cases.some((item) => item.id === pack.entryPoints.happyPathCaseId),
    "happy_path_entry_point_missing",
  );
  pushSummaryFailure(failures, signalFamilyCount < pack.targets.minimumSignalFamilyCount, "minimum_signal_family_count");
  pushSummaryFailure(
    failures,
    blockerCoverageCount < pack.targets.minimumBlockerCoverageCount,
    "minimum_blocker_coverage_count",
  );
  pushSummaryFailure(
    failures,
    requiredStateCoverageCount < pack.targets.minimumRequiredStateCoverageCount,
    "minimum_required_state_coverage_count",
  );
  pushSummaryFailure(
    failures,
    crossTenantProjectionCount > pack.targets.maximumCrossTenantProjectionCount,
    "cross_tenant_projection_count",
  );
  pushSummaryFailure(failures, llmTransitionCount > pack.targets.maximumLlmTransitionCount, "llm_transition_count");
  pushSummaryFailure(failures, llmRankingCount > pack.targets.maximumLlmRankingCount, "llm_ranking_count");
  pushSummaryFailure(failures, rawPayloadEchoCount > pack.targets.maximumRawPayloadEchoCount, "raw_payload_echo_count");
  pushSummaryFailure(failures, authorityLeakCount > pack.targets.maximumAuthorityLeakCount, "authority_leak_count");
  pushSummaryFailure(failures, invalidRouteCount > pack.targets.maximumInvalidRouteCount, "invalid_route_count");

  return {
    passed: failures.length === 0,
    version: pack.version,
    totalCases: pack.cases.length,
    signalFamilyCount,
    blockerCoverageCount,
    requiredStateCoverageCount,
    crossTenantProjectionCount,
    llmTransitionCount,
    llmRankingCount,
    rawPayloadEchoCount,
    authorityLeakCount,
    invalidRouteCount,
    caseResults,
    failures,
  };
}

export function evaluateOperatingSignalFlowCase(
  evalCase: OperatingSignalFlowCase,
): OperatingSignalFlowCaseResult {
  const { snapshot } = evalCase;
  const failures: string[] = [];
  const workspaceIds = new Set([
    snapshot.workspaceId,
    ...snapshot.nodes.map((item) => item.workspaceId),
    ...snapshot.edges.map((item) => item.workspaceId),
    ...snapshot.events.map((item) => item.workspaceId),
  ]);
  const coveredStates = unique(snapshot.events.map((item) => item.transitionTo));
  const coveredBlockers = unique(
    snapshot.events.flatMap((item) => (item.currentBlockerType ? [item.currentBlockerType] : [])),
  );
  const boundaryIncidentCount = snapshot.events.filter((item) => item.boundaryCheckResult === "blocked").length;
  const blockedCount = snapshot.events.filter((item) => item.currentBlockerType !== null).length;
  const reviewRequiredCount = snapshot.events.filter((item) => item.reviewerRequired).length;
  const crossTenantProjectionCount = snapshot.events.filter((item) => item.crossTenantProjection).length;
  const llmTransitionCount = snapshot.events.filter((item) => item.triggeredBy === "llm").length;
  const llmRankingCount = snapshot.events.filter((item) => item.confidenceSource === "llm_ranking").length;
  const rawPayloadEchoCount = countRawPayloadEchoes(evalCase);
  const authorityLeakCount = countAuthorityLeaks(evalCase);
  const invalidRouteCount = snapshot.events.reduce(
    (count, item) =>
      count + item.allowedNextActions.filter((action) => !OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET.has(action)).length,
    0,
  );
  const selectedPathSignalKey = selectHighestPressurePath(snapshot);

  pushFailure(failures, workspaceIds.size !== 1, "workspace_scope_not_single");
  pushFailure(failures, snapshot.dataPosture !== evalCase.expectedDataPosture, "data_posture_mismatch");
  pushFailure(
    failures,
    selectedPathSignalKey !== evalCase.expectedSelectedPathSignalKey,
    "highest_pressure_path_mismatch",
  );
  pushFailure(
    failures,
    snapshot.selectedPathSignalKey !== evalCase.expectedSelectedPathSignalKey,
    "snapshot_selected_path_mismatch",
  );
  pushFailure(
    failures,
    boundaryIncidentCount !== evalCase.expectedBoundaryIncidentCount,
    "boundary_incident_count_mismatch",
  );
  pushFailure(failures, blockedCount !== evalCase.expectedBlockedCount, "blocked_count_mismatch");
  pushFailure(
    failures,
    reviewRequiredCount !== evalCase.expectedReviewRequiredCount,
    "review_required_count_mismatch",
  );
  pushFailure(failures, !snapshot.boundaryStatementVisible, "boundary_statement_missing");
  pushFailure(failures, crossTenantProjectionCount > 0, "cross_tenant_projection_present");
  pushFailure(failures, llmTransitionCount > 0, "llm_triggered_transition_present");
  pushFailure(failures, llmRankingCount > 0, "llm_final_ranking_present");
  pushFailure(failures, rawPayloadEchoCount > 0, "raw_payload_echo_present");
  pushFailure(failures, authorityLeakCount > 0, "authority_leak_present");
  pushFailure(failures, invalidRouteCount > 0, "invalid_allowed_next_action_route");

  for (const event of snapshot.events) {
    validateEvent(event, snapshot.events, failures);
  }
  validateDataPosture(snapshot, failures);
  validateEdges(snapshot, failures);

  return {
    caseId: evalCase.id,
    dataPosture: snapshot.dataPosture,
    selectedPathSignalKey,
    expectedSelectedPathSignalKey: evalCase.expectedSelectedPathSignalKey,
    eventCount: snapshot.events.length,
    workspaceCount: workspaceIds.size,
    signalFamilyCount: new Set(snapshot.events.map((item) => item.signalFamily)).size,
    coveredStates,
    coveredBlockers,
    boundaryIncidentCount,
    blockedCount,
    reviewRequiredCount,
    crossTenantProjectionCount,
    llmTransitionCount,
    llmRankingCount,
    rawPayloadEchoCount,
    authorityLeakCount,
    invalidRouteCount,
    failures,
  };
}

function validateEvent(
  event: OperatingSignalFlowEvent,
  events: OperatingSignalFlowEvent[],
  failures: string[],
) {
  const transitionKey = `${event.transitionFrom ?? "null"}->${event.transitionTo}`;
  pushFailure(
    failures,
    !OPERATING_SIGNAL_LEGAL_TRANSITIONS.has(transitionKey),
    `illegal_transition:${event.id}:${transitionKey}`,
  );
  pushFailure(failures, !event.boundaryNote.trim(), `missing_boundary_note:${event.id}`);
  pushFailure(
    failures,
    event.evidenceCoverage.required > 0 && event.evidenceCoverage.provided > event.evidenceCoverage.required,
    `evidence_coverage_overflow:${event.id}`,
  );
  pushFailure(
    failures,
    event.triggeredBy === "deterministic_rule" && !event.ruleId,
    `missing_rule_id:${event.id}`,
  );
  pushFailure(
    failures,
    (event.triggeredBy === "owner" || event.triggeredBy === "reviewer") && !event.actorRef,
    `missing_actor_ref:${event.id}`,
  );
  pushFailure(
    failures,
    OPERATING_SIGNAL_BLOCKED_STATES.has(event.transitionTo) && !event.currentBlockerType,
    `missing_blocker_type:${event.id}`,
  );
  pushFailure(
    failures,
    Boolean(event.currentBlockerType) && !event.blockerSince,
    `missing_blocker_since:${event.id}`,
  );
  pushFailure(
    failures,
    event.transitionTo === "AWAITING_RECEIPT" && !event.awaitingReceiptSince,
    `missing_awaiting_receipt_since:${event.id}`,
  );
  pushFailure(
    failures,
    event.transitionTo === "DUPLICATE_COMPRESSED" && (!event.dedupeKey || !event.mergedIntoSignalKey),
    `missing_duplicate_pointer:${event.id}`,
  );
  pushFailure(
    failures,
    event.transitionTo === "MERGED" && !event.mergedIntoSignalKey,
    `missing_merge_pointer:${event.id}`,
  );
  pushFailure(
    failures,
    event.transitionTo === "SUPERSEDED" && !event.supersededBySignalKey,
    `missing_supersede_pointer:${event.id}`,
  );
  pushFailure(
    failures,
    event.transitionTo === "REVOKED" && !event.revocationReason,
    `missing_revocation_reason:${event.id}`,
  );
  pushFailure(
    failures,
    event.previousEventId !== null && !events.some((candidate) => candidate.id === event.previousEventId),
    `missing_previous_event:${event.id}`,
  );
  pushFailure(
    failures,
    event.causedByEventId !== null && !events.some((candidate) => candidate.id === event.causedByEventId),
    `missing_caused_by_event:${event.id}`,
  );
  pushFailure(
    failures,
    event.redactionStatus === "raw_blocked" && event.transitionTo !== "QUARANTINED",
    `raw_blocked_not_quarantined:${event.id}`,
  );
  validateSignalPointer(event, "mergedIntoSignalKey", events, failures);
  validateSignalPointer(event, "supersededBySignalKey", events, failures);
}

function validateDataPosture(snapshot: OperatingSignalFlowSnapshot, failures: string[]) {
  const headline = snapshot.judgementHeadline.replace(/^(示例|Sample):\s*/iu, "");
  const allowedPrefixes = ["流畅", "积压", "阻塞", "Flowing", "Backlog", "Blocked"];
  pushFailure(
    failures,
    !allowedPrefixes.some((prefix) => headline.startsWith(prefix)),
    "judgement_headline_prefix_invalid",
  );
  if (snapshot.dataPosture === "empty") {
    pushFailure(failures, snapshot.nodes.length > 0, "empty_posture_has_nodes");
    pushFailure(failures, snapshot.edges.length > 0, "empty_posture_has_edges");
    pushFailure(failures, snapshot.events.length > 0, "empty_posture_has_events");
    pushFailure(failures, snapshot.selectedPathSignalKey !== null, "empty_posture_selected_path");
  }
  if (snapshot.dataPosture === "fixture") {
    pushFailure(failures, !snapshot.judgementHeadline.startsWith("示例:"), "fixture_headline_missing_sample_prefix");
    pushFailure(failures, !snapshot.fixtureBannerVisible, "fixture_banner_missing");
    pushFailure(failures, snapshot.animationPolicy !== "disabled", "fixture_animation_not_disabled");
  }
  if (snapshot.dataPosture === "degraded") {
    pushFailure(
      failures,
      snapshot.judgementHeadline.startsWith("流畅") ||
        snapshot.judgementHeadline.startsWith("Flowing"),
      "degraded_posture_marked_flowing",
    );
  }
}

function validateEdges(snapshot: OperatingSignalFlowSnapshot, failures: string[]) {
  const nodeIds = new Set(snapshot.nodes.map((item) => item.id));
  for (const edge of snapshot.edges) {
    pushFailure(failures, edge.direction !== "forward", `edge_not_forward:${edge.id}`);
    pushFailure(failures, !nodeIds.has(edge.fromNodeId), `missing_edge_from_node:${edge.id}`);
    pushFailure(failures, !nodeIds.has(edge.toNodeId), `missing_edge_to_node:${edge.id}`);
    pushFailure(
      failures,
      edge.boundaryCounter > 0 && edge.sweepEligible,
      `boundary_edge_sweep_enabled:${edge.id}`,
    );
    pushFailure(
      failures,
      snapshot.dataPosture === "fixture" && edge.sweepEligible,
      `fixture_edge_sweep_enabled:${edge.id}`,
    );
  }
}

function validateSignalPointer(
  event: OperatingSignalFlowEvent,
  field: "mergedIntoSignalKey" | "supersededBySignalKey",
  events: OperatingSignalFlowEvent[],
  failures: string[],
) {
  const targetSignalKey = event[field];
  if (!targetSignalKey) return;

  pushFailure(failures, targetSignalKey === event.signalKey, `self_signal_pointer:${event.id}:${field}`);
  pushFailure(
    failures,
    !events.some((candidate) => candidate.signalKey === targetSignalKey),
    `missing_signal_pointer:${event.id}:${field}`,
  );
}

function countRawPayloadEchoes(value: unknown): number {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized.includes("raw payload") || normalized.includes("unredacted payload") ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countRawPayloadEchoes(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<number>((count, [key, item]) => {
      if (key.toLowerCase().includes("payload")) return count + 1;
      return count + countRawPayloadEchoes(item);
    }, 0);
  }
  return 0;
}

function countAuthorityLeaks(value: unknown): number {
  if (typeof value === "string") {
    return containsForbiddenAuthorityText(value) ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countAuthorityLeaks(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<number>((count, [key, item]) => {
      const forbiddenTrueFlag =
        item === true && findForbiddenAuthorityKeyFragment(key) !== null ? 1 : 0;
      return count + forbiddenTrueFlag + countAuthorityLeaks(item);
    }, 0);
  }
  return 0;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function sum<T extends Record<K, number>, K extends string>(items: T[], key: K): number {
  return items.reduce((total, item) => total + item[key], 0);
}

function pushFailure(failures: string[], condition: boolean, reason: string) {
  if (condition) failures.push(reason);
}

function pushSummaryFailure(
  failures: Array<{ caseId: string; reason: string }>,
  condition: boolean,
  reason: string,
) {
  if (condition) failures.push({ caseId: "__summary__", reason });
}
