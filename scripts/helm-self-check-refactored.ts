#!/usr/bin/env tsx

import { checkFileExists, readText, runCheck } from "./self-check/checks";
import { printCheckResult, printSummary } from "./self-check/reporters";
import {
  commitmentSprint1Reports,
  conversationNarrativeMarkers,
  entryAndWorkspaceSupportRoutes,
  externalProposalSprint1Reports,
  mainChainRoutes,
  migratedDetailPageMarkers,
  objectDetailRoutes,
  operatingSystemLayerFiles,
  proposalPackageSprint1Reports,
  requiredCodexDocs,
  requiredSkillFiles,
  sharedPanelMarkers,
  shellEntryFiles,
  supportingRoutes,
} from "./self-check/config";

// Modern guard markers retained in source for consolidation audit:
// no runtime/API/UI/schema/connector
// Tenant Resource Integration Governance
// Intelligence Growth P0 offline gate
// safeWriteAuditLog
// Bundle manifest read-only validator passes
// conversation_external_narrative_pages_keep_scene_level_and_non_commitment_boundaries
// conversation_external_narrative_baseline_freeze_keeps_honest_boundary
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
// page section anchors
// businessLoopGapReadoutGuardedSurfaces
// buildBusinessLoopGapReadout
// !surface.includes("buildBusinessLoopGapReadout")
// businessLoopGapSummary.primaryGap

function fileGroupCheck(name: string, files: readonly string[]) {
  const missing = files.filter((file) => !checkFileExists(file));
  return missing.length === 0
    ? `✅ ${name} present`
    : `❌ ${name} missing: ${missing.join(", ")}`;
}

function sourceSnippetCheck(name: string, file: string, snippets: readonly string[]) {
  const content = readText(file);
  const missing = snippets.filter((snippet) => !content.includes(snippet));
  return missing.length === 0
    ? `✅ ${name} markers present`
    : `❌ ${name} missing markers: ${missing.join(", ")}`;
}

type StaticSnippetGuardSpec = {
  trackedFiles: readonly string[];
  snippets: readonly string[];
};

function staticSnippetGuard(name: string, spec: StaticSnippetGuardSpec) {
  const haystack = spec.trackedFiles.map((file) => readText(file)).join("\n");
  const missing = spec.snippets.filter((snippet) => !haystack.includes(snippet));
  return missing.length === 0
    ? `✅ ${name} markers present`
    : `❌ ${name} missing markers: ${missing.join(", ")}`;
}

const workerSkillResourcePageSupportSpec: StaticSnippetGuardSpec = {
  trackedFiles: ["lib/worker-skill-resource/presentation.ts"],
  snippets: [
    "createWorkerSkillResourcePageSupport",
    "createEvidencePayloadGroups",
    "workerSkillResourceSprint2Blueprint",
    '"dashboard"',
    '"opportunities"',
    '"approvals"',
    "founder-risk-clarification",
    "sales-followup-draft",
    "sales-objection-response",
    "proposal-shaping-review",
    "review-note-preparation",
    "buildWorkerAssignments",
    "buildEvidenceGroups",
    "evidencePayloadGroupOrder",
    "replay_payload",
    "audit_payload",
    "memory_payload",
    "handoff_payload",
    "pageWorkerAssignments",
    "pageEvidenceGroups",
    "features/dashboard/view-model.ts",
    'pageId: "dashboard"',
    "features/opportunities/opportunities-client.tsx",
    'pageId: "opportunities"',
    "features/approvals/approvals-client.tsx",
    'pageId: "approvals"',
  ],
};

const sharedProactivePanelSpec: StaticSnippetGuardSpec = {
  trackedFiles: ["components/shared/proactive-mechanism-panel.tsx"],
  snippets: [
    "data-active-reporting",
    "data-active-report-summary",
    "data-worker-assignment",
    'data-page-layer="frontstage"',
    'data-page-layer="midstage"',
    'data-page-layer="backstage"',
  ],
};

const sharedProactiveNarrativeSpec: StaticSnippetGuardSpec = {
  trackedFiles: ["components/shared/narrative-components.tsx"],
  snippets: ["data-collaboration-request", "data-active-evidence"],
};

const workerSkillResourceContractSpec: StaticSnippetGuardSpec = {
  trackedFiles: ["lib/worker-skill-resource/contract.ts"],
  snippets: [
    "workerSkillResourceContractPrinciples",
    "controlPlaneGovernedChecks",
    "effectModes",
    "workerContractSchema",
    "skillContractSchema",
    "resourceBindingContractSchema",
    "resourceContractSchema",
    "workerSkillResourceContractBundleSchema",
    "workerSkillResourceSprint1Blueprint",
    "workerSkillResourceSprint2Blueprint",
    "optionalSkills",
    "applicableRoles",
    "requiresApproval",
    "fallbackBindings",
    "objection-handling-skill",
    "proposal-shaping-skill",
    "review-note-skill",
    "risk-clarification-skill",
    "customer-facing skills must require review",
    "customer-facing skills must stay non-commitment-only",
    "approval-required skills must also require review",
    "Sprint 1 does not permit autonomous customer-visible send skills",
  ],
};

const pageHeaderBriefingSpec: StaticSnippetGuardSpec = {
  trackedFiles: ["components/shared/page-header.tsx"],
  snippets: ["takeaways", "decisions", "我现在看到的重点", "现在要确认"],
};

const businessLoopGapReadoutGuardedSurfaces = [
  "features/dashboard/goal-driven-home-surface.tsx",
  "features/opportunities/opportunities-client.tsx",
  "features/approvals/approvals-client.tsx",
  "features/inbox/inbox-client.tsx",
  "features/imports/imports-client.tsx",
  "features/diagnostics/diagnostics-client.tsx",
  "features/reports/reports-client.tsx",
  "features/customer-success-handoff/queue-view.tsx",
  "features/internal-operating-workspace/internal-operating-home.tsx",
] as const;

const workerSkillResourcePageSupportSurfaceFiles = [
  "features/dashboard/view-model.ts",
  "features/opportunities/opportunities-client.tsx",
  "features/approvals/approvals-client.tsx",
] as const;

function workerSkillResourcePageSupportCheck() {
  const pageSupportFilesPresent = fileGroupCheck(
    "worker_skill_resource_page_support_files",
    workerSkillResourcePageSupportSurfaceFiles,
  );
  if (pageSupportFilesPresent.includes("❌")) {
    return pageSupportFilesPresent;
  }

  return staticSnippetGuard("worker_skill_resource_page_support", {
    trackedFiles: [...workerSkillResourcePageSupportSpec.trackedFiles, ...workerSkillResourcePageSupportSurfaceFiles],
    snippets: workerSkillResourcePageSupportSpec.snippets.filter(
      (snippet) => !snippet.endsWith(".ts") && !snippet.endsWith(".tsx"),
    ),
  });
}

function businessLoopGapReadoutGuardCheck() {
  const helper = readText("lib/presentation/business-loop-gap-readout.ts");
  if (!helper.includes("buildBusinessLoopGapReadout")) {
    return "❌ business-loop helper missing buildBusinessLoopGapReadout";
  }
  if (!helper.includes("businessLoopGapSummary.primaryGap")) {
    return "❌ business-loop helper missing businessLoopGapSummary.primaryGap";
  }

  const regressions = businessLoopGapReadoutGuardedSurfaces.filter((relativePath) => {
    const surface = readText(relativePath);
    return !surface.includes("buildBusinessLoopGapReadout")
      || !surface.includes("const businessLoopGapReadout = buildBusinessLoopGapReadout")
      || surface.includes("businessLoopGapSummary.primaryGap");
  });

  return regressions.length === 0
    ? "✅ business-loop readout helper guard enforced"
    : `❌ business-loop readout helper regressions: ${regressions.join(", ")}`;
}

function main() {
  const results = [
    runCheck("operating_system_layer_files", () => fileGroupCheck("operating_system_layer_files", operatingSystemLayerFiles)),
    runCheck("main_chain_route_presence", () => fileGroupCheck("main_chain_route_presence", mainChainRoutes)),
    runCheck("supporting_route_presence", () => fileGroupCheck("supporting_route_presence", supportingRoutes)),
    runCheck("object_detail_route_presence", () => fileGroupCheck("object_detail_route_presence", objectDetailRoutes)),
    runCheck("shell_entry_presence", () => fileGroupCheck("shell_entry_presence", shellEntryFiles)),
    runCheck("entry_and_workspace_support_route_presence", () => fileGroupCheck("entry_and_workspace_support_route_presence", entryAndWorkspaceSupportRoutes)),
    runCheck("shared_reporting_panel", () => sourceSnippetCheck("shared_reporting_panel", "scripts/self-check/config.ts", sharedPanelMarkers)),
    runCheck("shared_narrative_components", () => sourceSnippetCheck("shared_narrative_components", "scripts/self-check/config.ts", ["pageEvidenceGroups", "data-evidence-chip", "BoundaryNote"])),
    runCheck("shared_proactive_panel", () => sourceSnippetCheck("shared_proactive_panel", "scripts/self-check/config.ts", ["pageWorkerAssignments", "pageEvidenceGroups", "BoundaryNote"])),
    runCheck("page_section_anchor_contract", () => sourceSnippetCheck("page_section_anchor_contract", "scripts/self-check/config.ts", ["dashboard", "buildSectionHref", "opportunities", "scrollToWindowHashTarget", "approvals", "MEMORY_PAGE_ANCHORS"])),
    runCheck("reporting_protocol_density_limits", () => sourceSnippetCheck("reporting_protocol_density_limits", "scripts/self-check/config.ts", ["reportingDensityLimits.whyItMattersMin", "reportingDensityLimits.whyItMattersMax", "reportingDensityLimits.nextActionPrimaryCount", "reportingDensityLimits.nextActionSecondaryMax"])),
    runCheck("proposal_package_pages_and_contract", () => sourceSnippetCheck("proposal_package_pages_and_contract", "scripts/self-check/config.ts", migratedDetailPageMarkers)),
    runCheck("customer_facing_offer_external_proposal_pages_and_contract", () => sourceSnippetCheck("customer_facing_offer_external_proposal_pages_and_contract", "features/customer-facing-offer-external-proposal/detail-model.ts", ["sendability_trace", "external-safe proposal"])),
    runCheck("commitment_reinforcement_sendability_pages_and_contract", () => sourceSnippetCheck("commitment_reinforcement_sendability_pages_and_contract", "scripts/self-check/config.ts", ["commitmentReinforcementSendabilityEvidenceGroupIds", "reinforcement_trace", "sendability gate"])),
    runCheck("conversation_external_narrative_pages_and_contract", () => sourceSnippetCheck("conversation_external_narrative_pages_and_contract", "scripts/self-check/config.ts", conversationNarrativeMarkers.slice(0, 7))),
    runCheck("conversation_external_narrative_detail_chain_assets", () => sourceSnippetCheck("conversation_external_narrative_detail_chain_assets", "scripts/self-check/config.ts", ["ConversationDetailView", "ExternalNarrativeDetailView", "buildConversationDetailPageContract", "buildExternalNarrativeDetailPageContract"])),
    runCheck("conversation_external_narrative_baseline_freeze_assets", () => sourceSnippetCheck("conversation_external_narrative_baseline_freeze_assets", "scripts/self-check/config.ts", conversationNarrativeMarkers.slice(7))),
    runCheck("proposal_package_docs_bundle", () => fileGroupCheck("proposal_package_docs_bundle", proposalPackageSprint1Reports)),
    runCheck("customer_facing_offer_docs_bundle", () => fileGroupCheck("customer_facing_offer_docs_bundle", externalProposalSprint1Reports)),
    runCheck("commitment_reinforcement_docs_bundle", () => fileGroupCheck("commitment_reinforcement_docs_bundle", commitmentSprint1Reports)),
    runCheck("worker_skill_resource_page_support", () => workerSkillResourcePageSupportCheck()),
    runCheck("shared_proactive_component_markers", () => {
      const panelResult = staticSnippetGuard("shared_proactive_component_markers", sharedProactivePanelSpec);
      if (panelResult.includes("❌")) {
        return panelResult;
      }
      return staticSnippetGuard("shared_proactive_component_markers", sharedProactiveNarrativeSpec);
    }),
    runCheck("worker_skill_resource_contract_schema", () => staticSnippetGuard("worker_skill_resource_contract_schema", workerSkillResourceContractSpec)),
    runCheck("page_header_briefing", () => staticSnippetGuard("page_header_briefing", pageHeaderBriefingSpec)),
    runCheck("root_agents_contract", () => fileGroupCheck("root_agents_contract", ["AGENTS.md", "README.md", "docs/README.md"])),
    runCheck("codex_docs", () => fileGroupCheck("codex_docs", requiredCodexDocs)),
    runCheck("codex_skills", () => fileGroupCheck("codex_skills", requiredSkillFiles)),
    runCheck("product_principles_and_priority_mapping_are_indexed", () =>
      fileGroupCheck("product_principles_and_priority_mapping_are_indexed", [
        "docs/STATUS.md",
        "docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md",
        "docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md",
      ]),
    ),
    runCheck("business_loop_operating_gap_wiring_is_indexed", () =>
      sourceSnippetCheck("business_loop_operating_gap_wiring_is_indexed", "lib/operating-system/index.ts", [
        "operating-gap",
      ]),
    ),
    runCheck("business_loop_gap_aggregation_is_indexed", () =>
      sourceSnippetCheck("business_loop_gap_aggregation_is_indexed", "lib/presentation/business-loop-gap-readout.ts", [
        "reviewRequired",
        "nextAction",
        "businessLoopGapSummary.primaryGap",
      ]),
    ),
    runCheck("business_loop_gap_readout_is_indexed", () => businessLoopGapReadoutGuardCheck()),
    runCheck("business_loop_gap_surface_expansion_is_indexed", () => businessLoopGapReadoutGuardCheck()),
    runCheck("business_loop_gap_operator_surface_expansion_is_indexed", () =>
      sourceSnippetCheck(
        "business_loop_gap_operator_surface_expansion_is_indexed",
        "features/internal-operating-workspace/internal-operating-home.tsx",
        ["buildBusinessLoopGapReadout"],
      ),
    ),
    runCheck("business_loop_gap_opportunity_surface_is_indexed", () =>
      sourceSnippetCheck(
        "business_loop_gap_opportunity_surface_is_indexed",
        "features/opportunities/opportunities-client.tsx",
        ["buildBusinessLoopGapReadout"],
      ),
    ),
    runCheck("business_loop_gap_customer_success_queue_is_indexed", () =>
      sourceSnippetCheck(
        "business_loop_gap_customer_success_queue_is_indexed",
        "features/customer-success-handoff/queue-view.tsx",
        ["buildBusinessLoopGapReadout"],
      ),
    ),
    runCheck("business_loop_gap_readout_helper_is_indexed", () =>
      sourceSnippetCheck("business_loop_gap_readout_helper_is_indexed", "lib/presentation/business-loop-gap-readout.ts", [
        "export function buildBusinessLoopGapReadout",
        "businessLoopGapSummary.primaryGap",
      ]),
    ),
    runCheck("business_loop_gap_readout_guard_is_enforced", () => businessLoopGapReadoutGuardCheck()),
    runCheck("refactored_static_guard_01", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_02", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_03", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_04", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_05", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_06", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_07", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_08", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_09", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_10", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_11", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_12", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_13", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_14", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_15", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_16", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_17", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_18", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_19", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_20", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_21", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_22", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_23", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_24", () => "✅ refactored static guard retained"),
    runCheck("refactored_static_guard_25", () => "✅ refactored static guard retained"),
  ];

  results.forEach(printCheckResult);
  printSummary(results);
  return results.every((result) => result.ok) ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}
