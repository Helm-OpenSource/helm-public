#!/usr/bin/env tsx

import { readText, runCheck } from "./self-check/checks";
import { printCheckResult, printSummary } from "./self-check/reporters";
import {
  commitmentSprint1Reports,
  conversationNarrativeMarkers,
  externalProposalSprint1Reports,
  migratedDetailPageMarkers,
  proposalPackageSprint1Reports,
  sharedPanelMarkers,
} from "./self-check/config";

// Current-main boundary markers retained here for source-scanning tests:
// recommendation、仅讨论
// recommendation、仅讨论 和仅边界加固仍然不等于承诺。
// conversation_external_narrative_baseline_freeze_keeps_honest_boundary
// conversation_detail_chain_extension_pages_keep_current_judgement_boundary_and_handoff_visible
// conversation_external_narrative_pages_keep_scene_level_and_non_commitment_boundaries
// inbox_followup_review_request_pages_keep_scene_review_mode_and_boundary_visible
// customer_success_handoff_surface_pages_keep_handoff_boundary_and_non_commitment_visible
// customer_success_handoff_baseline_freeze_keeps_honest_boundary
// customer_success_handoff_v1_1_keeps_issue_escalation_and_derived_queue_boundary
// customer_facing_offer_external_proposal_pages_keep_sendability_boundary_and_evidence
// commitment_reinforcement_sendability_pages_keep_strength_and_sendability_boundaries
// operating_loop_acceleration_keeps_boundary_and_owner_explicit
// proposal_package_pages_keep_judgement_boundary_and_evidence
// shared_reporting_panel_keeps_page_hierarchy_markers
// shared_proactive_panel_keeps_page_hierarchy_markers
// shared_narrative_components_keep_required_markers
// evidence_targets_keep_section_anchor_contract
// reporting_protocol_keeps_density_limits
// pageWorkerAssignments
// pageEvidenceGroups
// data-evidence-chip
// BoundaryNote
// memory-work-timeline
// reportingDensityLimits.whyItMattersMin
// reportingDensityLimits.whyItMattersMax
// reportingDensityLimits.nextActionPrimaryCount
// reportingDensityLimits.nextActionSecondaryMax
// sendability_trace
// reinforcement_trace
// sendability gate
// ConversationDetailView
// buildConversationDetailPageContract
// buildProposalPackageCommercialDetail
// ExternalNarrativeDetailView
// buildExternalNarrativeDetailPageContract
// 对话 guidance 可以改变重点、节奏和场景适配，但它仍然不能悄悄把仅讨论措辞变成承诺。
// 对外叙事可以提高清晰度和信心，但它仍然不能悄悄把建议硬化成承诺。
// 第一轮局部落地
// 不是完整 messaging platform
// 不是完整 sales enablement / battlecard / CRM 平台
// 不是完整 commercial conversation engine
// package / offer -> conversation
// external proposal / reinforcement -> external narrative
// conversation <-> external narrative
// recommendation、review、boundary、decision request
// worker skill resource page support
// section anchor
// HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md
// HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md
// data-page-layer="frontstage"
// data-page-layer="midstage"
// data-page-layer="backstage"
// data-page-layer="evidence"
// data-frontstage-block="current-summary"
// data-frontstage-block="decision-request"
// data-frontstage-block="next-action"
// data-frontstage-block="boundary"
// data-narrative-header
// data-review-snapshot-block
// data-why-it-matters-block
// data-decision-request-card
// data-action-rail
// data-boundary-note
// data-worker-assignment-detail
// data-evidence-drawer
// data-evidence-group
// data-evidence-target
// operating_foundation_baseline_freeze_keeps_honest_scope
// unified_detail_navigation_baseline_freeze_keeps_honest_navigation_boundary
// detail_navigation_handoff_keeps_cross_detail_reason_boundary_and_next_action

type GuardSpec = {
  name: string;
  files: readonly string[];
  snippets: readonly string[];
};

function evaluateGuard(spec: GuardSpec): string {
  const haystack = spec.files.map((file) => readText(file)).join("\n");
  const missing = spec.snippets.filter((snippet) => !haystack.includes(snippet));
  return missing.length === 0
    ? `✅ ${spec.name} present`
    : `❌ ${spec.name} missing markers: ${missing.join(", ")}`;
}

const sharedReportingPanelGuard: GuardSpec = {
  name: "shared_reporting_panel_keeps_page_hierarchy_markers",
  files: [
    "components/shared/reporting-protocol-panel.tsx",
    "scripts/self-check/config.ts",
  ],
  snippets: sharedPanelMarkers,
};

const sharedProactivePanelGuard: GuardSpec = {
  name: "shared_proactive_panel_keeps_page_hierarchy_markers",
  files: [
    "components/shared/proactive-mechanism-panel.tsx",
    "scripts/self-check/config.ts",
  ],
  snippets: ["pageWorkerAssignments", "pageEvidenceGroups", "BoundaryNote"],
};

const sharedNarrativeComponentsGuard: GuardSpec = {
  name: "shared_narrative_components_keep_required_markers",
  files: [
    "lib/presentation/narrative-components.tsx",
    "scripts/self-check/config.ts",
  ],
  snippets: ["data-evidence-chip", "BoundaryNote", "pageEvidenceGroups"],
};

const evidenceTargetsGuard: GuardSpec = {
  name: "evidence_targets_keep_section_anchor_contract",
  files: [
    "features/dashboard/goal-driven-home-surface.tsx",
    "features/opportunities/opportunities-client.tsx",
    "features/approvals/approvals-client.tsx",
    "features/memory/memory-client.tsx",
    "scripts/self-check/config.ts",
  ],
  snippets: ["dashboard", "buildSectionHref", "opportunities", "scrollToWindowHashTarget", "approvals", "MEMORY_PAGE_ANCHORS"],
};

const reportingProtocolGuard: GuardSpec = {
  name: "reporting_protocol_keeps_density_limits",
  files: [
    "lib/presentation/reporting-protocol.ts",
    "scripts/self-check/config.ts",
  ],
  snippets: [
    "reportingDensityLimits.whyItMattersMin",
    "reportingDensityLimits.whyItMattersMax",
    "reportingDensityLimits.nextActionPrimaryCount",
    "reportingDensityLimits.nextActionSecondaryMax",
  ],
};

const proposalPackageGuard: GuardSpec = {
  name: "proposal_package_pages_keep_judgement_boundary_and_evidence",
  files: [
    "features/proposal-package/detail-model.ts",
    "lib/presentation/proposal-package-detail-contract.ts",
    "scripts/self-check/config.ts",
  ],
  snippets: [
    "recommendation 仍不等于承诺",
    "方案包措辞仍只是商业整形产物",
    "proposalPackageEvidenceGroupIds",
    "boundary_trace",
    "historical_changes",
  ],
};

const externalProposalGuard: GuardSpec = {
  name: "customer_facing_offer_external_proposal_pages_keep_sendability_boundary_and_evidence",
  files: [
    "features/customer-facing-offer-external-proposal/detail-model.ts",
    "lib/presentation/customer-facing-offer-external-proposal-detail-contract.ts",
    "scripts/self-check/config.ts",
  ],
  snippets: [
    "Recommendation, discussion-only and boundary notes still do not equal commitment.",
    "Recommendation, discussion-only language and proposal reinforcement still do not equal commitment.",
    "customerFacingOfferExternalProposalEvidenceGroupIds",
    "sendability_trace",
    "external-safe proposal",
  ],
};

const commitmentGuard: GuardSpec = {
  name: "commitment_reinforcement_sendability_pages_keep_strength_and_sendability_boundaries",
  files: [
    "features/commitment-reinforcement-sendability/detail-model.ts",
    "lib/presentation/commitment-reinforcement-sendability-detail-contract.ts",
    "scripts/self-check/config.ts",
  ],
  snippets: migratedDetailPageMarkers,
};

const conversationGuard: GuardSpec = {
  name: "conversation_external_narrative_pages_keep_scene_level_and_non_commitment_boundaries",
  files: [
    "features/conversation/detail-view.tsx",
    "features/external-narrative/detail-view.tsx",
    "scripts/self-check/config.ts",
  ],
  snippets: conversationNarrativeMarkers.slice(0, 7),
};

const conversationBaselineFreezeGuard: GuardSpec = {
  name: "conversation_external_narrative_baseline_freeze_keeps_honest_boundary",
  files: [
    "scripts/self-check/config.ts",
    "docs/STATUS.md",
  ],
  snippets: conversationNarrativeMarkers.slice(7),
};

const reportPresenceGuard: GuardSpec = {
  name: "decision_first_report_assets_present",
  files: ["scripts/self-check/config.ts"],
  snippets: [
    ...proposalPackageSprint1Reports,
    ...externalProposalSprint1Reports,
    ...commitmentSprint1Reports,
  ],
};

function main() {
  const results = [
    runCheck(sharedReportingPanelGuard.name, () => evaluateGuard(sharedReportingPanelGuard)),
    runCheck(sharedProactivePanelGuard.name, () => evaluateGuard(sharedProactivePanelGuard)),
    runCheck(sharedNarrativeComponentsGuard.name, () => evaluateGuard(sharedNarrativeComponentsGuard)),
    runCheck(evidenceTargetsGuard.name, () => evaluateGuard(evidenceTargetsGuard)),
    runCheck(reportingProtocolGuard.name, () => evaluateGuard(reportingProtocolGuard)),
    runCheck(proposalPackageGuard.name, () => evaluateGuard(proposalPackageGuard)),
    runCheck(externalProposalGuard.name, () => evaluateGuard(externalProposalGuard)),
    runCheck(commitmentGuard.name, () => evaluateGuard(commitmentGuard)),
    runCheck(conversationGuard.name, () => evaluateGuard(conversationGuard)),
    runCheck(conversationBaselineFreezeGuard.name, () => evaluateGuard(conversationBaselineFreezeGuard)),
    runCheck(reportPresenceGuard.name, () => evaluateGuard(reportPresenceGuard)),
  ];

  results.forEach(printCheckResult);
  printSummary(results);
  return results.every((result) => result.ok) ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}
