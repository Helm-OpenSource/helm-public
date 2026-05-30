import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const root = process.cwd();

const requiredEnvVars = [
  "DATABASE_URL",
  "APP_URL",
  "ALIYUN_MAIL_IMAP_HOST",
  "ALIYUN_MAIL_IMAP_PORT",
  "ALIYUN_MAIL_SMTP_HOST",
  "ALIYUN_MAIL_SMTP_PORT",
  "DINGTALK_CLIENT_ID",
  "DINGTALK_CLIENT_SECRET",
  "DINGTALK_REDIRECT_URI",
  "CONNECTOR_TOKEN_SECRET",
  "HUBSPOT_CLIENT_ID",
  "HUBSPOT_CLIENT_SECRET",
  "HUBSPOT_REDIRECT_URI",
  "SALESFORCE_CLIENT_ID",
  "SALESFORCE_CLIENT_SECRET",
  "SALESFORCE_REDIRECT_URI",
  "SALESFORCE_AUTH_BASE_URL",
  "SALESFORCE_API_VERSION",
  "WECOM_CLIENT_ID",
  "WECOM_CLIENT_SECRET",
  "WECOM_REDIRECT_URI",
  "OPENAI_API_KEY",
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL",
  "LLM_ENABLED",
  "LLM_DEFAULT_PROVIDER",
  "LLM_DEFAULT_MODEL",
  "LLM_EXTRACTION_MODEL",
  "LLM_BRIEFING_MODEL",
  "LLM_REASONING_MODEL",
  "LLM_BASE_URL",
  "ASR_ENABLED",
  "ASR_OPENAI_MODEL",
  "ASR_LANGUAGE",
];

const requiredDocs = [
  "AGENTS.md",
  "README.md",
  "docs/README.md",
  "docs/codex/README.md",
  "docs/codex/batch_task_master_template.md",
  "docs/codex/execution_receipt_template.md",
  "docs/codex/definition_of_done.md",
  "docs/codex/release_checklist.md",
  "docs/codex/report_template_freeze.md",
  "docs/codex/report_template_sprint.md",
  "docs/codex/CODEX_INFRA_PACK_ALIGNMENT_REPORT.md",
  "docs/codex/CODEX_INFRA_PACK_SPRINT_1_REPORT.md",
  "docs/pilot/delivery-boundary.md",
  "docs/pilot/pre-pilot-checklist.md",
  "docs/pilot/manual-acceptance-paths.md",
  "docs/pilot/minimal-evals.md",
  "docs/pilot/SHARED_AGENT_PILOT_READINESS_V1.md",
  "docs/pilot/SHARED_AGENT_PILOT_RUNBOOK_V1.md",
  "docs/pilot/SHARED_AGENT_PILOT_OBSERVATION_TEMPLATE_V1.md",
  "docs/reviews/SHARED_AGENT_PILOT_READINESS_REPORT.md",
  "docs/reviews/SHARED_AGENT_PILOT_SESSION_REPORT_TEMPLATE.md",
  "docs/product/HELM_PRODUCT_PRINCIPLES_V1.md",
  "docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md",
  "docs/product/HELM_V2_1_REFLECTION_CONSOLIDATION_BASELINE_V1.md",
  "docs/reviews/HELM_V2_1_REFLECTION_CONSOLIDATION_REPORT_V1.md",
  "docs/product/HELM_DEFINITION_ASSIST_BASELINE_V1.md",
  "docs/reviews/HELM_DEFINITION_ASSIST_REPORT_V1.md",
  "docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md",
  "docs/reviews/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_PLAN_V1.md",
  "docs/reviews/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_REPORT_V1.md",
  "docs/product/HELM_SKILL_SUGGESTION_BASELINE_V1.md",
  "docs/reviews/HELM_SKILL_SUGGESTION_PLAN_V1.md",
  "docs/reviews/HELM_SKILL_SUGGESTION_REPORT_V1.md",
  "docs/product/HELM_SKILL_FORMAL_REVIEW_QUEUE_BASELINE_V1.md",
  "docs/reviews/HELM_SKILL_FORMAL_REVIEW_QUEUE_PLAN_V1.md",
  "docs/reviews/HELM_SKILL_FORMAL_REVIEW_QUEUE_REPORT_V1.md",
  "docs/product/HELM_SKILL_FORMAL_REVIEW_DECISION_WORKFLOW_BASELINE_V1.md",
  "docs/reviews/HELM_SKILL_FORMAL_REVIEW_DECISION_WORKFLOW_PLAN_V1.md",
  "docs/reviews/HELM_SKILL_FORMAL_REVIEW_DECISION_WORKFLOW_REPORT_V1.md",
  "docs/reviews/HELM_PAGE_LOCAL_DISCLOSURE_FOLLOW_THROUGH_REPORT_V1.md",
  "docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md",
  "docs/reviews/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_PLAN_V1.md",
  "docs/reviews/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_REPORT_V1.md",
  "docs/product/HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md",
  "docs/reviews/HELM_OPERATING_GAP_OBJECT_PLAN_V1.md",
  "docs/reviews/HELM_OPERATING_GAP_OBJECT_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_AGGREGATION_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_AGGREGATION_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_READOUT_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_READOUT_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_CUSTOMER_SUCCESS_QUEUE_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_CUSTOMER_SUCCESS_QUEUE_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_CUSTOMER_SUCCESS_QUEUE_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_READOUT_HELPER_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_READOUT_HELPER_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_READOUT_HELPER_REPORT_V1.md",
  "docs/product/HELM_BUSINESS_LOOP_GAP_READOUT_GUARD_BASELINE_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_READOUT_GUARD_PLAN_V1.md",
  "docs/reviews/HELM_BUSINESS_LOOP_GAP_READOUT_GUARD_REPORT_V1.md",
  "docs/product/HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md",
  "docs/reviews/HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_PLAN_V1.md",
  "docs/reviews/HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_REPORT_V1.md",
  "docs/product/HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_BASELINE_V1.md",
  "docs/reviews/HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_PLAN_V1.md",
  "docs/reviews/HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_REPORT_V1.md",
  "docs/product/HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md",
  "docs/reviews/HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_PLAN_V1.md",
  "docs/reviews/HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_REPORT_V1.md",
  "docs/product/HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md",
  "docs/reviews/HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_PLAN_V1.md",
  "docs/reviews/HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_REPORT_V1.md",
  "docs/product/HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_BASELINE_V1.md",
  "docs/reviews/HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_PLAN_V1.md",
  "docs/reviews/HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_REPORT_V1.md",
  "docs/product/HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_BASELINE_V1.md",
  "docs/reviews/HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_PLAN_V1.md",
  "docs/reviews/HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_REPORT_V1.md",
  "docs/product/HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_BASELINE_V1.md",
  "docs/reviews/HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_PLAN_V1.md",
  "docs/reviews/HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_REPORT_V1.md",
  "docs/product/HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_BASELINE_V1.md",
  "docs/reviews/HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_PLAN_V1.md",
  "docs/reviews/HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_REPORT_V1.md",
  "docs/product/HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md",
  "docs/reviews/HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_PLAN_V1.md",
  "docs/reviews/HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_REPORT_V1.md",
  "docs/product/HELM_REPORTING_PROTOCOL_REPORT.md",
  "docs/product/DECISION_FIRST_IA_REPORT.md",
  "docs/product/DECISION_FIRST_PAGE_REFACTOR_REPORT.md",
  "docs/product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md",
  "docs/product/HELM_WORKER_SKILL_RESOURCE_CONTRACT_REPORT.md",
  "docs/product/HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_1_REPORT.md",
  "docs/product/HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md",
  "docs/product/HELM_REPORTING_MODEL_DECISION_FIRST_IA_SPRINT_1_REPORT.md",
  "docs/product/HELM_NARRATIVE_COMPONENTS_REPORT.md",
  "docs/product/NARRATIVE_COMPONENTS_BASELINE_REVIEW_REPORT.md",
  "docs/product/NARRATIVE_COMPONENTS_BASELINE_FREEZE_REPORT.md",
  "docs/product/HELM_INFORMATION_HIERARCHY_REPORT.md",
  "docs/product/INFORMATION_HIERARCHY_BASELINE_FREEZE_REPORT.md",
  "docs/product/HELM_DECISION_FIRST_PAGES_REPORT.md",
  "docs/product/REPRESENTATIVE_PAGES_BASELINE_FREEZE_REPORT.md",
  "docs/product/NARRATIVE_COMPONENTS_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/HELM_NARRATIVE_COMPONENTS_ALIGNMENT_REPORT.md",
  "docs/reviews/NARRATIVE_COMPONENTS_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_BASELINE_FREEZE_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_BOUNDARY_EVIDENCE_STRUCTURE_REPORT.md",
  "docs/reviews/PROPOSAL_PACKAGE_PAGES_ALIGNMENT_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_PAGES_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_BOUNDARY_STRUCTURE_REPORT.md",
  "docs/reviews/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_ALIGNMENT_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_PAGES_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_STRUCTURE_REPORT.md",
  "docs/reviews/COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
  "docs/product/CUSTOMER_FACING_PACKAGE_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_PAGES_REPORT.md",
  "docs/reviews/PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_ALIGNMENT_REPORT.md",
  "docs/product/CUSTOMER_FACING_PACKAGE_VARIANTS_COMMITMENT_REINFORCEMENT_VARIANTS_SPRINT_1_REPORT.md",
  "docs/product/PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_BASELINE_REVIEW_REPORT.md",
  "docs/product/CUSTOMER_FACING_PACKAGE_VARIANTS_BASELINE_FREEZE_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_VARIANTS_BASELINE_FREEZE_REPORT.md",
  "docs/product/VARIANTS_DETAIL_PAGES_BASELINE_FREEZE_REPORT.md",
  "docs/product/VARIANTS_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/CUSTOMER_FACING_PACKAGE_VARIANTS_COMMITMENT_REINFORCEMENT_VARIANTS_BASELINE_FREEZE_REPORT.md",
  "docs/product/UNIFIED_DETAIL_NAVIGATION_MODEL_REPORT.md",
  "docs/product/CROSS_DETAIL_HANDOFF_MODEL_REPORT.md",
  "docs/product/DETAIL_NAVIGATION_HANDOFF_IMPLEMENTATION_REPORT.md",
  "docs/reviews/UNIFIED_DETAIL_NAVIGATION_ALIGNMENT_REPORT.md",
  "docs/product/UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_SPRINT_1_REPORT.md",
  "docs/product/UNIFIED_DETAIL_NAVIGATION_BASELINE_REVIEW_REPORT.md",
  "docs/product/UNIFIED_DETAIL_NAVIGATION_BASELINE_FREEZE_REPORT.md",
  "docs/product/CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
  "docs/product/DETAIL_NAVIGATION_HANDOFF_BASELINE_FREEZE_REPORT.md",
  "docs/product/UNIFIED_DETAIL_NAVIGATION_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/UNIFIED_DETAIL_NAVIGATION_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
  "docs/product/PACKAGE_STAGE_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/COMMERCIAL_NARRATIVE_STRENGTHENING_CONTRACT_REPORT.md",
  "docs/product/PACKAGE_STAGE_VARIANTS_STRENGTHENING_PAGES_REPORT.md",
  "docs/reviews/PACKAGE_STAGE_VARIANTS_STRENGTHENING_ALIGNMENT_REPORT.md",
  "docs/product/PACKAGE_STAGE_VARIANTS_COMMERCIAL_NARRATIVE_STRENGTHENING_SPRINT_1_REPORT.md",
  "docs/product/PACKAGE_STAGE_STRENGTHENING_BASELINE_REVIEW_REPORT.md",
  "docs/product/PACKAGE_STAGE_VARIANTS_BASELINE_FREEZE_REPORT.md",
  "docs/product/COMMERCIAL_NARRATIVE_STRENGTHENING_BASELINE_FREEZE_REPORT.md",
  "docs/product/STAGE_STRENGTHENING_DETAIL_PAGES_BASELINE_FREEZE_REPORT.md",
  "docs/product/STAGE_STRENGTHENING_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/PACKAGE_STAGE_STRENGTHENING_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/PACKAGE_STAGE_VARIANTS_COMMERCIAL_NARRATIVE_STRENGTHENING_BASELINE_FREEZE_REPORT.md",
  "docs/product/CONVERSATION_DETAIL_CONTRACT_REPORT.md",
  "docs/product/EXTERNAL_NARRATIVE_DETAIL_CONTRACT_REPORT.md",
  "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_REPORT.md",
  "docs/reviews/CONVERSATION_EXTERNAL_NARRATIVE_ALIGNMENT_REPORT.md",
  "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_SPRINT_1_REPORT.md",
  "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_REVIEW_REPORT.md",
  "docs/product/CONVERSATION_DETAIL_BASELINE_FREEZE_REPORT.md",
  "docs/product/EXTERNAL_NARRATIVE_DETAIL_BASELINE_FREEZE_REPORT.md",
  "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_CHAIN_BASELINE_FREEZE_REPORT.md",
  "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_BASELINE_FREEZE_REPORT.md",
  "docs/product/FOUNDER_CONVERSATION_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/SALES_CONVERSATION_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/DELIVERY_CONVERSATION_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/FOUNDER_SALES_DELIVERY_CONVERSATION_VARIANTS_PAGES_REPORT.md",
  "docs/reviews/FOUNDER_SALES_DELIVERY_CONVERSATION_VARIANTS_ALIGNMENT_REPORT.md",
  "docs/product/FOUNDER_SALES_DELIVERY_CONVERSATION_VARIANTS_SPRINT_1_REPORT.md",
  "docs/product/FOUNDER_QA_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/FOUNDER_QA_VARIANTS_PAGES_REPORT.md",
  "docs/reviews/FOUNDER_QA_VARIANTS_ALIGNMENT_REPORT.md",
  "docs/product/SALES_OBJECTION_FOLLOWUP_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/SALES_OBJECTION_FOLLOWUP_VARIANTS_PAGES_REPORT.md",
  "docs/reviews/SALES_OBJECTION_FOLLOWUP_VARIANTS_ALIGNMENT_REPORT.md",
  "docs/product/DELIVERY_WALKTHROUGH_REVIEW_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/DELIVERY_WALKTHROUGH_REVIEW_VARIANTS_PAGES_REPORT.md",
  "docs/reviews/DELIVERY_WALKTHROUGH_REVIEW_VARIANTS_ALIGNMENT_REPORT.md",
  "docs/product/EXTERNAL_NARRATIVE_FALLBACK_VARIANTS_CONTRACT_REPORT.md",
  "docs/product/EXTERNAL_NARRATIVE_FALLBACK_VARIANTS_PAGES_REPORT.md",
  "docs/reviews/EXTERNAL_NARRATIVE_FALLBACK_VARIANTS_ALIGNMENT_REPORT.md",
  "docs/product/CONVERSATION_DETAIL_CHAIN_EXTENSION_REPORT.md",
  "docs/reviews/CONVERSATION_DETAIL_CHAIN_EXTENSION_ALIGNMENT_REPORT.md",
  "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CONTRACT_REPORT.md",
  "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_PAGES_REPORT.md",
  "docs/reviews/INBOX_FOLLOWUP_REVIEW_REQUEST_ALIGNMENT_REPORT.md",
  "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CHAIN_SPRINT_1_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_CONTRACT_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_DETAIL_CONTRACT_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_MODEL_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_PAGE_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_CHAIN_INTEGRATION_REPORT.md",
  "docs/reviews/CUSTOMER_SUCCESS_HANDOFF_ALIGNMENT_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_SPRINT_1_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_BASELINE_REVIEW_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_BASELINE_FREEZE_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_DETAIL_BASELINE_FREEZE_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_CHAIN_BASELINE_FREEZE_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/CUSTOMER_SUCCESS_HANDOFF_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
  "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
  "docs/product/ROLE_BASED_CONVERSATION_EXPANSION_BATCH_1_5_REPORT.md",
  "docs/product/HELM_ACTIVE_REPORTING_MECHANISM_REPORT.md",
  "docs/product/HELM_PROACTIVE_COLLABORATION_MECHANISM_REPORT.md",
  "docs/product/HELM_PROACTIVE_FLOW_IMPLEMENTATION_REPORT.md",
  "docs/product/HELM_PROACTIVE_REPORTING_COLLABORATION_SPRINT_1_REPORT.md",
  "docs/product/HELM_PROACTIVE_BASELINE_REVIEW_REPORT.md",
  "docs/product/ACTIVE_REPORTING_BASELINE_FREEZE_REPORT.md",
  "docs/product/PROACTIVE_COLLABORATION_BASELINE_FREEZE_REPORT.md",
  "docs/product/PROACTIVE_FLOWS_BASELINE_FREEZE_REPORT.md",
  "docs/product/HELM_PROACTIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
  "docs/product/HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md",
  "docs/reviews/HELM_DECISION_FIRST_ALIGNMENT_REPORT.md",
  "docs/reviews/HELM_PROACTIVE_MECHANISM_ALIGNMENT_REPORT.md",
  "docs/reviews/HELM_PROACTIVE_BASELINE_ALIGNMENT_REPORT.md",
  "docs/product/phase-f-trial-operations-and-production-readiness.md",
  "docs/reviews/evals-checklist.md",
  "docs/reviews/trial-readiness-checklist.md",
  "evals/README.md",
  "evals/recommendation/golden-samples.json",
  "evals/memory/golden-samples.json",
];

const requiredSkillFiles = [
  ".agents/skills/baseline-freeze/SKILL.md",
  ".agents/skills/readiness-sprint/SKILL.md",
  ".agents/skills/decision-first-page-refactor/SKILL.md",
  ".agents/skills/worker-skill-resource-binding/SKILL.md",
];

const requiredApiRoutes = [
  "app/api/memory/meetings/[meetingId]/process/route.ts",
  "app/api/memory/imports/meeting-notes/process/route.ts",
  "app/api/blockers/[id]/status/route.ts",
  "app/api/recommendations/next-actions/route.ts",
  "app/api/recommendations/today-focus/route.ts",
  "app/api/recommendations/[id]/track/route.ts",
  "app/api/llm/meetings/[meetingId]/process-memory/route.ts",
  "app/api/llm/logs/route.ts",
  "app/api/evolution/strategy-suggestions/[id]/accept/route.ts",
  "app/api/evolution/skill-suggestions/[id]/queue-formal-review/route.ts",
  "app/api/evolution/skill-suggestions/[id]/return-hardening/route.ts",
  "app/api/conversation-capture/start/route.ts",
  "app/api/conversation-capture/[sessionId]/stop/route.ts",
  "app/api/connectors/google/start/route.ts",
  "app/api/connectors/hubspot/start/route.ts",
  "app/api/connectors/hubspot/callback/route.ts",
  "app/api/connectors/salesforce/start/route.ts",
  "app/api/connectors/salesforce/callback/route.ts",
  "app/api/imports/crm/preview/route.ts",
  "app/api/imports/crm/run/route.ts",
  "app/api/imports/crm/sync/route.ts",
  "app/api/imports/jobs/[jobId]/warmup/route.ts",
  "app/api/imports/conflicts/[id]/resolve/route.ts",
];

const requiredPages = [
  "app/(workspace)/diagnostics/page.tsx",
  "app/(workspace)/imports/crm/page.tsx",
  "app/(workspace)/capture/page.tsx",
];

function readText(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function parseEnvKeys(fileContent: string) {
  return new Set(
    fileContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0].trim()),
  );
}

function runCheck(name: string, fn: () => string): CheckResult {
  try {
    return { name, ok: true, detail: fn() };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

const results: CheckResult[] = [];

results.push(
  runCheck("git_root", () => {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (gitRoot !== root) {
      throw new Error(`expected ${root}, got ${gitRoot}`);
    }

    return gitRoot;
  }),
);

results.push(
  runCheck("git_branches", () => {
    const branches = execSync("git branch --list main 'codex/*'", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.replace(/^[*+]\s*/, "").trim())
      .filter(Boolean);

    if (!branches.includes("main")) {
      throw new Error("missing branches: main");
    }

    const codexBranches = branches.filter((branch) => branch.startsWith("codex/"));
    if (codexBranches.length === 0) {
      throw new Error("missing branches: codex/* audit branch");
    }

    return branches.join(", ");
  }),
);

results.push(
  runCheck("required_docs", () => {
    const missing = requiredDocs.filter(
      (relativePath) => !existsSync(path.join(root, relativePath)),
    );
    if (missing.length > 0) {
      throw new Error(`missing docs: ${missing.join(", ")}`);
    }
    return `${requiredDocs.length} docs found`;
  }),
);

results.push(
  runCheck("codex_skill_files", () => {
    const missing = requiredSkillFiles.filter(
      (relativePath) => !existsSync(path.join(root, relativePath)),
    );
    if (missing.length > 0) {
      throw new Error(`missing skill files: ${missing.join(", ")}`);
    }
    return `${requiredSkillFiles.length} codex skill files found`;
  }),
);

results.push(
  runCheck("required_api_routes", () => {
    const missing = requiredApiRoutes.filter(
      (relativePath) => !existsSync(path.join(root, relativePath)),
    );
    if (missing.length > 0) {
      throw new Error(`missing routes: ${missing.join(", ")}`);
    }
    return `${requiredApiRoutes.length} routes found`;
  }),
);

results.push(
  runCheck("required_pages", () => {
    const missing = requiredPages.filter(
      (relativePath) => !existsSync(path.join(root, relativePath)),
    );
    if (missing.length > 0) {
      throw new Error(`missing pages: ${missing.join(", ")}`);
    }
    return `${requiredPages.length} pages found`;
  }),
);

results.push(
  runCheck("env_example_keys", () => {
    const envContent = readText(".env.example");
    const envKeys = parseEnvKeys(envContent);
    const missing = requiredEnvVars.filter((key) => !envKeys.has(key));
    if (missing.length > 0) {
      throw new Error(`missing env vars: ${missing.join(", ")}`);
    }

    if (
      !envContent.includes(
        'DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4"',
      )
    ) {
      throw new Error("DATABASE_URL default is not aligned to the MySQL baseline");
    }

    return `${requiredEnvVars.length} env vars present`;
  }),
);

results.push(
  runCheck("readme_env_usage", () => {
    const readme = readText("README.md");
    const requiredSnippets = [
      "AGENTS.md",
      "docs/codex/README.md",
      "batch_task_master_template.md",
      "execution_receipt_template.md",
      "definition_of_done.md",
      "release_checklist.md",
      "cp .env.example .env",
      "npm run pilot:check",
      "npm run pilot:eval",
      "DATABASE_URL=mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4",
      "docs/pilot/delivery-boundary.md",
      "npm run eval:recommendation",
      "npm run eval:memory",
      "ASR_ENABLED",
      "ASR_OPENAI_MODEL",
      "ASR_LANGUAGE",
      "DINGTALK_CLIENT_ID",
      "DINGTALK_CLIENT_SECRET",
      "DINGTALK_REDIRECT_URI",
      "HUBSPOT_CLIENT_ID",
      "HUBSPOT_CLIENT_SECRET",
      "SALESFORCE_CLIENT_ID",
      "SALESFORCE_CLIENT_SECRET",
      "/imports/crm",
      "/diagnostics",
      "en-US",
      "multilingualUi",
      "captureConsentRequired",
      "HELM_REPORTING_PROTOCOL_REPORT.md",
      "DECISION_FIRST_IA_REPORT.md",
      "HELM_REPORTING_MODEL_DECISION_FIRST_IA_SPRINT_1_REPORT.md",
      "HELM_ACTIVE_REPORTING_MECHANISM_REPORT.md",
      "HELM_PROACTIVE_COLLABORATION_MECHANISM_REPORT.md",
      "HELM_PROACTIVE_REPORTING_COLLABORATION_SPRINT_1_REPORT.md",
      "HELM_PROACTIVE_BASELINE_REVIEW_REPORT.md",
      "ACTIVE_REPORTING_BASELINE_FREEZE_REPORT.md",
      "PROACTIVE_COLLABORATION_BASELINE_FREEZE_REPORT.md",
      "PROACTIVE_FLOWS_BASELINE_FREEZE_REPORT.md",
      "HELM_PROACTIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_1_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md",
      "PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_REPORT.md",
      "PROPOSAL_PACKAGE_BOUNDARY_EVIDENCE_STRUCTURE_REPORT.md",
      "PROPOSAL_PACKAGE_PAGES_ALIGNMENT_REPORT.md",
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_PAGES_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_BOUNDARY_STRUCTURE_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_ALIGNMENT_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_PAGES_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_STRUCTURE_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "CUSTOMER_FACING_PACKAGE_VARIANTS_CONTRACT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_VARIANTS_CONTRACT_REPORT.md",
      "PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_PAGES_REPORT.md",
      "PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_ALIGNMENT_REPORT.md",
      "CUSTOMER_FACING_PACKAGE_VARIANTS_COMMITMENT_REINFORCEMENT_VARIANTS_SPRINT_1_REPORT.md",
      "HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md",
      "HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_PLAN_V1.md",
      "HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_REPORT_V1.md",
      "HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_BASELINE_V1.md",
      "HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_PLAN_V1.md",
      "HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_REPORT_V1.md",
      "HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md",
      "HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_PLAN_V1.md",
      "HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_REPORT_V1.md",
      "HELM_DINGTALK_READONLY_INGESTION_SEAM_BASELINE_V1.md",
      "HELM_DINGTALK_READONLY_INGESTION_SEAM_PLAN_V1.md",
      "HELM_DINGTALK_READONLY_INGESTION_SEAM_REPORT_V1.md",
      "HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md",
      "HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_PLAN_V1.md",
      "HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_REPORT_V1.md",
      "HELM_WECOM_READONLY_INGESTION_SEAM_BASELINE_V1.md",
      "HELM_WECOM_READONLY_INGESTION_SEAM_PLAN_V1.md",
      "HELM_WECOM_READONLY_INGESTION_SEAM_REPORT_V1.md",
      "HELM_WECOM_CALENDAR_REGISTRY_SEAM_BASELINE_V1.md",
      "HELM_WECOM_CALENDAR_REGISTRY_SEAM_PLAN_V1.md",
      "HELM_WECOM_CALENDAR_REGISTRY_SEAM_REPORT_V1.md",
      "HELM_FEISHU_OAUTH_CALLBACK_FOUNDATION_BASELINE_V1.md",
      "HELM_FEISHU_OAUTH_CALLBACK_FOUNDATION_PLAN_V1.md",
      "HELM_FEISHU_OAUTH_CALLBACK_FOUNDATION_REPORT_V1.md",
      "HELM_FEISHU_BITABLE_READONLY_INGEST_BASELINE_V1.md",
      "HELM_FEISHU_BITABLE_READONLY_INGEST_PLAN_V1.md",
      "HELM_FEISHU_BITABLE_READONLY_INGEST_REPORT_V1.md",
      "DingTalk runtime OAuth callback foundation",
      "DingTalk meetings runtime ingest seam",
      "DingTalk read-only ingestion seam",
      "WeCom runtime OAuth callback foundation",
      "WeCom read-only ingestion seam",
      "WeCom calendar registry seam",
      "Feishu OAuth callback foundation",
      "Feishu Bitable read-only ingest",
      "tenant-scoped callback audit truth",
      "providerType = DINGTALK_OAUTH",
      "providerType = WECOM_OAUTH",
      "providerType = FEISHU_OAUTH",
      "current repo truth still does not claim native DingTalk SCIM",
      "current repo truth still does not claim native WeCom SCIM",
      "env-backed Bitable read-only ingest",
      "read-only ingestion runtime",
      "ListEvents",
      "QueryOrgConferenceList",
      "QueryConferenceInfoByRoomCode",
      "GET /v1.0/conference/orgConferences",
      "GET /v1.0/conference/roomCodes/{roomCode}/infos",
      "read-side contract",
      "persisted payload / preview / handle truth",
      "RuntimeSession / SessionNotebook / ConnectorIngestionRecord",
      "corp token",
      "oauth identity",
      "workspace-scoped identity binding",
      "WECOM_OAUTH_CALLBACK_SUCCEEDED",
      "get_user_meetingid",
      "get_info",
      "calendar verified-but-unbound",
      "workspace-scoped `cal_id` registry",
      "registry readiness",
      "bound calendar count",
      "last validation result",
      "next required action",
      "message notifications unresolved",
      "HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md",
      "HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_PLAN_V1.md",
      "HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_REPORT_V1.md",
      "HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md",
      "HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_PLAN_V1.md",
      "HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_REPORT_V1.md",
      "HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_BASELINE_V1.md",
      "HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_PLAN_V1.md",
      "HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_REPORT_V1.md",
      "HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_BASELINE_V1.md",
      "HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_PLAN_V1.md",
      "HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_REPORT_V1.md",
      "HELM_PAGE_LOCAL_DISCLOSURE_FOLLOW_THROUGH_REPORT_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_REDUCTION_PLAN_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_REDUCTION_REPORT_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_BASELINE_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_PLAN_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_REPORT_V1.md",
      "HELM_BUSINESS_FIRST_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md",
      "HELM_BUSINESS_FIRST_OPERATOR_SURFACE_EXPANSION_PLAN_V1.md",
      "HELM_BUSINESS_FIRST_OPERATOR_SURFACE_EXPANSION_REPORT_V1.md",
      "imports、import conflicts、import result",
      "setup wizard、login、CRM import",
      "business-first",
      "customer success queue",
      "对象状态 / 阻塞 / 待决策 / 下一步动作",
      "opportunities、reports、diagnostics",
      "internal operating`、`opportunities`、`approvals`、`imports`",
      "BusinessFirstSurfaceSummary",
      "operator-heavy surface",
      "Helm directory-sync adapter seam",
    ];
    const missing = requiredSnippets.filter(
      (snippet) => !readme.includes(snippet),
    );
    if (missing.length > 0) {
      throw new Error(`missing README snippets: ${missing.join(", ")}`);
    }
    return "README mentions env template and pilot docs";
  }),
);

results.push(
  runCheck("docs_index_pilot", () => {
    const docsReadme = readText("docs/README.md");
    const requiredSnippets = [
      "### conversation-capture/",
      "### pilot/",
      "### sales/",
      "### evals/",
      "pilot/delivery-boundary.md",
      "pilot/pre-pilot-checklist.md",
      "pilot/manual-acceptance-paths.md",
      "pilot/minimal-evals.md",
      "Shared agent pilot 入口",
      "SHARED_AGENT_PILOT_READINESS_V1.md",
      "SHARED_AGENT_PILOT_RUNBOOK_V1.md",
      "SHARED_AGENT_PILOT_OBSERVATION_TEMPLATE_V1.md",
      "HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md",
      "HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_PLAN_V1.md",
      "HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_REPORT_V1.md",
      "HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md",
      "HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_PLAN_V1.md",
      "HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_REPORT_V1.md",
      "HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md",
      "HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_PLAN_V1.md",
      "HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_REPORT_V1.md",
      "HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_BASELINE_V1.md",
      "HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_PLAN_V1.md",
      "HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_REPORT_V1.md",
      "HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_BASELINE_V1.md",
      "HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_PLAN_V1.md",
      "HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_REPORT_V1.md",
      "HELM_PAGE_LOCAL_DISCLOSURE_FOLLOW_THROUGH_REPORT_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_REDUCTION_PLAN_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_REDUCTION_REPORT_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_BASELINE_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_PLAN_V1.md",
      "HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_REPORT_V1.md",
      "HELM_BUSINESS_FIRST_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md",
      "HELM_BUSINESS_FIRST_OPERATOR_SURFACE_EXPANSION_PLAN_V1.md",
      "HELM_BUSINESS_FIRST_OPERATOR_SURFACE_EXPANSION_REPORT_V1.md",
      "imports、import conflicts、import result",
      "setup wizard、login、CRM import",
      "shared guidance substrate",
      "business-first",
      "customer success queue",
      "对象状态 / 阻塞 / 待决策 / 下一步动作",
      "HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_BASELINE_V1.md",
      "HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_PLAN_V1.md",
      "HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_REPORT_V1.md",
      "internal operating`、`opportunities`、`approvals`、`imports`",
      "BusinessFirstSurfaceSummary",
      "operator-heavy surface",
      "feature-owned product surface",
      "participant portal",
      "role handoff",
      "trial onboarding",
      "shared form-assist",
      "Helm directory-sync adapter seam",
      "Native DingTalk SCIM is not claimed",
      "shared-agent-outcome-snapshot.ts",
      "phase-f-trial-operations-and-production-readiness.md",
      "HELM_ACTIVE_REPORTING_MECHANISM_REPORT.md",
      "HELM_PROACTIVE_COLLABORATION_MECHANISM_REPORT.md",
      "HELM_PROACTIVE_REPORTING_COLLABORATION_SPRINT_1_REPORT.md",
      "HELM_PROACTIVE_BASELINE_REVIEW_REPORT.md",
      "ACTIVE_REPORTING_BASELINE_FREEZE_REPORT.md",
      "PROACTIVE_COLLABORATION_BASELINE_FREEZE_REPORT.md",
      "PROACTIVE_FLOWS_BASELINE_FREEZE_REPORT.md",
      "HELM_PROACTIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "HELM_PROACTIVE_BASELINE_ALIGNMENT_REPORT.md",
      "HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_1_REPORT.md",
      "HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md",
      "a-level-project-diligence-and-aliyun-cooperation-template.md",
      "sales/migration-tool-crm-first-design.md",
      "sales/migration-tool-crm-first-execution.md",
      "evals/README.md",
      "evals/recommendation/golden-samples.json",
      "evals/memory/golden-samples.json",
      "reviews/evals-checklist.md",
      "reviews/trial-readiness-checklist.md",
      "HELM_REPORTING_PROTOCOL_REPORT.md",
      "DECISION_FIRST_IA_REPORT.md",
      "HELM_DECISION_FIRST_ALIGNMENT_REPORT.md",
      "PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_REPORT.md",
      "PROPOSAL_PACKAGE_BOUNDARY_EVIDENCE_STRUCTURE_REPORT.md",
      "PROPOSAL_PACKAGE_PAGES_ALIGNMENT_REPORT.md",
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_PAGES_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_BOUNDARY_STRUCTURE_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_ALIGNMENT_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_PAGES_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_STRUCTURE_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "CUSTOMER_FACING_PACKAGE_VARIANTS_CONTRACT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_VARIANTS_CONTRACT_REPORT.md",
      "PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_PAGES_REPORT.md",
      "PACKAGE_VARIANTS_REINFORCEMENT_VARIANTS_ALIGNMENT_REPORT.md",
      "CUSTOMER_FACING_PACKAGE_VARIANTS_COMMITMENT_REINFORCEMENT_VARIANTS_SPRINT_1_REPORT.md",
      "HELM_SKILL_SUGGESTION_BASELINE_V1.md",
      "HELM_SKILL_SUGGESTION_PLAN_V1.md",
      "HELM_SKILL_SUGGESTION_REPORT_V1.md",
      "HELM_SKILL_FORMAL_REVIEW_QUEUE_BASELINE_V1.md",
      "HELM_SKILL_FORMAL_REVIEW_QUEUE_PLAN_V1.md",
      "HELM_SKILL_FORMAL_REVIEW_QUEUE_REPORT_V1.md",
      "HELM_SKILL_FORMAL_REVIEW_DECISION_WORKFLOW_BASELINE_V1.md",
      "HELM_SKILL_FORMAL_REVIEW_DECISION_WORKFLOW_PLAN_V1.md",
      "HELM_SKILL_FORMAL_REVIEW_DECISION_WORKFLOW_REPORT_V1.md",
    ];
    const missing = requiredSnippets.filter(
      (snippet) => !docsReadme.includes(snippet),
    );
    if (missing.length > 0) {
      throw new Error(`missing docs index snippets: ${missing.join(", ")}`);
    }
    return "docs index includes pilot section";
  }),
);

const failed = results.filter((result) => !result.ok);

for (const result of results) {
  const icon = result.ok ? "PASS" : "FAIL";
  console.log(`${icon}  ${result.name}  ${result.detail}`);
}

console.log("");
console.log(
  JSON.stringify(
    {
      success: failed.length === 0,
      passed: results.length - failed.length,
      failed: failed.length,
    },
    null,
    2,
  ),
);

if (failed.length > 0) {
  process.exit(1);
}
