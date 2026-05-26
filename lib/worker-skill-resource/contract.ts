import { z } from "zod";

export const workerSkillResourceContractPrinciples = [
  "worker_defines_role",
  "skill_defines_ability",
  "resource_defines_execution_supply",
  "control_plane_defines_governance",
] as const;

export const controlPlaneGovernedChecks = [
  "review",
  "approval",
  "replay",
  "audit",
  "memory",
  "boundary",
  "external_safe_wording",
] as const;

export const workerRoles = [
  "founder_assistant",
  "sales_assistant",
  "delivery_assistant",
  "customer_success_assistant",
] as const;

export const workerReviewModes = [
  "internal_only",
  "review_before_send",
  "approval_required",
] as const;

export const workerEscalationModes = [
  "route_to_owner",
  "route_to_review_queue",
  "route_to_founder",
] as const;

export const workerOutputModes = [
  "internal_summary",
  "internal_recommendation",
  "internal_draft",
  "customer_safe_draft",
  "review_package",
] as const;

export const scenarioTypes = [
  "sales_followup",
  "sales_objection_response",
  "delivery_activation_checklist",
  "proposal_shaping_window",
  "review_request_preparation",
  "success_expansion_review",
  "boundary_clarification",
  "risk_clarification",
] as const;

export const skillTypes = [
  "followup_draft",
  "objection_handling",
  "activation_checklist",
  "proposal_shaping",
  "review_note",
  "expansion_review",
  "boundary_clarification",
  "risk_clarification",
] as const;

export const riskLevels = ["low", "medium", "high"] as const;

export const effectModes = [
  "read_only",
  "draft_only",
  "internal_write",
  "customer_visible_send",
] as const;

export const resourceTypes = [
  "crm_connector",
  "email_draft",
  "docs_query",
  "browser_research",
  "workspace_state",
  "membership_state",
  "callback_status",
  "usage_signal",
  "success_review",
  "proposal_context",
  "review_queue",
  "risk_signal",
] as const;

export const authModes = [
  "workspace_member_context",
  "connector_delegation",
  "service_account",
] as const;

export const invocationModes = [
  "sync_read",
  "async_prepare",
  "bounded_execution",
] as const;

export const workspaceScopes = ["current_workspace"] as const;

export const fieldContractSchema = z.object({
  requiredFields: z.array(z.string().min(1)).min(1),
  optionalFields: z.array(z.string().min(1)).default([]),
});

export const workerContractSchema = z.object({
  workerId: z.string().min(1),
  workerName: z.string().min(1),
  workerRole: z.enum(workerRoles),
  responsibilityScope: z.array(z.string().min(1)).min(1),
  responsibilityBoundary: z.array(z.string().min(1)).min(1),
  defaultSkills: z.array(z.string().min(1)).min(1),
  optionalSkills: z.array(z.string().min(1)).default([]),
  reviewMode: z.enum(workerReviewModes),
  escalationMode: z.enum(workerEscalationModes),
  outputMode: z.enum(workerOutputModes),
  authorityBoundary: z.array(z.string().min(1)).min(1),
});

export const skillContractSchema = z.object({
  skillId: z.string().min(1),
  skillName: z.string().min(1),
  skillType: z.enum(skillTypes),
  inputSchema: fieldContractSchema,
  outputSchema: fieldContractSchema,
  scenarioTypes: z.array(z.enum(scenarioTypes)).min(1),
  applicableRoles: z.array(z.enum(workerRoles)).min(1),
  blockedRoles: z.array(z.enum(workerRoles)).default([]),
  riskLevel: z.enum(riskLevels),
  requiresReview: z.boolean(),
  requiresApproval: z.boolean(),
  allowsAutoExecution: z.boolean(),
  customerFacingAllowed: z.boolean(),
  nonCommitmentOnly: z.boolean(),
  effectMode: z.enum(effectModes),
  resourceBindings: z.array(z.string().min(1)).min(1),
  fallbackBindings: z.array(z.string().min(1)).default([]),
});

export const resourceBindingContractSchema = z.object({
  bindingId: z.string().min(1),
  skillId: z.string().min(1),
  resourceId: z.string().min(1),
  resourceType: z.enum(resourceTypes),
  resourceCapability: z.string().min(1),
  invocationMode: z.enum(invocationModes),
  authMode: z.enum(authModes),
  workspaceScope: z.enum(workspaceScopes),
  riskLevel: z.enum(riskLevels),
  effectMode: z.enum(effectModes),
  auditHint: z.string().min(1),
});

export const resourceContractSchema = z.object({
  resourceId: z.string().min(1),
  resourceName: z.string().min(1),
  resourceType: z.enum(resourceTypes),
  resourceSummary: z.string().min(1),
  provider: z.string().min(1),
  capabilityTags: z.array(z.string().min(1)).min(1),
  authRequirement: z.string().min(1),
  workspaceSupport: z.enum(workspaceScopes),
  tenantBoundaryHint: z.string().min(1),
  inputContract: z.string().min(1),
  outputContract: z.string().min(1),
  auditSupport: z.boolean(),
  replaySupport: z.boolean(),
});

export const representativeWorkerSkillFlowSchema = z.object({
  flowId: z.string().min(1),
  scenarioType: z.enum(scenarioTypes),
  workerId: z.string().min(1),
  skillId: z.string().min(1),
  resourceBindingIds: z.array(z.string().min(1)).min(1),
  controlPlaneChecks: z.array(z.enum(controlPlaneGovernedChecks)).min(1),
  outputMode: z.enum(workerOutputModes),
});

export const workerSkillResourceContractBundleSchema = z.object({
  workers: z.array(workerContractSchema).min(1),
  skills: z.array(skillContractSchema).min(1),
  resourceBindings: z.array(resourceBindingContractSchema).min(1),
  resources: z.array(resourceContractSchema).min(1),
  representativeFlows: z.array(representativeWorkerSkillFlowSchema).min(1),
});

export type WorkerContract = z.infer<typeof workerContractSchema>;
export type SkillContract = z.infer<typeof skillContractSchema>;
export type ResourceBindingContract = z.infer<typeof resourceBindingContractSchema>;
export type ResourceContract = z.infer<typeof resourceContractSchema>;
export type RepresentativeWorkerSkillFlow = z.infer<
  typeof representativeWorkerSkillFlowSchema
>;
export type WorkerSkillResourceContractBundle = z.infer<
  typeof workerSkillResourceContractBundleSchema
>;

const effectModeRank: Record<(typeof effectModes)[number], number> = {
  read_only: 0,
  draft_only: 1,
  internal_write: 2,
  customer_visible_send: 3,
};

function indexById<T extends Record<string, unknown>, K extends keyof T>(
  items: T[],
  idKey: K,
) {
  return new Map<string, T>(items.map((item) => [String(item[idKey]), item]));
}

export function validateWorkerSkillResourceContractBundle(
  bundle: WorkerSkillResourceContractBundle,
) {
  const parsed = workerSkillResourceContractBundleSchema.parse(bundle);
  const workers = indexById(parsed.workers, "workerId");
  const skills = indexById(parsed.skills, "skillId");
  const bindings = indexById(parsed.resourceBindings, "bindingId");
  const resources = indexById(parsed.resources, "resourceId");

  for (const worker of parsed.workers) {
    for (const skillId of [...worker.defaultSkills, ...worker.optionalSkills]) {
      if (!skills.has(skillId)) {
        throw new Error(`worker ${worker.workerId} references unknown skill ${skillId}`);
      }

      const skill = skills.get(skillId);
      if (!skill) continue;

      if (!skill.applicableRoles.includes(worker.workerRole)) {
        throw new Error(
          `worker ${worker.workerId} cannot use skill ${skillId} outside applicableRoles`,
        );
      }

      if (skill.blockedRoles.includes(worker.workerRole)) {
        throw new Error(
          `worker ${worker.workerId} cannot use blocked skill ${skillId}`,
        );
      }
    }
  }

  for (const skill of parsed.skills) {
    if (skill.effectMode === "customer_visible_send") {
      throw new Error(
        "Sprint 1 does not permit autonomous customer-visible send skills",
      );
    }

    if (skill.customerFacingAllowed && !skill.requiresReview) {
      throw new Error("customer-facing skills must require review");
    }

    if (skill.customerFacingAllowed && !skill.nonCommitmentOnly) {
      throw new Error("customer-facing skills must stay non-commitment-only");
    }

    if (skill.requiresApproval && !skill.requiresReview) {
      throw new Error("approval-required skills must also require review");
    }

    if (
      ["review_note", "boundary_clarification", "risk_clarification"].includes(
        skill.skillType,
      ) &&
      skill.customerFacingAllowed
    ) {
      throw new Error(
        `${skill.skillType} must stay internal-only in the current contract`,
      );
    }

    for (const blockedRole of skill.blockedRoles) {
      if (skill.applicableRoles.includes(blockedRole)) {
        throw new Error(
          `skill ${skill.skillId} cannot both apply to and block role ${blockedRole}`,
        );
      }
    }

    for (const bindingId of skill.resourceBindings) {
      const binding = bindings.get(bindingId);
      if (!binding) {
        throw new Error(`skill ${skill.skillId} references unknown binding ${bindingId}`);
      }

      if (binding.skillId !== skill.skillId) {
        throw new Error(
          `binding ${binding.bindingId} must point back to skill ${skill.skillId}`,
        );
      }

      if (effectModeRank[binding.effectMode] > effectModeRank[skill.effectMode]) {
        throw new Error(
          `binding ${binding.bindingId} cannot exceed skill ${skill.skillId} effectMode`,
        );
      }
    }

    for (const bindingId of skill.fallbackBindings) {
      const binding = bindings.get(bindingId);
      if (!binding) {
        throw new Error(
          `skill ${skill.skillId} references unknown fallback binding ${bindingId}`,
        );
      }

      if (binding.skillId !== skill.skillId) {
        throw new Error(
          `fallback binding ${binding.bindingId} must point back to skill ${skill.skillId}`,
        );
      }

      if (!skill.resourceBindings.includes(bindingId)) {
        throw new Error(
          `fallback binding ${binding.bindingId} must remain inside skill ${skill.skillId} resourceBindings`,
        );
      }
    }
  }

  for (const binding of parsed.resourceBindings) {
    const resource = resources.get(binding.resourceId);
    if (!resource) {
      throw new Error(
        `binding ${binding.bindingId} references unknown resource ${binding.resourceId}`,
      );
    }

    if (resource.resourceType !== binding.resourceType) {
      throw new Error(
        `binding ${binding.bindingId} must match resource ${binding.resourceId} type`,
      );
    }

    if (binding.workspaceScope !== "current_workspace") {
      throw new Error(
        `binding ${binding.bindingId} must stay in current_workspace scope`,
      );
    }
  }

  for (const flow of parsed.representativeFlows) {
    const worker = workers.get(flow.workerId);
    const skill = skills.get(flow.skillId);

    if (!worker) {
      throw new Error(`flow ${flow.flowId} references unknown worker ${flow.workerId}`);
    }

    if (!skill) {
      throw new Error(`flow ${flow.flowId} references unknown skill ${flow.skillId}`);
    }

    if (!worker.defaultSkills.includes(skill.skillId)) {
      if (!worker.optionalSkills.includes(skill.skillId)) {
        throw new Error(
          `flow ${flow.flowId} uses skill ${skill.skillId} outside worker ${worker.workerId} skill lists`,
        );
      }
    }

    if (skill.requiresReview && !flow.controlPlaneChecks.includes("review")) {
      throw new Error(
        `flow ${flow.flowId} must include review for skill ${skill.skillId}`,
      );
    }

    if (!skill.scenarioTypes.includes(flow.scenarioType)) {
      throw new Error(
        `flow ${flow.flowId} scenario ${flow.scenarioType} is not allowed by skill ${skill.skillId}`,
      );
    }

    for (const bindingId of flow.resourceBindingIds) {
      const binding = bindings.get(bindingId);
      if (!binding) {
        throw new Error(`flow ${flow.flowId} references unknown binding ${bindingId}`);
      }
      if (binding.skillId !== skill.skillId) {
        throw new Error(
          `flow ${flow.flowId} can only use bindings attached to skill ${skill.skillId}`,
        );
      }
    }

    if (skill.requiresApproval && !flow.controlPlaneChecks.includes("approval")) {
      throw new Error(
        `flow ${flow.flowId} must include approval for skill ${skill.skillId}`,
      );
    }

    if (flow.outputMode === "customer_safe_draft" && !skill.customerFacingAllowed) {
      throw new Error(
        `flow ${flow.flowId} cannot emit customer_safe_draft from internal-only skill ${skill.skillId}`,
      );
    }
  }

  return parsed;
}

export function createWorkerSkillResourceContractBundle(
  bundle: WorkerSkillResourceContractBundle,
) {
  return validateWorkerSkillResourceContractBundle(bundle);
}

export const workerSkillResourceSprint1Blueprint =
  createWorkerSkillResourceContractBundle({
    workers: [
      {
        workerId: "founder-assistant-worker",
        workerName: "Founder Assistant Worker",
        workerRole: "founder_assistant",
        responsibilityScope: [
          "Compress cross-workspace judgement into a founder-readable frame.",
        ],
        responsibilityBoundary: [
          "Must stop at review, approval and non-commitment boundary before customer-visible action.",
        ],
        defaultSkills: ["boundary-clarification-skill"],
        optionalSkills: [],
        reviewMode: "approval_required",
        escalationMode: "route_to_founder",
        outputMode: "review_package",
        authorityBoundary: [
          "Cannot turn recommendation into founder commitment without explicit approval.",
        ],
      },
      {
        workerId: "sales-assistant-worker",
        workerName: "Sales Assistant Worker",
        workerRole: "sales_assistant",
        responsibilityScope: [
          "Prepare follow-up drafts and sales-safe framing for opportunity movement.",
        ],
        responsibilityBoundary: [
          "May prepare customer-safe drafts, but cannot send or strengthen commitment by itself.",
        ],
        defaultSkills: ["followup-draft-skill", "boundary-clarification-skill"],
        optionalSkills: [],
        reviewMode: "review_before_send",
        escalationMode: "route_to_review_queue",
        outputMode: "customer_safe_draft",
        authorityBoundary: [
          "Customer-visible language must remain review-before-send and non-commitment-only.",
        ],
      },
      {
        workerId: "delivery-assistant-worker",
        workerName: "Delivery Assistant Worker",
        workerRole: "delivery_assistant",
        responsibilityScope: [
          "Prepare activation readiness and delivery checklist summaries inside the workspace boundary.",
        ],
        responsibilityBoundary: [
          "May update internal readiness state, but cannot present it as customer-ready commitment by itself.",
        ],
        defaultSkills: ["activation-checklist-skill", "boundary-clarification-skill"],
        optionalSkills: [],
        reviewMode: "internal_only",
        escalationMode: "route_to_owner",
        outputMode: "internal_summary",
        authorityBoundary: [
          "Delivery outputs stay internal until a human confirms external-safe wording.",
        ],
      },
      {
        workerId: "customer-success-assistant-worker",
        workerName: "Customer Success Assistant Worker",
        workerRole: "customer_success_assistant",
        responsibilityScope: [
          "Prepare expansion review and next-step recommendations from usage and proposal context.",
        ],
        responsibilityBoundary: [
          "Expansion recommendations remain internal until a human selects what becomes customer-visible.",
        ],
        defaultSkills: ["expansion-review-skill", "boundary-clarification-skill"],
        optionalSkills: [],
        reviewMode: "internal_only",
        escalationMode: "route_to_owner",
        outputMode: "internal_recommendation",
        authorityBoundary: [
          "Cannot turn success signals into commercial commitment without review.",
        ],
      },
    ],
    skills: [
      {
        skillId: "followup-draft-skill",
        skillName: "跟进草稿技能",
        skillType: "followup_draft",
        inputSchema: {
          requiredFields: [
            "opportunityContext",
            "crmState",
            "recentConversationSummary",
          ],
          optionalFields: ["objectionSummary", "proposalContext"],
        },
        outputSchema: {
          requiredFields: ["draftBody", "boundaryNote", "recommendedNextStep"],
          optionalFields: ["subjectLine", "reviewSummary"],
        },
        scenarioTypes: ["sales_followup"],
        applicableRoles: ["sales_assistant"],
        blockedRoles: [],
        riskLevel: "medium",
        requiresReview: true,
        requiresApproval: false,
        allowsAutoExecution: false,
        customerFacingAllowed: true,
        nonCommitmentOnly: true,
        effectMode: "draft_only",
        resourceBindings: [
          "followup-crm-binding",
          "followup-email-draft-binding",
          "followup-docs-binding",
        ],
        fallbackBindings: ["followup-docs-binding"],
      },
      {
        skillId: "activation-checklist-skill",
        skillName: "Activation Checklist Skill",
        skillType: "activation_checklist",
        inputSchema: {
          requiredFields: [
            "workspaceState",
            "membershipState",
            "callbackStatus",
          ],
          optionalFields: ["packageBoundarySummary"],
        },
        outputSchema: {
          requiredFields: ["activationSummary", "readinessStatus", "nextStep"],
          optionalFields: ["dependencyNote", "ownerChecklist"],
        },
        scenarioTypes: ["delivery_activation_checklist"],
        applicableRoles: ["delivery_assistant"],
        blockedRoles: [],
        riskLevel: "low",
        requiresReview: false,
        requiresApproval: false,
        allowsAutoExecution: true,
        customerFacingAllowed: false,
        nonCommitmentOnly: true,
        effectMode: "internal_write",
        resourceBindings: [
          "activation-workspace-state-binding",
          "activation-membership-state-binding",
          "activation-callback-status-binding",
        ],
        fallbackBindings: [],
      },
      {
        skillId: "expansion-review-skill",
        skillName: "Expansion Review Skill",
        skillType: "expansion_review",
        inputSchema: {
          requiredFields: [
            "usageSignals",
            "successReviewHistory",
            "proposalContext",
          ],
          optionalFields: ["packageSummary", "deliveryRiskNote"],
        },
        outputSchema: {
          requiredFields: [
            "internalRecommendation",
            "boundarySummary",
            "nextStepSuggestion",
          ],
          optionalFields: ["roleSpecificFraming", "reviewNote"],
        },
        scenarioTypes: ["success_expansion_review"],
        applicableRoles: ["customer_success_assistant"],
        blockedRoles: [],
        riskLevel: "medium",
        requiresReview: false,
        requiresApproval: false,
        allowsAutoExecution: true,
        customerFacingAllowed: false,
        nonCommitmentOnly: true,
        effectMode: "draft_only",
        resourceBindings: [
          "expansion-usage-signal-binding",
          "expansion-success-review-binding",
          "expansion-proposal-context-binding",
        ],
        fallbackBindings: ["expansion-success-review-binding"],
      },
      {
        skillId: "boundary-clarification-skill",
        skillName: "Boundary Clarification Skill",
        skillType: "boundary_clarification",
        inputSchema: {
          requiredFields: ["currentJudgement", "prerequisites", "dependencies"],
          optionalFields: ["riskSignals", "reviewRequirement"],
        },
        outputSchema: {
          requiredFields: ["boundaryNote", "nonCommitmentNote"],
          optionalFields: ["externalSafeDowngrade"],
        },
        scenarioTypes: [
          "sales_followup",
          "delivery_activation_checklist",
          "success_expansion_review",
          "boundary_clarification",
        ],
        applicableRoles: [
          "founder_assistant",
          "sales_assistant",
          "delivery_assistant",
          "customer_success_assistant",
        ],
        blockedRoles: [],
        riskLevel: "low",
        requiresReview: false,
        requiresApproval: false,
        allowsAutoExecution: true,
        customerFacingAllowed: false,
        nonCommitmentOnly: true,
        effectMode: "draft_only",
        resourceBindings: ["boundary-docs-binding"],
        fallbackBindings: ["boundary-docs-binding"],
      },
    ],
    resourceBindings: [
      {
        bindingId: "followup-crm-binding",
        skillId: "followup-draft-skill",
        resourceId: "crm-resource",
        resourceType: "crm_connector",
        resourceCapability: "Read CRM state and opportunity history.",
        invocationMode: "sync_read",
        authMode: "connector_delegation",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Log which CRM records informed the draft.",
      },
      {
        bindingId: "followup-email-draft-binding",
        skillId: "followup-draft-skill",
        resourceId: "email-draft-resource",
        resourceType: "email_draft",
        resourceCapability: "Generate an internal-only email draft.",
        invocationMode: "async_prepare",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "medium",
        effectMode: "draft_only",
        auditHint: "Keep draft generation traceable before review.",
      },
      {
        bindingId: "followup-docs-binding",
        skillId: "followup-draft-skill",
        resourceId: "docs-query-resource",
        resourceType: "docs_query",
        resourceCapability: "Read package and boundary context for a customer-safe draft.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Record which docs informed the draft wording.",
      },
      {
        bindingId: "boundary-docs-binding",
        skillId: "boundary-clarification-skill",
        resourceId: "docs-query-resource",
        resourceType: "docs_query",
        resourceCapability: "Read policy, package and boundary context.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Record which boundary notes and docs shaped the output.",
      },
      {
        bindingId: "activation-workspace-state-binding",
        skillId: "activation-checklist-skill",
        resourceId: "workspace-state-resource",
        resourceType: "workspace_state",
        resourceCapability: "Read workspace readiness state.",
        invocationMode: "sync_read",
        authMode: "service_account",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Trace readiness reads back to the active workspace.",
      },
      {
        bindingId: "activation-membership-state-binding",
        skillId: "activation-checklist-skill",
        resourceId: "membership-state-resource",
        resourceType: "membership_state",
        resourceCapability: "Read membership and owner continuity state.",
        invocationMode: "sync_read",
        authMode: "service_account",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Keep membership reads visible in audit and replay.",
      },
      {
        bindingId: "activation-callback-status-binding",
        skillId: "activation-checklist-skill",
        resourceId: "callback-status-resource",
        resourceType: "callback_status",
        resourceCapability: "Read callback and prerequisite completion state.",
        invocationMode: "bounded_execution",
        authMode: "service_account",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "internal_write",
        auditHint: "Record callback-state updates as internal readiness events.",
      },
      {
        bindingId: "expansion-usage-signal-binding",
        skillId: "expansion-review-skill",
        resourceId: "usage-signal-resource",
        resourceType: "usage_signal",
        resourceCapability: "Read usage and adoption signals.",
        invocationMode: "sync_read",
        authMode: "service_account",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Log which adoption signals shaped the expansion review.",
      },
      {
        bindingId: "expansion-success-review-binding",
        skillId: "expansion-review-skill",
        resourceId: "success-review-resource",
        resourceType: "success_review",
        resourceCapability: "Read delivery and success review notes.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Keep success-review sources drillable through replay.",
      },
      {
        bindingId: "expansion-proposal-context-binding",
        skillId: "expansion-review-skill",
        resourceId: "proposal-context-resource",
        resourceType: "proposal_context",
        resourceCapability: "Read package and proposal context for boundary framing.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "medium",
        effectMode: "read_only",
        auditHint: "Trace which package or proposal context informed the recommendation.",
      },
    ],
    resources: [
      {
        resourceId: "crm-resource",
        resourceName: "CRM Resource",
        resourceType: "crm_connector",
        resourceSummary: "Workspace-scoped CRM connector for contact, company and opportunity state.",
        provider: "ClawHub connector",
        capabilityTags: ["crm", "contacts", "opportunities"],
        authRequirement: "connector_delegation",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Never cross workspace CRM records.",
        inputContract: "workspaceId + object references",
        outputContract: "read-only CRM state",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "email-draft-resource",
        resourceName: "Email Draft Resource",
        resourceType: "email_draft",
        resourceSummary: "Draft-only email composition surface with no direct send authority.",
        provider: "ClawHub draft runtime",
        capabilityTags: ["email", "draft", "customer_safe_wording"],
        authRequirement: "workspace_member_context",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Draft stays bound to the current workspace review chain.",
        inputContract: "draft prompt + context summary",
        outputContract: "internal draft body",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "docs-query-resource",
        resourceName: "Docs Query Resource",
        resourceType: "docs_query",
        resourceSummary: "Query policy, package and product docs for boundary framing.",
        provider: "ClawHub docs runtime",
        capabilityTags: ["docs", "boundary", "policy"],
        authRequirement: "workspace_member_context",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Limit reads to workspace-bound docs and policies.",
        inputContract: "doc ids + query text",
        outputContract: "read-only excerpts and references",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "workspace-state-resource",
        resourceName: "Workspace State Resource",
        resourceType: "workspace_state",
        resourceSummary: "Read activation and readiness state for the active workspace.",
        provider: "Helm control layer",
        capabilityTags: ["workspace", "activation", "state"],
        authRequirement: "service_account",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Never mutate another workspace.",
        inputContract: "workspaceId",
        outputContract: "workspace readiness snapshot",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "membership-state-resource",
        resourceName: "Membership State Resource",
        resourceType: "membership_state",
        resourceSummary: "Read membership and ownership continuity state.",
        provider: "Helm control layer",
        capabilityTags: ["membership", "authority", "ownership"],
        authRequirement: "service_account",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Reads stay inside the active workspace membership graph.",
        inputContract: "workspaceId + membership lookup",
        outputContract: "membership status",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "callback-status-resource",
        resourceName: "Callback Status Resource",
        resourceType: "callback_status",
        resourceSummary: "Read prerequisite and callback completion state for activation.",
        provider: "Helm control layer",
        capabilityTags: ["callback", "prerequisite", "activation"],
        authRequirement: "service_account",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Internal readiness updates only.",
        inputContract: "workspaceId + callback identifiers",
        outputContract: "callback readiness status",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "usage-signal-resource",
        resourceName: "Usage Signal Resource",
        resourceType: "usage_signal",
        resourceSummary: "Read adoption and usage signals for success review.",
        provider: "ClawHub signal runtime",
        capabilityTags: ["usage", "adoption", "success"],
        authRequirement: "service_account",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Usage signals remain tenant-scoped.",
        inputContract: "workspaceId + account identifiers",
        outputContract: "usage signal summary",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "success-review-resource",
        resourceName: "Success Review Resource",
        resourceType: "success_review",
        resourceSummary: "Read delivery and success notes for expansion review.",
        provider: "Helm memory and review layer",
        capabilityTags: ["success", "delivery", "review"],
        authRequirement: "workspace_member_context",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Review history stays in the active workspace.",
        inputContract: "workspaceId + account identifiers",
        outputContract: "success review summary",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "proposal-context-resource",
        resourceName: "Proposal Context Resource",
        resourceType: "proposal_context",
        resourceSummary: "Read package and proposal context for boundary-safe expansion framing.",
        provider: "Helm package layer",
        capabilityTags: ["proposal", "package", "boundary"],
        authRequirement: "workspace_member_context",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Package context remains workspace-scoped and non-commitment by default.",
        inputContract: "workspaceId + package or proposal identifiers",
        outputContract: "proposal context summary",
        auditSupport: true,
        replaySupport: true,
      },
    ],
    representativeFlows: [
      {
        flowId: "sales-followup-draft",
        scenarioType: "sales_followup",
        workerId: "sales-assistant-worker",
        skillId: "followup-draft-skill",
        resourceBindingIds: [
          "followup-crm-binding",
          "followup-email-draft-binding",
        ],
        controlPlaneChecks: ["review", "audit", "replay", "boundary"],
        outputMode: "customer_safe_draft",
      },
      {
        flowId: "delivery-activation-checklist",
        scenarioType: "delivery_activation_checklist",
        workerId: "delivery-assistant-worker",
        skillId: "activation-checklist-skill",
        resourceBindingIds: [
          "activation-workspace-state-binding",
          "activation-membership-state-binding",
          "activation-callback-status-binding",
        ],
        controlPlaneChecks: ["audit", "replay", "memory", "boundary"],
        outputMode: "internal_summary",
      },
      {
        flowId: "success-expansion-review",
        scenarioType: "success_expansion_review",
        workerId: "customer-success-assistant-worker",
        skillId: "expansion-review-skill",
        resourceBindingIds: [
          "expansion-usage-signal-binding",
          "expansion-success-review-binding",
          "expansion-proposal-context-binding",
        ],
        controlPlaneChecks: ["boundary", "audit", "replay", "memory"],
        outputMode: "internal_recommendation",
      },
    ],
  });

export const workerSkillResourceSprint2Blueprint =
  createWorkerSkillResourceContractBundle({
    workers: workerSkillResourceSprint1Blueprint.workers.map((worker) => {
      if (worker.workerId === "founder-assistant-worker") {
        return {
          ...worker,
          defaultSkills: [
            "boundary-clarification-skill",
            "risk-clarification-skill",
            "review-note-skill",
          ],
          optionalSkills: ["proposal-shaping-skill"],
        };
      }

      if (worker.workerId === "sales-assistant-worker") {
        return {
          ...worker,
          defaultSkills: [
            "followup-draft-skill",
            "boundary-clarification-skill",
            "objection-handling-skill",
            "proposal-shaping-skill",
          ],
          optionalSkills: ["review-note-skill"],
        };
      }

      if (worker.workerId === "delivery-assistant-worker") {
        return {
          ...worker,
          defaultSkills: [
            "activation-checklist-skill",
            "boundary-clarification-skill",
            "review-note-skill",
          ],
          optionalSkills: ["risk-clarification-skill"],
        };
      }

      if (worker.workerId === "customer-success-assistant-worker") {
        return {
          ...worker,
          defaultSkills: [
            "expansion-review-skill",
            "boundary-clarification-skill",
            "risk-clarification-skill",
          ],
          optionalSkills: ["objection-handling-skill", "review-note-skill"],
        };
      }

      return worker;
    }),
    skills: [
      ...workerSkillResourceSprint1Blueprint.skills,
      {
        skillId: "objection-handling-skill",
        skillName: "Objection Handling Skill",
        skillType: "objection_handling",
        inputSchema: {
          requiredFields: [
            "objectionSummary",
            "crmState",
            "recentConversationSummary",
          ],
          optionalFields: ["proposalContext", "browserResearchContext"],
        },
        outputSchema: {
          requiredFields: [
            "responseDraft",
            "boundaryNote",
            "recommendedFollowupPath",
          ],
          optionalFields: ["reviewSummary", "evidenceLinks"],
        },
        scenarioTypes: ["sales_followup", "sales_objection_response"],
        applicableRoles: ["sales_assistant", "customer_success_assistant"],
        blockedRoles: [],
        riskLevel: "medium",
        requiresReview: true,
        requiresApproval: false,
        allowsAutoExecution: false,
        customerFacingAllowed: true,
        nonCommitmentOnly: true,
        effectMode: "draft_only",
        resourceBindings: [
          "objection-crm-binding",
          "objection-docs-binding",
          "objection-browser-binding",
          "objection-proposal-context-binding",
        ],
        fallbackBindings: ["objection-docs-binding"],
      },
      {
        skillId: "proposal-shaping-skill",
        skillName: "Proposal Shaping Skill",
        skillType: "proposal_shaping",
        inputSchema: {
          requiredFields: [
            "proposalContext",
            "crmState",
            "boundarySummary",
          ],
          optionalFields: ["browserResearchContext", "objectionSummary"],
        },
        outputSchema: {
          requiredFields: [
            "proposalDraft",
            "nonCommitmentNote",
            "reviewPackageSummary",
          ],
          optionalFields: ["dependencyNote", "nextDecisionRequest"],
        },
        scenarioTypes: ["proposal_shaping_window"],
        applicableRoles: ["founder_assistant", "sales_assistant"],
        blockedRoles: [],
        riskLevel: "high",
        requiresReview: true,
        requiresApproval: true,
        allowsAutoExecution: false,
        customerFacingAllowed: true,
        nonCommitmentOnly: true,
        effectMode: "draft_only",
        resourceBindings: [
          "proposal-crm-binding",
          "proposal-docs-binding",
          "proposal-proposal-context-binding",
          "proposal-browser-binding",
        ],
        fallbackBindings: ["proposal-docs-binding"],
      },
      {
        skillId: "review-note-skill",
        skillName: "Review Note Skill",
        skillType: "review_note",
        inputSchema: {
          requiredFields: [
            "draftSummary",
            "boundarySummary",
            "evidenceSummary",
          ],
          optionalFields: ["decisionRequest", "workerContext"],
        },
        outputSchema: {
          requiredFields: ["reviewNote", "reviewChecklist", "queueSummary"],
          optionalFields: ["handoffHint", "ownerSummary"],
        },
        scenarioTypes: [
          "review_request_preparation",
          "delivery_activation_checklist",
          "success_expansion_review",
        ],
        applicableRoles: [
          "founder_assistant",
          "sales_assistant",
          "delivery_assistant",
          "customer_success_assistant",
        ],
        blockedRoles: [],
        riskLevel: "low",
        requiresReview: false,
        requiresApproval: false,
        allowsAutoExecution: true,
        customerFacingAllowed: false,
        nonCommitmentOnly: true,
        effectMode: "internal_write",
        resourceBindings: [
          "review-note-review-queue-binding",
          "review-note-docs-binding",
        ],
        fallbackBindings: ["review-note-docs-binding"],
      },
      {
        skillId: "risk-clarification-skill",
        skillName: "Risk Clarification Skill",
        skillType: "risk_clarification",
        inputSchema: {
          requiredFields: ["riskSignals", "currentJudgement", "dependencies"],
          optionalFields: ["prerequisites", "reviewRequirement"],
        },
        outputSchema: {
          requiredFields: [
            "riskNote",
            "boundarySummary",
            "recommendedEscalationPath",
          ],
          optionalFields: ["nonCommitmentNote", "ownerHint"],
        },
        scenarioTypes: [
          "risk_clarification",
          "success_expansion_review",
          "review_request_preparation",
        ],
        applicableRoles: [
          "founder_assistant",
          "sales_assistant",
          "delivery_assistant",
          "customer_success_assistant",
        ],
        blockedRoles: [],
        riskLevel: "medium",
        requiresReview: false,
        requiresApproval: false,
        allowsAutoExecution: true,
        customerFacingAllowed: false,
        nonCommitmentOnly: true,
        effectMode: "draft_only",
        resourceBindings: ["risk-signal-binding", "risk-docs-binding"],
        fallbackBindings: ["risk-docs-binding"],
      },
    ],
    resourceBindings: [
      ...workerSkillResourceSprint1Blueprint.resourceBindings,
      {
        bindingId: "objection-crm-binding",
        skillId: "objection-handling-skill",
        resourceId: "crm-resource",
        resourceType: "crm_connector",
        resourceCapability: "Read objection context from CRM and opportunity history.",
        invocationMode: "sync_read",
        authMode: "connector_delegation",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Record which CRM state shaped the objection response.",
      },
      {
        bindingId: "objection-docs-binding",
        skillId: "objection-handling-skill",
        resourceId: "docs-query-resource",
        resourceType: "docs_query",
        resourceCapability: "Read boundary and product notes for objection handling.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Log which docs informed the objection answer.",
      },
      {
        bindingId: "objection-browser-binding",
        skillId: "objection-handling-skill",
        resourceId: "browser-research-resource",
        resourceType: "browser_research",
        resourceCapability: "Collect bounded external research before drafting a response.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "medium",
        effectMode: "read_only",
        auditHint: "Capture bounded browser research sources for replay.",
      },
      {
        bindingId: "objection-proposal-context-binding",
        skillId: "objection-handling-skill",
        resourceId: "proposal-context-resource",
        resourceType: "proposal_context",
        resourceCapability: "Read package and proposal framing for objection-safe wording.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "medium",
        effectMode: "read_only",
        auditHint: "Trace which proposal context shaped the objection draft.",
      },
      {
        bindingId: "proposal-crm-binding",
        skillId: "proposal-shaping-skill",
        resourceId: "crm-resource",
        resourceType: "crm_connector",
        resourceCapability: "Read commercial context before shaping a proposal draft.",
        invocationMode: "sync_read",
        authMode: "connector_delegation",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Log CRM context that influenced proposal shaping.",
      },
      {
        bindingId: "proposal-docs-binding",
        skillId: "proposal-shaping-skill",
        resourceId: "docs-query-resource",
        resourceType: "docs_query",
        resourceCapability: "Read boundary, package and governance notes for proposal shaping.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Record which docs and policies informed the proposal draft.",
      },
      {
        bindingId: "proposal-proposal-context-binding",
        skillId: "proposal-shaping-skill",
        resourceId: "proposal-context-resource",
        resourceType: "proposal_context",
        resourceCapability: "Read proposal and package context for shaping and review packaging.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "medium",
        effectMode: "read_only",
        auditHint: "Trace which package context shaped the proposal draft.",
      },
      {
        bindingId: "proposal-browser-binding",
        skillId: "proposal-shaping-skill",
        resourceId: "browser-research-resource",
        resourceType: "browser_research",
        resourceCapability: "Collect bounded market or customer research for proposal shaping.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "medium",
        effectMode: "read_only",
        auditHint: "Capture bounded research sources for proposal review.",
      },
      {
        bindingId: "review-note-review-queue-binding",
        skillId: "review-note-skill",
        resourceId: "review-queue-resource",
        resourceType: "review_queue",
        resourceCapability: "Write an internal review note into the review queue.",
        invocationMode: "bounded_execution",
        authMode: "service_account",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "internal_write",
        auditHint: "Track review-note queue writes as internal-only review events.",
      },
      {
        bindingId: "review-note-docs-binding",
        skillId: "review-note-skill",
        resourceId: "docs-query-resource",
        resourceType: "docs_query",
        resourceCapability: "Read boundary and policy context while shaping the review note.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Keep review-note references drillable through replay.",
      },
      {
        bindingId: "risk-signal-binding",
        skillId: "risk-clarification-skill",
        resourceId: "risk-signal-resource",
        resourceType: "risk_signal",
        resourceCapability: "Read live risk, prerequisite and escalation signals.",
        invocationMode: "sync_read",
        authMode: "service_account",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Trace which risk signals shaped the clarification note.",
      },
      {
        bindingId: "risk-docs-binding",
        skillId: "risk-clarification-skill",
        resourceId: "docs-query-resource",
        resourceType: "docs_query",
        resourceCapability: "Read policy and boundary notes for risk clarification.",
        invocationMode: "sync_read",
        authMode: "workspace_member_context",
        workspaceScope: "current_workspace",
        riskLevel: "low",
        effectMode: "read_only",
        auditHint: "Record the boundary notes referenced by the risk clarification.",
      },
    ],
    resources: [
      ...workerSkillResourceSprint1Blueprint.resources,
      {
        resourceId: "browser-research-resource",
        resourceName: "Browser Research Resource",
        resourceType: "browser_research",
        resourceSummary: "Bounded browser research surface for objection and proposal context gathering.",
        provider: "ClawHub browser runtime",
        capabilityTags: ["browser", "research", "context"],
        authRequirement: "workspace_member_context",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Research stays attached to the current workspace evidence trail.",
        inputContract: "workspace-scoped research brief",
        outputContract: "bounded research notes and sources",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "review-queue-resource",
        resourceName: "Review Queue Resource",
        resourceType: "review_queue",
        resourceSummary: "Internal review queue surface for review notes and handoff packaging.",
        provider: "Helm approval layer",
        capabilityTags: ["review", "queue", "handoff"],
        authRequirement: "service_account",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Review queue writes remain internal to the active workspace.",
        inputContract: "review note payload + queue context",
        outputContract: "internal review package state",
        auditSupport: true,
        replaySupport: true,
      },
      {
        resourceId: "risk-signal-resource",
        resourceName: "Risk Signal Resource",
        resourceType: "risk_signal",
        resourceSummary: "Read risk, dependency and escalation signals for clarification and founder framing.",
        provider: "Helm control layer",
        capabilityTags: ["risk", "signal", "escalation"],
        authRequirement: "service_account",
        workspaceSupport: "current_workspace",
        tenantBoundaryHint: "Signals remain scoped to the active workspace and current objects.",
        inputContract: "workspaceId + object or scenario identifiers",
        outputContract: "risk signal summary",
        auditSupport: true,
        replaySupport: true,
      },
    ],
    representativeFlows: [
      ...workerSkillResourceSprint1Blueprint.representativeFlows,
      {
        flowId: "sales-objection-response",
        scenarioType: "sales_objection_response",
        workerId: "sales-assistant-worker",
        skillId: "objection-handling-skill",
        resourceBindingIds: [
          "objection-crm-binding",
          "objection-docs-binding",
          "objection-browser-binding",
        ],
        controlPlaneChecks: [
          "review",
          "audit",
          "replay",
          "boundary",
          "external_safe_wording",
        ],
        outputMode: "customer_safe_draft",
      },
      {
        flowId: "proposal-shaping-review",
        scenarioType: "proposal_shaping_window",
        workerId: "sales-assistant-worker",
        skillId: "proposal-shaping-skill",
        resourceBindingIds: [
          "proposal-crm-binding",
          "proposal-docs-binding",
          "proposal-proposal-context-binding",
        ],
        controlPlaneChecks: [
          "review",
          "approval",
          "audit",
          "replay",
          "boundary",
          "external_safe_wording",
        ],
        outputMode: "review_package",
      },
      {
        flowId: "review-note-preparation",
        scenarioType: "review_request_preparation",
        workerId: "delivery-assistant-worker",
        skillId: "review-note-skill",
        resourceBindingIds: [
          "review-note-review-queue-binding",
          "review-note-docs-binding",
        ],
        controlPlaneChecks: ["audit", "replay", "memory", "boundary"],
        outputMode: "review_package",
      },
      {
        flowId: "founder-risk-clarification",
        scenarioType: "risk_clarification",
        workerId: "founder-assistant-worker",
        skillId: "risk-clarification-skill",
        resourceBindingIds: ["risk-signal-binding", "risk-docs-binding"],
        controlPlaneChecks: ["audit", "replay", "memory", "boundary"],
        outputMode: "internal_recommendation",
      },
    ],
  });
