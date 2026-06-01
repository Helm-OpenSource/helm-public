import { pathToFileURL } from "node:url";

import {
  resolveAskHelmAccessScope,
  type AskHelmAccessScopeInput,
} from "@/features/search/ask-helm-access-scope";
import {
  interpretAskHelmQuery,
  type AskHelmInterpreterInput,
} from "@/features/search/ask-helm-interpreter";
import {
  loadAskHelmKnowledgePack,
  validateAskHelmKnowledgePack,
  type AskHelmKnowledgePack,
  type AskHelmKnowledgePackContext,
  type AskHelmKnowledgePackValidation,
} from "@/features/search/ask-helm-knowledge-pack";
import {
  runAskHelmActionPacketEval,
  type AskHelmActionPacketEvalSummary,
} from "@/lib/evals/ask-helm-action-packet-evals";
import { runAskHelmActionIntentEval } from "@/lib/evals/ask-helm-action-intent-evals";
import { runAskHelmContextPacketEval } from "@/lib/evals/ask-helm-context-packet-evals";
import { runAskHelmQueryIntentEval } from "@/lib/evals/ask-helm-query-intent-evals";

type AskHelmValidationIntentSummary = {
  readonly minimumPassRate: number;
  readonly totalCases: number;
  readonly passedCases: number;
  readonly passRate: number;
  readonly meetsMinimumPassRate: boolean;
};

type AskHelmValidationContextPacketSummary = {
  readonly passed: boolean;
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failureCount: number;
  readonly authorityLeakCount: number;
  readonly rawLeakCount: number;
  readonly memoryPolicyViolationCount: number;
  readonly redactionCoveragePercent: number;
  readonly contextCoveragePercent: number;
  readonly failures: ReadonlyArray<{
    readonly caseId: string;
    readonly reason: string;
  }>;
};

type AskHelmValidationActionPacketSummary = Pick<
  AskHelmActionPacketEvalSummary,
  | "authorityLeakCount"
  | "failureCount"
  | "failures"
  | "passed"
  | "passedCases"
  | "totalCases"
>;

type AskHelmValidationInterpreterResponse = {
  readonly classification: {
    readonly intentType: string;
  };
  readonly retrievalPlan: {
    readonly readOnly: boolean;
    readonly writePath: boolean;
    readonly sources: readonly string[];
  };
  readonly nextStep: {
    readonly primary: {
      readonly target?: string;
      readonly [key: string]: unknown;
    };
  };
  readonly boundaryNote?: {
    readonly type?: string;
  };
  readonly plan?: {
    readonly steps: ReadonlyArray<{
      readonly id: string;
      readonly objectRef?: {
        readonly label?: string;
      };
      readonly dri?: {
        readonly label?: string;
        readonly role?: string;
      };
      readonly due?: {
        readonly label?: string;
        readonly timing?: string;
      };
    }>;
  };
  readonly preparedArtifact?: {
    readonly status?: string;
  };
  readonly actionHandoff?: {
    readonly writeEnabled?: boolean;
  };
  readonly actionPacket?: {
    readonly status?: string;
    readonly nextSurface?: {
      readonly target?: string;
    };
    readonly evidenceRefs?: ReadonlyArray<{
      readonly sourceType?: string;
    }>;
    readonly risks?: ReadonlyArray<{
      readonly id?: string;
    }>;
    readonly authority?: {
      readonly readOnly?: boolean;
      readonly writeEnabled?: boolean;
      readonly autoExecuteEnabled?: boolean;
      readonly formalCommitmentAllowed?: boolean;
    };
  };
};

type AskHelmValidationAccessScope = {
  readonly canAsk: boolean;
  readonly objectReadScope: string;
  readonly deniedHelpTopics: readonly string[];
  readonly retrievalSourcePolicy: {
    readonly objectSearch: string;
  };
};

export type AskHelmValidationSuiteDeps = {
  readonly runQueryIntentEval?: () => AskHelmValidationIntentSummary;
  readonly runActionIntentEval?: () => AskHelmValidationIntentSummary;
  readonly runActionPacketEval?: () => AskHelmValidationActionPacketSummary;
  readonly runContextPacketEval?: () => AskHelmValidationContextPacketSummary;
  readonly loadKnowledgePack?: (context: AskHelmKnowledgePackContext) => unknown;
  readonly validateKnowledgePack?: (
    pack: unknown,
  ) => Pick<AskHelmKnowledgePackValidation, "failures" | "ok"> &
    Partial<AskHelmKnowledgePackValidation>;
  readonly interpretQuery?: (
    input: AskHelmInterpreterInput,
  ) => AskHelmValidationInterpreterResponse;
  readonly resolveAccessScope?: (
    input: AskHelmAccessScopeInput,
  ) => AskHelmValidationAccessScope;
  readonly interpreterQueries?: readonly string[];
};

export type AskHelmValidationStopCondition = {
  readonly id: string;
  readonly clear: boolean;
  readonly evidence: string;
};

export type AskHelmValidationSuiteReport = {
  readonly ok: boolean;
  readonly failures: readonly string[];
  readonly queryIntent: {
    readonly totalCases: number;
    readonly passedCases: number;
    readonly passRate: number;
  };
  readonly actionIntent: {
    readonly totalCases: number;
    readonly passedCases: number;
    readonly passRate: number;
  };
  readonly actionPacket: {
    readonly totalCases: number;
    readonly passedCases: number;
    readonly failureCount: number;
    readonly authorityLeakCount: number;
  };
  readonly contextPacket: {
    readonly totalCases: number;
    readonly passedCases: number;
    readonly failureCount: number;
    readonly authorityLeakCount: number;
    readonly rawLeakCount: number;
    readonly memoryPolicyViolationCount: number;
    readonly redactionCoveragePercent: number;
    readonly contextCoveragePercent: number;
  };
  readonly knowledgePack: Pick<AskHelmKnowledgePackValidation, "failures" | "ok"> &
    Partial<AskHelmKnowledgePackValidation>;
  readonly interpreter: {
    readonly totalCases: number;
    readonly failures: readonly string[];
    readonly cases: ReadonlyArray<{
      readonly intentType: string;
      readonly sources: readonly string[];
      readonly nextStep: AskHelmValidationInterpreterResponse["nextStep"]["primary"];
      readonly boundaryType?: string;
    }>;
  };
  readonly accessScope: {
    readonly memberCanAsk: boolean;
    readonly objectReadScope: string;
    readonly deniedHelpTopics: readonly string[];
    readonly nonMemberCanAsk: boolean;
  };
  readonly stopConditions: readonly AskHelmValidationStopCondition[];
};

export const ASK_HELM_VALIDATION_INTERPRETER_QUERIES = [
  "找到和 Atlas 相关的机会",
  "最近和星河连锁有关的会议",
  "今天最该先推进什么",
  "为什么这条还不能直接执行",
  "审批和经营记忆的区别是什么",
  "帮我直接给客户发续约邮件",
  "帮我把 Atlas 续约拆成三步",
  "准备一封给星河连锁的跟进邮件草稿",
  "把这条加入内部跟进队列",
  "跨两个 workspace 比较一下哪个团队效率更高",
] as const;

const ASK_HELM_ACTION_PACKET_REQUIRED_INTENTS = new Set([
  "plan_breakdown",
  "prepare_draft",
  "prepare_review_packet",
  "queue_internal_followup",
  "request_handoff",
  "request_execution",
  "review_required_execution",
]);

function buildDefaultWorkspaceContext() {
  return {
    workspaceSlug: "demo",
    membershipRole: "member",
    enabledTenantExtensions: ["bi-report"],
    focusAreas: ["renewal"],
  };
}

export function buildAskHelmInterpreterInput(
  rawQuery: string,
): AskHelmInterpreterInput {
  const normalized = rawQuery.toLowerCase();

  if (normalized.includes("atlas")) {
    return {
      rawQuery,
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_atlas",
          displayName: "Atlas AI 联合解决方案合作",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_atlas",
        },
      ],
      workspaceContext: buildDefaultWorkspaceContext(),
    };
  }

  if (normalized.includes("星河") || normalized.includes("xinghe")) {
    return {
      rawQuery,
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_xinghe",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_xinghe",
        },
      ],
      workspaceContext: buildDefaultWorkspaceContext(),
    };
  }

  return {
    rawQuery,
    workspaceContext: buildDefaultWorkspaceContext(),
  };
}

export function runAskHelmValidationSuite(
  deps: AskHelmValidationSuiteDeps = {},
): AskHelmValidationSuiteReport {
  const queryIntentSummary =
    (deps.runQueryIntentEval ?? runAskHelmQueryIntentEval)();
  const actionIntentSummary =
    (deps.runActionIntentEval ?? runAskHelmActionIntentEval)();
  const actionPacketSummary =
    (deps.runActionPacketEval ?? runAskHelmActionPacketEval)();
  const contextPacketSummary =
    (deps.runContextPacketEval ?? runAskHelmContextPacketEval)();
  const loadKnowledgePack =
    deps.loadKnowledgePack ?? ((context) => loadAskHelmKnowledgePack(context));
  const validateKnowledgePack =
    deps.validateKnowledgePack ??
    ((pack: unknown) =>
      validateAskHelmKnowledgePack(pack as AskHelmKnowledgePack));
  const interpretQuery = deps.interpretQuery ?? interpretAskHelmQuery;
  const resolveAccessScope =
    deps.resolveAccessScope ?? resolveAskHelmAccessScope;
  const interpreterQueries =
    deps.interpreterQueries ?? ASK_HELM_VALIDATION_INTERPRETER_QUERIES;

  const knowledgePack = loadKnowledgePack({
    enabledTenantExtensions: ["bi-report"],
    membershipRole: "member",
    workspaceProfileType: "controlled_trial",
    focusAreas: ["renewal"],
  });
  const knowledgePackValidation = validateKnowledgePack(knowledgePack);
  const interpreterResponses = interpreterQueries.map((rawQuery) =>
    interpretQuery(buildAskHelmInterpreterInput(rawQuery)),
  );
  const memberScope = resolveAccessScope({
    hasWorkspaceMembership: true,
    membershipRole: "member",
    requestedHelpTopics: ["memory", "reserved_internal_truth"],
  });
  const noMembershipScope = resolveAccessScope({
    hasWorkspaceMembership: false,
    requestedHelpTopics: ["memory"],
  });

  const interpreterFailures =
    buildAskHelmInterpreterFailures(interpreterResponses);
  const accessFailures = buildAskHelmAccessFailures(memberScope, noMembershipScope);
  const stopConditions = buildAskHelmStopConditions({
    actionIntentSummary,
    actionPacketSummary,
    accessFailures,
    contextPacketSummary,
    interpreterFailures,
    knowledgePackValidation,
    queryIntentSummary,
  });
  const failures = [
    ...(queryIntentSummary.meetsMinimumPassRate
      ? []
      : [
          `query intent pass rate below ${queryIntentSummary.minimumPassRate}%`,
        ]),
    ...(actionIntentSummary.meetsMinimumPassRate
      ? []
      : [
          `action intent pass rate below ${actionIntentSummary.minimumPassRate}%`,
        ]),
    ...(actionPacketSummary.passed
      ? []
      : actionPacketSummary.failures.map(
          (item) => `action packet ${item.caseId}: ${item.reason}`,
        )),
    ...knowledgePackValidation.failures,
    ...contextPacketSummary.failures.map(
      (item) => `context packet ${item.caseId}: ${item.reason}`,
    ),
    ...interpreterFailures,
    ...accessFailures,
    ...stopConditions
      .filter((condition) => !condition.clear)
      .map((condition) => `stop condition triggered: ${condition.id}`),
  ];

  return {
    ok: failures.length === 0,
    failures,
    queryIntent: {
      totalCases: queryIntentSummary.totalCases,
      passedCases: queryIntentSummary.passedCases,
      passRate: queryIntentSummary.passRate,
    },
    actionIntent: {
      totalCases: actionIntentSummary.totalCases,
      passedCases: actionIntentSummary.passedCases,
      passRate: actionIntentSummary.passRate,
    },
    actionPacket: {
      totalCases: actionPacketSummary.totalCases,
      passedCases: actionPacketSummary.passedCases,
      failureCount: actionPacketSummary.failureCount,
      authorityLeakCount: actionPacketSummary.authorityLeakCount,
    },
    contextPacket: {
      totalCases: contextPacketSummary.totalCases,
      passedCases: contextPacketSummary.passedCases,
      failureCount: contextPacketSummary.failureCount,
      authorityLeakCount: contextPacketSummary.authorityLeakCount,
      rawLeakCount: contextPacketSummary.rawLeakCount,
      memoryPolicyViolationCount:
        contextPacketSummary.memoryPolicyViolationCount,
      redactionCoveragePercent: contextPacketSummary.redactionCoveragePercent,
      contextCoveragePercent: contextPacketSummary.contextCoveragePercent,
    },
    knowledgePack: knowledgePackValidation,
    interpreter: {
      totalCases: interpreterResponses.length,
      failures: interpreterFailures,
      cases: interpreterResponses.map((response) => ({
        intentType: response.classification.intentType,
        sources: response.retrievalPlan.sources,
        nextStep: response.nextStep.primary,
        boundaryType: response.boundaryNote?.type,
      })),
    },
    accessScope: {
      memberCanAsk: memberScope.canAsk,
      objectReadScope: memberScope.objectReadScope,
      deniedHelpTopics: memberScope.deniedHelpTopics,
      nonMemberCanAsk: noMembershipScope.canAsk,
    },
    stopConditions,
  };
}

function buildAskHelmInterpreterFailures(
  interpreterResponses: readonly AskHelmValidationInterpreterResponse[],
) {
  return interpreterResponses.flatMap((response) => {
    const failures: string[] = [];
    const intentType = response.classification.intentType;

    if (!response.retrievalPlan.readOnly || response.retrievalPlan.writePath) {
      failures.push(`${intentType}: write path enabled`);
    }
    if (!response.nextStep.primary.target) {
      failures.push(`${intentType}: missing next step target`);
    }
    if (
      intentType === "out_of_scope" &&
      response.boundaryNote?.type !== "out_of_scope"
    ) {
      failures.push("out_of_scope: missing boundary note");
    }
    if (
      intentType === "review_required_execution" &&
      response.boundaryNote?.type !== "review_required"
    ) {
      failures.push("review_required_execution: missing review boundary");
    }
    if (intentType === "plan_breakdown" && !response.plan) {
      failures.push("plan_breakdown: missing plan");
    }
    if (response.plan) {
      for (const step of response.plan.steps) {
        if (!step.objectRef?.label) {
          failures.push(`${intentType}:${step.id}: missing objectRef`);
        }
        if (!step.dri?.label || !step.dri.role) {
          failures.push(`${intentType}:${step.id}: missing dri`);
        }
        if (!step.due?.label || !step.due.timing) {
          failures.push(`${intentType}:${step.id}: missing due`);
        }
      }
    }
    if (
      intentType === "prepare_draft" &&
      response.preparedArtifact?.status !== "draft_only"
    ) {
      failures.push("prepare_draft: missing draft-only artifact");
    }
    if (
      intentType === "queue_internal_followup" &&
      response.actionHandoff?.writeEnabled !== false
    ) {
      failures.push("queue_internal_followup: handoff write enabled or missing");
    }
    if (
      intentType === "cross_workspace_denied" &&
      response.retrievalPlan.sources.length > 0
    ) {
      failures.push("cross_workspace_denied: retrieval sources opened");
    }
    if (ASK_HELM_ACTION_PACKET_REQUIRED_INTENTS.has(intentType)) {
      if (!response.actionPacket) {
        failures.push(`${intentType}: missing action packet`);
      } else {
        if (!response.actionPacket.nextSurface?.target) {
          failures.push(`${intentType}: missing action packet target`);
        }
        if (!response.actionPacket.evidenceRefs?.length) {
          failures.push(`${intentType}: missing action packet evidence`);
        }
        if (
          response.actionPacket.authority?.readOnly !== true ||
          response.actionPacket.authority?.writeEnabled !== false ||
          response.actionPacket.authority?.autoExecuteEnabled !== false ||
          response.actionPacket.authority?.formalCommitmentAllowed !== false
        ) {
          failures.push(`${intentType}: action packet authority leak`);
        }
      }
    }
    return failures;
  });
}

function buildAskHelmAccessFailures(
  memberScope: AskHelmValidationAccessScope,
  noMembershipScope: AskHelmValidationAccessScope,
) {
  return [
    memberScope.canAsk ? null : "member scope denied unexpectedly",
    memberScope.objectReadScope === "current_workspace"
      ? null
      : "member object read scope is not current_workspace",
    memberScope.deniedHelpTopics.includes("reserved_internal_truth")
      ? null
      : "reserved_internal_truth is not denied",
    noMembershipScope.canAsk ? "non-member scope allowed unexpectedly" : null,
    noMembershipScope.retrievalSourcePolicy.objectSearch === "denied"
      ? null
      : "non-member object search is not denied",
  ].filter((failure): failure is string => Boolean(failure));
}

function buildAskHelmStopConditions(input: {
  readonly actionIntentSummary: AskHelmValidationIntentSummary;
  readonly actionPacketSummary: AskHelmValidationActionPacketSummary;
  readonly accessFailures: readonly string[];
  readonly contextPacketSummary: AskHelmValidationContextPacketSummary;
  readonly interpreterFailures: readonly string[];
  readonly knowledgePackValidation: Pick<
    AskHelmKnowledgePackValidation,
    "failures" | "ok"
  >;
  readonly queryIntentSummary: AskHelmValidationIntentSummary;
}): AskHelmValidationStopCondition[] {
  const {
    actionIntentSummary,
    actionPacketSummary,
    accessFailures,
    contextPacketSummary,
    interpreterFailures,
    knowledgePackValidation,
    queryIntentSummary,
  } = input;

  return [
    {
      id: "classifier_pass_rate_below_80",
      clear: queryIntentSummary.passRate >= 80,
      evidence: `${queryIntentSummary.passRate}%`,
    },
    {
      id: "action_classifier_pass_rate_below_90",
      clear: actionIntentSummary.passRate >= 90,
      evidence: `${actionIntentSummary.passRate}%`,
    },
    {
      id: "action_packet_gate_failed",
      clear: actionPacketSummary.passed,
      evidence:
        actionPacketSummary.failures
          .map((item) => `${item.caseId}:${item.reason}`)
          .join("; ") || "action packet gate valid",
    },
    {
      id: "knowledge_pack_not_structured",
      clear: knowledgePackValidation.ok,
      evidence:
        knowledgePackValidation.failures.join("; ") || "structured pack valid",
    },
    {
      id: "missing_next_step",
      clear: interpreterFailures.every(
        (failure) => !failure.includes("missing next step"),
      ),
      evidence:
        interpreterFailures.join("; ") || "all interpreter cases have targets",
    },
    {
      id: "plan_step_contract_missing",
      clear: interpreterFailures.every(
        (failure) =>
          !failure.includes("missing objectRef") &&
          !failure.includes("missing dri") &&
          !failure.includes("missing due"),
      ),
      evidence:
        interpreterFailures.join("; ") ||
        "all plan steps include objectRef, dri, due",
    },
    {
      id: "write_path_enabled",
      clear: interpreterFailures.every(
        (failure) => !failure.includes("write path"),
      ),
      evidence:
        interpreterFailures.join("; ") || "all interpreter cases are read-only",
    },
    {
      id: "access_scope_leak",
      clear: accessFailures.length === 0,
      evidence: accessFailures.join("; ") || "access scope valid",
    },
    {
      id: "context_packet_gate_failed",
      clear: contextPacketSummary.passed,
      evidence:
        contextPacketSummary.failures
          .map((item) => `${item.caseId}:${item.reason}`)
          .join("; ") || "context packet gate valid",
    },
  ];
}

export function printAskHelmValidationSuiteReport(
  report: AskHelmValidationSuiteReport,
  output: Pick<typeof console, "log"> = console,
): void {
  output.log(JSON.stringify(report, null, 2));
}

export function main(
  deps: AskHelmValidationSuiteDeps = {},
  output: Pick<typeof console, "log"> = console,
): number {
  const report = runAskHelmValidationSuite(deps);
  printAskHelmValidationSuiteReport(report, output);
  return report.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
