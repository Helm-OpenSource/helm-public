export const operatingSystemLayerFiles = [
  "lib/operating-system/types.ts",
  "lib/operating-system/skill-catalog.ts",
  "lib/operating-system/object-state.ts",
  "lib/operating-system/event-signals.ts",
  "lib/operating-system/recommendation-context.ts",
  "lib/operating-system/approval-boundary.ts",
  "lib/operating-system/audit-reason-chain.ts",
  "lib/operating-system/readiness.ts",
  "lib/operating-system/dashboard-arbitration.ts",
  "lib/operating-system/cognitive-object-contract.ts",
  "lib/operating-system/operating-gap.ts",
  "lib/operating-system/truth-reconciliation.ts",
  "lib/operating-system/index.ts",
  "lib/operating-system/index.test.ts",
  "lib/operating-system/cognitive-object-contract.test.ts",
  "lib/operating-system/operating-gap.test.ts",
  "lib/operating-system/truth-reconciliation.test.ts",
] as const;

export const mainChainRoutes = [
  "app/(workspace)/dashboard/page.tsx",
  "app/(workspace)/opportunities/page.tsx",
  "app/(workspace)/meetings/page.tsx",
  "app/(workspace)/meetings/[id]/page.tsx",
  "app/(workspace)/approvals/page.tsx",
  "app/(workspace)/memory/page.tsx",
] as const;

export const supportingRoutes = [
  "app/(workspace)/imports/page.tsx",
  "app/(workspace)/imports/crm/page.tsx",
  "app/(workspace)/search/page.tsx",
  "app/(workspace)/settings/page.tsx",
  "app/(workspace)/inbox/page.tsx",
  "app/(workspace)/inbox/[id]/page.tsx",
] as const;

export const objectDetailRoutes = [
  "app/(workspace)/contacts/[id]/page.tsx",
  "app/(workspace)/companies/[id]/page.tsx",
] as const;

export const shellEntryFiles = [
  "app/layout.tsx",
  "app/loading.tsx",
  "app/error.tsx",
  "app/(workspace)/layout.tsx",
  "app/(workspace)/loading.tsx",
  "app/(workspace)/not-found.tsx",
] as const;

export const entryAndWorkspaceSupportRoutes = [
  "app/page.tsx",
  "app/setup/page.tsx",
  "app/(auth)/login/page.tsx",
  "app/(workspace)/page.tsx",
  "app/(workspace)/analytics/page.tsx",
  "app/(workspace)/capture/page.tsx",
  "app/(workspace)/reports/page.tsx",
] as const;

export const proposalPackageSprint1Reports = [
  "docs/product/PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_BOUNDARY_EVIDENCE_STRUCTURE_REPORT.md",
  "docs/reviews/PROPOSAL_PACKAGE_PAGES_ALIGNMENT_REPORT.md",
  "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
] as const;

export const externalProposalSprint1Reports = [
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_PAGES_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_BOUNDARY_STRUCTURE_REPORT.md",
  "docs/reviews/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_ALIGNMENT_REPORT.md",
  "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
] as const;

export const commitmentSprint1Reports = [
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_PAGES_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_STRUCTURE_REPORT.md",
  "docs/reviews/COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
  "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
] as const;

export const migratedDetailPageMarkers = [
  "proposalPackageEvidenceGroupIds",
  "customerFacingOfferExternalProposalEvidenceGroupIds",
  "commitmentReinforcementSendabilityEvidenceGroupIds",
  "recommendation 仍不等于承诺",
  "方案包措辞仍只是商业整形产物",
  "recommendation、仅讨论",
  "recommendation、仅讨论 和仅边界加固仍然不等于承诺。",
  "sendability_trace",
  "reinforcement_trace",
  "sendability gate",
] as const;

export const sharedPanelMarkers = [
  "pageWorkerAssignments",
  "pageEvidenceGroups",
  "data-evidence-chip",
  "BoundaryNote",
  "memory-work-timeline",
  "reportingDensityLimits.whyItMattersMin",
  "reportingDensityLimits.whyItMattersMax",
  "reportingDensityLimits.nextActionPrimaryCount",
  "reportingDensityLimits.nextActionSecondaryMax",
  "dashboard",
  "buildSectionHref",
  "opportunities",
  "scrollToWindowHashTarget",
  "approvals",
  "MEMORY_PAGE_ANCHORS",
] as const;

export const conversationNarrativeMarkers = [
  "ConversationDetailView",
  "buildConversationDetailPageContract",
  "buildProposalPackageCommercialDetail",
  "ExternalNarrativeDetailView",
  "buildExternalNarrativeDetailPageContract",
  "对话 guidance 可以改变重点、节奏和场景适配，但它仍然不能悄悄把仅讨论措辞变成承诺。",
  "对外叙事可以提高清晰度和信心，但它仍然不能悄悄把建议硬化成承诺。",
  "第一轮局部落地",
  "不是完整 messaging platform",
  "不是完整 sales enablement / battlecard / CRM 平台",
  "不是完整 commercial conversation engine",
  "package / offer -> conversation",
  "external proposal / reinforcement -> external narrative",
  "conversation <-> external narrative",
  "recommendation、review、boundary、decision request",
] as const;

export const requiredCodexDocs = [
  "docs/codex/README.md",
  "docs/codex/definition_of_done.md",
  "docs/codex/batch_task_master_template.md",
  "docs/codex/release_checklist.md",
  "docs/codex/report_template_sprint.md",
  "docs/codex/report_template_freeze.md",
] as const;

export const requiredSkillFiles = [
  ".agents/skills/helm-repo-default-workflow/SKILL.md",
  ".agents/skills/baseline-freeze/SKILL.md",
  ".agents/skills/readiness-sprint/SKILL.md",
  ".agents/skills/decision-first-page-refactor/SKILL.md",
  ".agents/skills/worker-skill-resource-binding/SKILL.md",
] as const;
