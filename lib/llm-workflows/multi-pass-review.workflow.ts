import {
  buildMultiPassReviewPrompt,
  llmPromptVersions,
  multiPassReviewSchema,
} from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import {
  LlmOutputSchemaError,
  parseLlmJsonOrThrow,
} from "@/lib/llm/output-parse-error";
import {
  prepareCounterfactualEgress,
  selectedContextStubSchema,
  type CounterfactualEgressResult,
  type SelectedContextStub,
} from "@/lib/llm/intelligence-contracts-v2";
import {
  MULTI_PASS_ROLES,
  multiPassRoleOutputSchema,
  resolveModelCapabilityProfile,
  type LLMWorkflowClass,
  type ModelCapabilityProfile,
  type ModelCapabilityProfileRegistry,
  type MultiPassRole,
  type MultiPassRoleOutput,
  type V3ReviewState,
} from "@/lib/llm/intelligence-contracts-v3";
import {
  multiPassBoundaryReceiptSchema,
  type MultiPassBoundaryReceipt,
  type MultiPassRoleCallReceipt,
} from "@/lib/llm/multi-pass-contract";
import { scanContextForPromptInjection } from "@/lib/llm/overlay-context-hygiene";
import {
  buildReasoningBudgetAuditSummary,
  resolveReasoningBudgetDecision,
  resolveReasoningBudgetMaxOutputTokens,
  type EvidenceCompleteness,
  type ReasoningBudgetDecision,
  type ReasoningBudgetFactor,
} from "@/lib/llm/reasoning-budget";
import type {
  LLMTaskExecutionResult,
  LLMTaskInput,
} from "@/lib/llm/types";
import type { LLMTrajectoryRiskClass } from "@/lib/llm/intelligence-contracts-v3";

export type { MultiPassRole, MultiPassRoleOutput } from "@/lib/llm/intelligence-contracts-v3";
export { multiPassBoundaryReceiptSchema } from "@/lib/llm/multi-pass-contract";
export type { MultiPassBoundaryReceipt } from "@/lib/llm/multi-pass-contract";

export type MultiPassFailureReason =
  | "provider_failure"
  | "parse_failure"
  | "schema_failure"
  | "egress_failure";

export type MultiPassBoundaryDecision =
  | "allow_candidate"
  | "review_required"
  | "reject"
  | "quarantine";

export type MultiPassResultReason =
  | MultiPassFailureReason
  | "profile_mismatch"
  | "role_conflict"
  | "guard_rejected"
  | "candidate_consensus"
  | "budget_review_required";

export type MultiPassReviewResult = {
  readonly boundaryDecision: MultiPassBoundaryDecision;
  readonly requiredHumanReview: boolean;
  readonly reason: MultiPassResultReason;
  readonly roleStates: Readonly<Record<MultiPassRole, V3ReviewState | "missing">>;
};

export type MultiPassReviewInput = {
  readonly profile: ModelCapabilityProfile;
  readonly roleOutputs: readonly MultiPassRoleOutput[];
  readonly failure?: {
    readonly reason: MultiPassFailureReason;
  };
};

const REQUIRED_WORKFLOW_CLASS: LLMWorkflowClass = "multi_pass_review";

function buildRoleStates(
  roleOutputs: readonly MultiPassRoleOutput[],
): Readonly<Record<MultiPassRole, V3ReviewState | "missing">> {
  return {
    generator: roleOutputs.find((output) => output.role === "generator")?.reviewState ?? "missing",
    critic: roleOutputs.find((output) => output.role === "critic")?.reviewState ?? "missing",
    adversary: roleOutputs.find((output) => output.role === "adversary")?.reviewState ?? "missing",
  };
}

function profileAllowsMultiPass(profile: ModelCapabilityProfile): boolean {
  return (
    profile.multiPassAllowed &&
    profile.allowedWorkflowClasses.includes(REQUIRED_WORKFLOW_CLASS) &&
    profile.providerMode !== "disabled" &&
    profile.contextMode !== "disabled_deterministic" &&
    profile.budgetClass !== "blocked"
  );
}

function hasDuplicateRoles(roleOutputs: readonly MultiPassRoleOutput[]): boolean {
  return new Set(roleOutputs.map((output) => output.role)).size !== roleOutputs.length;
}

export function arbitrateMultiPassReview(input: MultiPassReviewInput): MultiPassReviewResult {
  const roleStates = buildRoleStates(input.roleOutputs);

  if (input.failure) {
    return {
      boundaryDecision: input.failure.reason === "egress_failure" ? "quarantine" : "review_required",
      requiredHumanReview: true,
      reason: input.failure.reason,
      roleStates,
    };
  }

  if (!profileAllowsMultiPass(input.profile)) {
    return {
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "profile_mismatch",
      roleStates,
    };
  }

  if (hasDuplicateRoles(input.roleOutputs)) {
    return {
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "role_conflict",
      roleStates,
    };
  }

  const states = Object.values(roleStates);
  if (states.includes("rejected_by_guard")) {
    return {
      boundaryDecision: "reject",
      requiredHumanReview: true,
      reason: "guard_rejected",
      roleStates,
    };
  }

  if (states.some((state) => state !== "candidate")) {
    return {
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "role_conflict",
      roleStates,
    };
  }

  return {
    boundaryDecision: "allow_candidate",
    requiredHumanReview: false,
    reason: "candidate_consensus",
    roleStates,
  };
}

type MultiPassRemoteExecutor = (
  input: LLMTaskInput<MultiPassRoleOutput>,
) => Promise<LLMTaskExecutionResult<MultiPassRoleOutput>>;

export type MultiPassSyntheticLocalRoleRequest = {
  readonly role: MultiPassRole;
  readonly contextStub: SelectedContextStub;
  readonly proposalSummary: string;
  readonly priorRoleOutputs: readonly MultiPassRoleOutput[];
  readonly budgetDecision: ReasoningBudgetDecision;
};

export type ExecuteMultiPassReviewInput = {
  readonly workspaceId: string;
  readonly userId?: string | null;
  readonly profileKey: string;
  readonly profileRegistry: ModelCapabilityProfileRegistry;
  readonly contextStub: unknown;
  readonly proposalSummary: string;
  readonly businessValue: ReasoningBudgetFactor;
  readonly uncertainty: ReasoningBudgetFactor;
  readonly riskClass: LLMTrajectoryRiskClass;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly egressPolicy?: {
    readonly consentGranted?: boolean;
    readonly promptPreviewAccepted?: boolean;
    readonly auditRef?: string;
  };
  /** Unit-test seam only. Production remote execution always uses executeLLMTask. */
  readonly testOnlyRemoteExecutor?: MultiPassRemoteExecutor;
  /** Public-safe synthetic harness only; not a local private-model runtime. */
  readonly executeSyntheticLocalRole?: (
    request: MultiPassSyntheticLocalRoleRequest,
  ) => Promise<unknown>;
  readonly recordBoundaryDecision?: (receipt: MultiPassBoundaryReceipt) => void;
  readonly traceId?: string;
  readonly now?: () => Date;
};

export type MultiPassReviewExecutionResult = MultiPassReviewResult & {
  readonly profileKey: string;
  readonly budgetDecision: ReasoningBudgetDecision;
  readonly roleOutputs: readonly MultiPassRoleOutput[];
  readonly boundaryReceipt: MultiPassBoundaryReceipt;
};

type RoleCallReceipt = MultiPassRoleCallReceipt;

function failureFromFallbackReason(reason?: string | null): MultiPassFailureReason {
  if (reason === "output_parse_failed") return "parse_failure";
  if (reason === "output_schema_failed") return "schema_failure";
  return "provider_failure";
}

function applyBudgetBoundary(
  result: MultiPassReviewResult,
  budgetDecision: ReasoningBudgetDecision,
): MultiPassReviewResult {
  if (
    result.boundaryDecision === "allow_candidate" &&
    budgetDecision.boundaryDecision === "review_required"
  ) {
    return {
      ...result,
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "budget_review_required",
    };
  }
  return result;
}

function initialEgressAudit(): MultiPassBoundaryReceipt["egress"] {
  return {
    redacted: false,
    consentGranted: false,
    promptPreviewAccepted: false,
    auditRef: null,
    blockedReason: null,
  };
}

function receiptEgressAudit(egress: CounterfactualEgressResult): MultiPassBoundaryReceipt["egress"] {
  return {
    redacted: egress.audit.redacted,
    consentGranted: egress.audit.consentGranted,
    promptPreviewAccepted: egress.audit.promptPreviewAccepted,
    auditRef: egress.audit.auditRef?.trim() || null,
    blockedReason: egress.audit.blockedReason?.trim() || null,
  };
}

export async function executeMultiPassReview(
  input: ExecuteMultiPassReviewInput,
): Promise<MultiPassReviewExecutionResult> {
  const profile = resolveModelCapabilityProfile(input.profileKey, input.profileRegistry);
  const budgetDecision = resolveReasoningBudgetDecision({
    profile,
    businessValue: input.businessValue,
    uncertainty: input.uncertainty,
    riskClass: input.riskClass,
    evidenceCompleteness: input.evidenceCompleteness,
  });
  const roleOutputs: MultiPassRoleOutput[] = [];
  const roleCalls: RoleCallReceipt[] = [];
  let egressAudit = initialEgressAudit();

  const finish = (rawResult: MultiPassReviewResult): MultiPassReviewExecutionResult => {
    const result = applyBudgetBoundary(rawResult, budgetDecision);
    const boundaryReceipt = multiPassBoundaryReceiptSchema.parse({
      receiptId: input.traceId?.trim() || `${input.profileKey}:multi-pass-review`,
      traceId: input.traceId?.trim() || null,
      createdAt: (input.now ?? (() => new Date()))().toISOString(),
      profileKey: profile.profileKey,
      providerMode: profile.providerMode,
      promptKey: "multi-pass-review",
      promptVersion: llmPromptVersions.multiPassReview,
      budgetDecision,
      egress: egressAudit,
      roleCalls,
      boundaryDecision: result.boundaryDecision,
      requiredHumanReview: result.requiredHumanReview,
      reason: result.reason,
      rawPromptIncluded: false,
      rawCustomerDataIncluded: false,
      tenantUrlIncluded: false,
      productionReceiptIncluded: false,
    });
    input.recordBoundaryDecision?.(boundaryReceipt);
    return {
      ...result,
      profileKey: profile.profileKey,
      budgetDecision,
      roleOutputs,
      boundaryReceipt,
    };
  };

  if (profile.profileKey !== input.profileKey || !profileAllowsMultiPass(profile)) {
    return finish(arbitrateMultiPassReview({ profile, roleOutputs }));
  }

  const parsedStub = selectedContextStubSchema.safeParse(input.contextStub);
  if (!parsedStub.success) {
    return finish(
      arbitrateMultiPassReview({ profile, roleOutputs, failure: { reason: "schema_failure" } }),
    );
  }

  if (
    profile.providerMode === "remote" &&
    (profile.remoteEgressPolicy === "blocked" || !input.egressPolicy?.auditRef?.trim())
  ) {
    egressAudit = {
      ...initialEgressAudit(),
      consentGranted: input.egressPolicy?.consentGranted === true,
      promptPreviewAccepted: input.egressPolicy?.promptPreviewAccepted === true,
      blockedReason: "remote_multi_pass_requires_profile_egress_and_audit_ref",
    };
    return finish(
      arbitrateMultiPassReview({ profile, roleOutputs, failure: { reason: "egress_failure" } }),
    );
  }

  const egress = prepareCounterfactualEgress({
    contextStub: parsedStub.data,
    judgementSummary: input.proposalSummary,
    policy: {
      providerMode: profile.providerMode === "remote" ? "remote" : "local",
      consentGranted: input.egressPolicy?.consentGranted,
      promptPreviewAccepted: input.egressPolicy?.promptPreviewAccepted,
      auditRef: input.egressPolicy?.auditRef,
    },
  });
  egressAudit = receiptEgressAudit(egress);
  if (!egress.ok || !egress.safeStub || egress.safeJudgementSummary === null) {
    return finish(
      arbitrateMultiPassReview({ profile, roleOutputs, failure: { reason: "egress_failure" } }),
    );
  }

  if (
    profile.providerMode === "remote" &&
    (egress.safeStub.privacyClass === "blocked" ||
      egress.safeStub.privacyClass === "private_runtime" ||
      (profile.remoteEgressPolicy === "public_safe_only" &&
        egress.safeStub.privacyClass !== "public_safe_synthetic"))
  ) {
    egressAudit = { ...egressAudit, blockedReason: "remote_multi_pass_context_not_safe" };
    return finish(
      arbitrateMultiPassReview({ profile, roleOutputs, failure: { reason: "egress_failure" } }),
    );
  }

  const injectionScan = scanContextForPromptInjection({
    text: [
      egress.safeJudgementSummary,
      ...egress.safeStub.missingEvidence.map((item) => item.missingSignalNote),
    ].join("\n"),
  });
  if (injectionScan.status === "failed") {
    egressAudit = { ...egressAudit, blockedReason: "prompt_injection_scan_failed" };
    return finish(
      arbitrateMultiPassReview({ profile, roleOutputs, failure: { reason: "egress_failure" } }),
    );
  }

  const maxOutputTokens = Math.min(
    resolveReasoningBudgetMaxOutputTokens(budgetDecision),
    egress.safeStub.tokenBudget.maxOutputTokens ?? Number.POSITIVE_INFINITY,
  );
  const budgetAudit = buildReasoningBudgetAuditSummary(profile, budgetDecision);
  if (input.testOnlyRemoteExecutor && process.env.NODE_ENV !== "test") {
    return finish(
      arbitrateMultiPassReview({
        profile,
        roleOutputs: [],
        failure: { reason: "provider_failure" },
      }),
    );
  }
  const remoteExecutor: MultiPassRemoteExecutor =
    input.testOnlyRemoteExecutor ?? ((task) => executeLLMTask(task));

  for (const role of MULTI_PASS_ROLES) {
    const prompt = buildMultiPassReviewPrompt({
      role,
      contextStub: egress.safeStub,
      proposalSummary: egress.safeJudgementSummary,
      priorRoleOutputs: roleOutputs,
    });

    if (profile.providerMode === "local") {
      const syntheticLocalExecutionAllowed =
        profile.profileKey.startsWith("synthetic-") &&
        egress.safeStub.privacyClass === "public_safe_synthetic";
      if (!input.executeSyntheticLocalRole || !syntheticLocalExecutionAllowed) {
        return finish(
          arbitrateMultiPassReview({
            profile,
            roleOutputs,
            failure: { reason: "provider_failure" },
          }),
        );
      }
      try {
        const rawOutput = await input.executeSyntheticLocalRole({
          role,
          contextStub: egress.safeStub,
          proposalSummary: egress.safeJudgementSummary,
          priorRoleOutputs: roleOutputs,
          budgetDecision,
        });
        const parsedOutput = multiPassRoleOutputSchema.safeParse(rawOutput);
        if (!parsedOutput.success || parsedOutput.data.role !== role) {
          return finish(
            arbitrateMultiPassReview({
              profile,
              roleOutputs,
              failure: { reason: "schema_failure" },
            }),
          );
        }
        roleOutputs.push(parsedOutput.data);
        roleCalls.push({
          role,
          success: true,
          fallbackReason: null,
          promptKey: prompt.promptKey,
          promptVersion: prompt.promptVersion,
        });
      } catch {
        return finish(
          arbitrateMultiPassReview({
            profile,
            roleOutputs,
            failure: { reason: "provider_failure" },
          }),
        );
      }
      continue;
    }

    const fallbackOutput: MultiPassRoleOutput = {
      role,
      reviewState: "needs_review",
      evidenceRefs: [],
      notes: ["Provider call failed closed; human review is required."],
    };
    let execution: LLMTaskExecutionResult<MultiPassRoleOutput>;
    try {
      execution = await remoteExecutor({
        taskType: "MULTI_PASS_REVIEW",
        workspaceId: input.workspaceId,
        userId: input.userId ?? undefined,
        promptKey: prompt.promptKey,
        promptVersion: prompt.promptVersion,
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        inputSummary: `multi-pass role=${role} ${budgetAudit}`,
        outputMode: "json",
        jsonSchema: multiPassReviewSchema,
        maxOutputTokens,
        fallbackOutput,
        parseOutput(rawText) {
          const parsedJson = parseLlmJsonOrThrow<unknown>(rawText);
          const parsedOutput = multiPassRoleOutputSchema.safeParse(parsedJson);
          if (!parsedOutput.success || parsedOutput.data.role !== role) {
            throw new LlmOutputSchemaError(`invalid ${role} multi-pass output`);
          }
          return parsedOutput.data;
        },
      });
    } catch {
      return finish(
        arbitrateMultiPassReview({
          profile,
          roleOutputs,
          failure: { reason: "provider_failure" },
        }),
      );
    }

    roleCalls.push({
      role,
      success: execution.success,
      fallbackReason: execution.fallbackReason?.trim() || null,
      promptKey: execution.promptKey,
      promptVersion: execution.promptVersion,
    });
    if (!execution.success) {
      return finish(
        arbitrateMultiPassReview({
          profile,
          roleOutputs,
          failure: { reason: failureFromFallbackReason(execution.fallbackReason) },
        }),
      );
    }

    const parsedOutput = multiPassRoleOutputSchema.safeParse(execution.output);
    if (!parsedOutput.success || parsedOutput.data.role !== role) {
      return finish(
        arbitrateMultiPassReview({
          profile,
          roleOutputs,
          failure: { reason: "schema_failure" },
        }),
      );
    }
    roleOutputs.push(parsedOutput.data);
  }

  return finish(arbitrateMultiPassReview({ profile, roleOutputs }));
}
