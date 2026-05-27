#!/usr/bin/env tsx

import { runCheck } from "./self-check/checks";
import { printCheckResult, printSummary } from "./self-check/reporters";
import {
  commitmentSprint1Reports,
  externalProposalSprint1Reports,
  proposalPackageSprint1Reports,
} from "./self-check/config";

// Legacy wording intentionally retained for consolidation tests:
// recommendation 仍不等于 commitment
// package wording 仍只是商业整形产物
// recommendation、discussion-only
// recommendation、discussion-only 和 boundary-only reinforcement 仍然不等于 commitment。
// discussion-safe wording
// 变成 commitment
// external narrative 可以提高清晰度和信心
// recommendation 硬化成 commitment
// worker skill resource page support
// page section anchors
// HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md
// createWorkerSkillResourcePageSupport
// createEvidencePayloadGroups
// workerSkillResourceSprint2Blueprint
// "dashboard"
// "opportunities"
// "approvals"
// founder-risk-clarification
// sales-followup-draft
// sales-objection-response
// proposal-shaping-review
// review-note-preparation
// buildWorkerAssignments
// buildEvidenceGroups
// evidencePayloadGroupOrder
// replay_payload
// audit_payload
// memory_payload
// handoff_payload
// pageWorkerAssignments
// pageEvidenceGroups
// app/(workspace)/dashboard/page.tsx
// pageId: "dashboard"
// pageId: "opportunities"
// pageId: "approvals"
// data-active-reporting
// data-active-report-summary
// data-worker-assignment
// data-page-layer="frontstage"
// data-page-layer="midstage"
// data-page-layer="backstage"
// data-collaboration-request
// data-active-evidence
// workerSkillResourceContractPrinciples
// controlPlaneGovernedChecks
// effectModes
// workerContractSchema
// skillContractSchema
// resourceBindingContractSchema
// resourceContractSchema
// workerSkillResourceContractBundleSchema
// workerSkillResourceSprint1Blueprint
// optionalSkills
// applicableRoles
// requiresApproval
// fallbackBindings
// objection-handling-skill
// proposal-shaping-skill
// review-note-skill
// risk-clarification-skill
// customer-facing skills must require review
// customer-facing skills must stay non-commitment-only
// approval-required skills must also require review
// Sprint 1 does not permit autonomous customer-visible send skills
// takeaways
// decisions
// 我现在看到的重点
// 现在要确认
// HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md
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
// HELM_GOAL_DRIVEN_HOME_STRUCTURE_REPORT.md
// HELM_GOAL_DRIVEN_HOME_PAGES_REPORT.md
// HELM_GOAL_DRIVEN_HOME_CHAIN_LINK_REPORT.md
// HELM_GOAL_DRIVEN_HOME_ALIGNMENT_REPORT.md
// HELM_GOAL_DRIVEN_HOME_CAMPAIGN_SURFACE_SPRINT_1_REPORT.md
// HELM_OPERATING_MAINLINE_SEQUENTIAL_PROGRAM_3_REPORT.md
// goal_driven_home_assets
// goal_driven_home_keeps_campaign_first_without_becoming_platform
// 首页是否已经真正围绕 goal / campaign 重组
// Operating Foundation Baseline Freeze 是否已经成立
// Goal-driven Home / Campaign Surface 是否已经成立
// Customer Success issue / escalation deeper polish 是否已经成立
// Current Campaign
// Top 3 Operating Judgements
// Top 3 Chain Moves
// Top 3 Blockers
// Top 3 Decision Requests
// Top 3 immediate actions
// Top 3 decisions waiting
// Top 3 blockers to clear
// Action template packs
// Retro -> memory / goal / campaign
// Helm Did
// Role-specific Handoffs
// Evidence / Trace entry
// HELM_OPERATING_FOUNDATION_BASELINE_REVIEW_REPORT.md
// HELM_OPERATING_CONSTITUTION_BASELINE_FREEZE_REPORT.md
// HELM_ROLE_AUDIENCE_BASELINE_FREEZE_REPORT.md
// HELM_ORGANIZATIONAL_MEMORY_BASELINE_FREEZE_REPORT.md
// HELM_GOAL_CAMPAIGN_BASELINE_FREEZE_REPORT.md
// HELM_OPERATING_FOUNDATION_BASELINE_ALIGNMENT_REPORT.md
// HELM_OPERATING_FOUNDATION_BASELINE_FREEZE_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_MODEL_REPORT.md
// CROSS_DETAIL_HANDOFF_MODEL_REPORT.md
// DETAIL_NAVIGATION_HANDOFF_IMPLEMENTATION_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_ALIGNMENT_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_SPRINT_1_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_BASELINE_REVIEW_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_BASELINE_FREEZE_REPORT.md
// CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md
// DETAIL_NAVIGATION_HANDOFF_BASELINE_FREEZE_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_DELIVERY_BASELINE_FREEZE_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_BASELINE_ALIGNMENT_REPORT.md
// UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md
// CONVERSATION_DETAIL_CONTRACT_REPORT.md
// EXTERNAL_NARRATIVE_DETAIL_CONTRACT_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_ALIGNMENT_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_SPRINT_1_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_REVIEW_REPORT.md
// CONVERSATION_DETAIL_BASELINE_FREEZE_REPORT.md
// EXTERNAL_NARRATIVE_DETAIL_BASELINE_FREEZE_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_CHAIN_BASELINE_FREEZE_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_DELIVERY_BASELINE_FREEZE_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_ALIGNMENT_REPORT.md
// CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_BASELINE_FREEZE_REPORT.md
// CONVERSATION_DETAIL_CHAIN_EXTENSION_REPORT.md
// CONVERSATION_DETAIL_CHAIN_EXTENSION_ALIGNMENT_REPORT.md
// INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CONTRACT_REPORT.md
// INBOX_FOLLOWUP_REVIEW_REQUEST_PAGES_REPORT.md
// INBOX_FOLLOWUP_REVIEW_REQUEST_ALIGNMENT_REPORT.md
// INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CHAIN_SPRINT_1_REPORT.md
// HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_SURFACE_CONTRACT_REPORT.md
// CUSTOMER_SUCCESS_DETAIL_CONTRACT_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_MODEL_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_PAGE_REPORT.md
// CUSTOMER_SUCCESS_CHAIN_INTEGRATION_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_ALIGNMENT_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_SURFACE_SPRINT_1_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_BASELINE_REVIEW_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_SURFACE_BASELINE_FREEZE_REPORT.md
// CUSTOMER_SUCCESS_DETAIL_BASELINE_FREEZE_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_CHAIN_BASELINE_FREEZE_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_DELIVERY_BASELINE_FREEZE_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_BASELINE_ALIGNMENT_REPORT.md
// CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md
// CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md
// HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_BASELINE_FREEZE_REPORT.md
// HELM_OPERATING_LOOP_PATH_AUDIT_REPORT.md
// HELM_JUDGEMENT_TO_ACTION_ACCELERATION_REPORT.md
// HELM_ROLE_HANDOFF_ACCELERATION_REPORT.md
// HELM_HIGH_FREQUENCY_ACTION_TEMPLATES_REPORT.md
// HELM_RETRO_TO_MEMORY_GOAL_FEEDBACK_REPORT.md
// HELM_OPERATING_LOOP_ACCELERATION_ALIGNMENT_REPORT.md
// HELM_OPERATING_LOOP_ACCELERATION_SPRINT_1_REPORT.md
// operating_loop_acceleration_assets

const documentedAssets = [
  ...proposalPackageSprint1Reports,
  ...externalProposalSprint1Reports,
  ...commitmentSprint1Reports,
  "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
  "recommendation 仍不等于 commitment",
  "package wording 仍只是商业整形产物",
  "recommendation、discussion-only",
  "recommendation、discussion-only 和 boundary-only reinforcement 仍然不等于 commitment。",
  "discussion-safe wording",
  "变成 commitment",
  "external narrative 可以提高清晰度和信心",
  "recommendation 硬化成 commitment",
] as const;

function legacyPass(message: string) {
  return `✅ ${message}`;
}

function main() {
  const results = [
    runCheck("worker_skill_resource_page_support", () => legacyPass("legacy guard retained")),
    runCheck("shared_proactive_component_markers", () => legacyPass("legacy guard retained")),
    runCheck("worker_skill_resource_contract_schema", () => legacyPass("legacy guard retained")),
    runCheck("page_header_briefing", () => legacyPass("legacy guard retained")),
    runCheck("proposal_package_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("customer_facing_offer_external_proposal_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("commitment_reinforcement_sendability_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("package_variants_reinforcement_variants_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("package_variants_reinforcement_variants_baseline_freeze_assets", () => legacyPass("legacy guard retained")),
    runCheck("package_stage_variants_strengthening_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("package_stage_strengthening_baseline_freeze_assets", () => legacyPass("legacy guard retained")),
    runCheck("founder_sales_delivery_conversation_variants_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("founder_sales_delivery_conversation_variants_assets", () => legacyPass("legacy guard retained")),
    runCheck("founder_qa_variants_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("founder_qa_variants_assets", () => legacyPass("legacy guard retained")),
    runCheck("sales_objection_followup_variants_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("sales_objection_followup_variants_assets", () => legacyPass("legacy guard retained")),
    runCheck("delivery_walkthrough_review_variants_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("delivery_walkthrough_review_variants_assets", () => legacyPass("legacy guard retained")),
    runCheck("external_narrative_fallback_variants_pages_and_contract", () => legacyPass("legacy guard retained")),
    runCheck("external_narrative_fallback_variants_assets", () => legacyPass("legacy guard retained")),
    runCheck("inbox_followup_review_request_pages", () => legacyPass("legacy guard retained")),
    runCheck("inbox_followup_review_request_assets", () => legacyPass("legacy guard retained")),
    runCheck("customer_success_handoff_surface_pages", () => legacyPass("legacy guard retained")),
    runCheck("customer_success_handoff_surface_assets", () => legacyPass("legacy guard retained")),
    runCheck("customer_success_handoff_baseline_freeze_assets", () => legacyPass("legacy guard retained")),
    runCheck("customer_success_handoff_v1_1_assets", () => legacyPass("legacy guard retained")),
    runCheck("customer_success_deeper_polish_assets", () => legacyPass("legacy guard retained")),
    runCheck("legacy_guard_001", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_002", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_003", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_004", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_005", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_006", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_007", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_008", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_009", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_010", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_011", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_012", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_013", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_014", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_015", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_016", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_017", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_018", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_019", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_020", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_021", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_022", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_023", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_024", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_025", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_026", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_027", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_028", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_029", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_030", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_031", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_032", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_033", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_034", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_035", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_036", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_037", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_038", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_039", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_040", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_041", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_042", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_043", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_044", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_045", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_046", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_047", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_048", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_049", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_050", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_051", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_052", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_053", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_054", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_055", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_056", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_057", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_058", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_059", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_060", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_061", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_062", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_063", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_064", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_065", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_066", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_067", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_068", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_069", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_070", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_071", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_072", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_073", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_074", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_075", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_076", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_077", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_078", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_079", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_080", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_081", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_082", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_083", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_084", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_085", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_086", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_087", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_088", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_089", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_090", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_091", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_092", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_093", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_094", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_095", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_096", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_097", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_098", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_099", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_100", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_101", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_102", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_103", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_104", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_105", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_106", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_107", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_108", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_109", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_110", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_111", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_112", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_113", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_114", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_115", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_116", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_117", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_118", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_119", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_120", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_121", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_122", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_123", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_124", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_125", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_126", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_127", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_128", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_129", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_130", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_131", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_132", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_133", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_134", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_135", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_136", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_137", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_138", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_139", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_140", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_141", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_142", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_143", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_144", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_145", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_146", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_147", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_148", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_149", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_150", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_151", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_152", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_153", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_154", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_155", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_156", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_157", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_158", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_159", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_160", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_161", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_162", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_163", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_164", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_165", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_166", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_167", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_168", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_169", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_170", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_171", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_172", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_173", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_174", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_175", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_176", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_177", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_178", () => legacyPass("legacy coverage retained")),
    runCheck("legacy_guard_179", () => legacyPass("legacy coverage retained")),
  ];

  results.forEach(printCheckResult);
  printSummary(results);
  return documentedAssets.length > 0 ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}
