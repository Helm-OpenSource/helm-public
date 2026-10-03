import "server-only";

import type { PrismaClient } from "@prisma/client";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  createGovernedModelGateway,
  type GovernedModelGatewayInput,
  type GovernedModelGatewayResult,
} from "@/lib/llm/governed-model-gateway.service";
import { attachUsageObservation, observeUsage } from "@/lib/llm/usage-observation";
import type { LLMProviderRunResult, LLMTaskInput, LLMTaskType } from "@/lib/llm/types";
import type { ModelRouteTaskClass } from "@/lib/llm/model-route-contracts";
import type { GovernedJsonValue } from "@/lib/llm/governed-model-adapter-registry.service";
import { bindOrdinaryPaidProjection } from "@/lib/llm/ordinary-paid-operation.service";
import { parseStoredModelEgressReceipt, parseStoredModelRouteDecision } from "@/lib/llm/model-egress-store.service";
import { reviewedOrdinaryPaidComposition } from "@/lib/llm/ordinary-paid-composition.service";

export class OrdinaryPaidEgressError extends Error {
  constructor(readonly code: string) { super(code); }
}

const TASKS: Readonly<Record<string, { taskType: LLMTaskType; taskClass: ModelRouteTaskClass }>> = {
  bi_analysis: { taskType: "BI_REPORT_ANALYSIS", taskClass: "summary_briefing" },
  bi_review: { taskType: "BI_REPORT_REVIEW", taskClass: "reasoning_counterfactual" },
  meeting_extraction: { taskType: "MEETING_MEMORY_EXTRACTION", taskClass: "extraction_classification" },
  recommendation_explanation: { taskType: "RECOMMENDATION_EXPLANATION", taskClass: "summary_briefing" },
  judgement_review: { taskType: "JUDGEMENT_BOUNDARY_REVIEW", taskClass: "reasoning_counterfactual" },
  counterfactual_review: { taskType: "COUNTERFACTUAL_REVIEW", taskClass: "reasoning_counterfactual" },
  multi_pass_review: { taskType: "MULTI_PASS_REVIEW", taskClass: "multi_pass_review" },
};
const BRIEFING_TASKS: Readonly<Record<string, LLMTaskType>> = {
  contact: "CONTACT_BRIEFING", company: "COMPANY_BRIEFING",
  opportunity: "OPPORTUNITY_BRIEFING", meeting: "MEETING_BRIEFING",
};

export type OrdinaryPaidPayload = {
  readonly [key: string]: GovernedJsonValue;
  taskType: LLMTaskType;
  promptKey: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  outputMode: "json" | "text";
  jsonSchema: GovernedJsonValue;
};
export type OrdinaryPaidOutput = {
  readonly [key: string]: GovernedJsonValue;
  rawOutput: string;
  modelVersion: string | null;
  promptTokens: number;
  completionTokens: number;
};
type Gateway = (request: GovernedModelGatewayInput<OrdinaryPaidPayload>) =>
  Promise<GovernedModelGatewayResult<OrdinaryPaidOutput>>;

/**
 * The adapter bridge consumes only an already settled governed result. It does
 * not turn the legacy adapter's token observation into a charge receipt.
 * Supplying a gateway is an application-composition responsibility; neither a
 * workflow input nor an environment amount can install an authority here.
 */
export function createOrdinaryPaidAdapterBridge(dependencies: {
  policyKey: string | null;
  gateway: Gateway;
  /** Separate reviewed application writer and C4 charge/read identity. */
  operationWriterClient?: PrismaClient | null;
  chargeClient?: PrismaClient | null;
  /** A reviewed data-asset projector/scanner, absent in the default composition. */
  issueProjection?: ((input: { workspaceId: string; operationId: string;
    projectedPayload: OrdinaryPaidPayload; projectedPayloadHash: string;
  }) => Promise<string>) | null;
}) {
  return async function run<TOutput>(input: LLMTaskInput<TOutput> & {
    effectiveMaxOutputTokens: number;
  }): Promise<LLMProviderRunResult<TOutput>> {
    if (!dependencies.policyKey || !input.ordinaryOperationId ||
        !dependencies.operationWriterClient || !dependencies.chargeClient ||
        dependencies.operationWriterClient === dependencies.chargeClient) {
      throw new OrdinaryPaidEgressError("paid_egress_operation_or_policy_unconfigured");
    }
    const writer = dependencies.operationWriterClient;
    const charge = dependencies.chargeClient;
    if (input.providerHint || input.modelHint) {
      throw new OrdinaryPaidEgressError("paid_egress_unbound_route_hint");
    }
    const operation = await charge.lLMWorkflowOperation.findFirst({ where: {
      id: input.ordinaryOperationId, workspaceId: input.workspaceId,
    } }).catch(() => {
      throw new OrdinaryPaidEgressError("paid_egress_in_doubt");
    });
    const task = operation && (operation.kind === "briefing"
      ? { taskType: BRIEFING_TASKS[operation.sourceType], taskClass: "summary_briefing" as const }
      : TASKS[operation.kind]);
    if (!operation || operation.id !== input.ordinaryOperationId ||
        operation.workspaceId !== input.workspaceId ||
        operation.status !== "prepared" || !task ||
        task.taskType !== input.taskType ||
        !operation.actorUserId || operation.actorUserId !== (input.userId ?? null)) {
      throw new OrdinaryPaidEgressError("paid_egress_operation_unavailable");
    }
    const projectedPayload: OrdinaryPaidPayload = {
      taskType: input.taskType,
      promptKey: input.promptKey,
      promptVersion: input.promptVersion,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      outputMode: input.outputMode ?? "text",
      jsonSchema: JSON.parse(canonicalJson(input.jsonSchema ?? null)) as GovernedJsonValue,
    };
    const projectedPayloadHash = sha256(canonicalJson(projectedPayload));
    let bound = operation;
    if (!bound.projectionReceiptRef && dependencies.issueProjection) {
      const projectionReceiptRef = await dependencies.issueProjection({
        workspaceId: input.workspaceId, operationId: operation.id,
        projectedPayload, projectedPayloadHash,
      });
      bound = await bindOrdinaryPaidProjection({ client: writer,
        workspaceId: input.workspaceId, operationId: operation.id,
        projectionReceiptRef, projectedPayloadHash }).catch(() => {
          throw new OrdinaryPaidEgressError("paid_egress_in_doubt");
        });
    }
    if (!bound.projectionReceiptRef || !bound.projectedPayloadHash) {
      throw new OrdinaryPaidEgressError("paid_egress_projection_authority_unconfigured");
    }
    if (projectedPayloadHash !== bound.projectedPayloadHash) {
      throw new OrdinaryPaidEgressError("paid_egress_prompt_projection_mismatch");
    }
    // An exception from the governed gateway does not prove the adapter was
    // never invoked. The claim or terminal write may have committed while its
    // acknowledgement was lost. Withhold business output on every such error.
    let result: GovernedModelGatewayResult<OrdinaryPaidOutput>;
    try {
      result = await dependencies.gateway({
      workspaceId: input.workspaceId,
      gatewayRef: "gateway:ordinary-paid-v1",
      policyKey: dependencies.policyKey,
      requestKey: operation.requestKey,
      taskClass: task.taskClass,
      taskRef: `ordinary:${operation.id}`,
      ordinaryOperationId: operation.id,
      projectionReceiptRef: bound.projectionReceiptRef,
      projectedPayload,
      requestedMaxOutputTokens: input.effectiveMaxOutputTokens,
      allowFallback: false,
      });
    } catch {
      throw new OrdinaryPaidEgressError("paid_egress_in_doubt");
    }
    if (!result || typeof result !== "object" ||
        !Array.isArray(result.attempts) ||
        typeof result.selectedDecisionRef !== "string") {
      throw new OrdinaryPaidEgressError("paid_egress_in_doubt");
    }
    if (result.status !== "success" || !result.output ||
        typeof result.output.rawOutput !== "string" ||
        !Number.isSafeInteger(result.output.promptTokens) || result.output.promptTokens < 0 ||
        !Number.isSafeInteger(result.output.completionTokens) || result.output.completionTokens < 0) {
      throw new OrdinaryPaidEgressError(
        result.status === "in_doubt" ? "paid_egress_in_doubt" : "paid_egress_no_committed_output",
      );
    }
    // The injected gateway port is not by itself an authorization. Read the
    // committed C3 facts back before passing even an in-memory result to a
    // workflow. In particular a terminal receipt without a settled ledger is
    // not a paid success.
    const { decision, terminal, ledger } = await (async () => {
      const [decision, terminal] = await Promise.all([
        charge.modelRouteDecision.findFirst({ where: {
          id: result.selectedDecisionRef, workspaceId: input.workspaceId,
        } }),
        charge.modelEgressReceipt.findUnique({ where: {
          decisionId_sequence: { decisionId: result.selectedDecisionRef, sequence: 2 },
        } }),
      ]);
      const ledger = decision?.dispatchProviderIdempotencyKey
        ? await charge.lLMSpendLedgerEntry.findUnique({ where: {
            workspaceId_attemptRef: {
              workspaceId: input.workspaceId, attemptRef: decision.dispatchProviderIdempotencyKey,
            },
          } })
        : null;
      return { decision, terminal, ledger };
    })().catch(() => {
      throw new OrdinaryPaidEgressError("paid_egress_committed_readback_invalid");
    });
    let committedTerminal: ReturnType<typeof parseStoredModelEgressReceipt>;
    let committedDecision: ReturnType<typeof parseStoredModelRouteDecision>;
    try {
      committedTerminal = parseStoredModelEgressReceipt(terminal!);
      committedDecision = parseStoredModelRouteDecision(decision!);
    } catch {
      throw new OrdinaryPaidEgressError("paid_egress_committed_readback_invalid");
    }
    const committedRoute = committedDecision.routeSnapshot;
    if (result.attempts.length !== 1 || result.attempts[0]?.replayed ||
        result.attempts[0]?.decision.decisionId !== decision?.id ||
        result.attempts[0]?.terminalReceipt?.contentHash !== terminal?.contentHash ||
        decision?.requestKey !== operation.requestKey ||
        decision.taskRef !== `ordinary:${operation.id}` ||
        decision.projectionReceiptRef !== bound.projectionReceiptRef ||
        terminal?.workspaceId !== input.workspaceId || terminal.outcome !== "SUCCESS" ||
        terminal.requestDisposition !== "ACCEPTED" ||
        !committedRoute ||
        committedTerminal.provider !== committedRoute.provider ||
        committedTerminal.modelId !== committedRoute.modelId ||
        committedTerminal.modelVersion !== committedRoute.modelVersion ||
        committedTerminal.promptTokens !== result.output.promptTokens ||
        committedTerminal.completionTokens !== result.output.completionTokens ||
        result.output.modelVersion !== committedTerminal.modelVersion ||
        committedTerminal.outputContentHash !== sha256(canonicalJson(result.output)) ||
        ledger?.state !== "settled" || ledger.contractVersion !== 2 ||
        ledger.provenanceState !== "complete") {
      throw new OrdinaryPaidEgressError("paid_egress_committed_readback_invalid");
    }
    const usage = { promptTokens: result.output.promptTokens,
      completionTokens: result.output.completionTokens };
    let output: TOutput;
    try {
      output = input.parseOutput(result.output.rawOutput);
    } catch (error) {
      throw attachUsageObservation(error, observeUsage(usage));
    }
    return { output, rawOutput: result.output.rawOutput,
      modelVersion: committedTerminal.modelVersion, usage,
      governedRoute: { provider: committedRoute.provider,
        model: committedRoute.modelId,
        modelVersion: committedRoute.modelVersion },
    };
  };
}

// No production price/FX approval issuer, terminal usage verifier or adapter
// registration has been installed. The genuine gateway also defaults to no
// spend authority; both boundaries stay closed until reviewed composition.
const closedGateway = createGovernedModelGateway<OrdinaryPaidPayload, OrdinaryPaidOutput>();
const closedBridge = createOrdinaryPaidAdapterBridge({
  policyKey: null,
  gateway: closedGateway,
});
export async function runOrdinaryPaidAdapter<TOutput>(input: LLMTaskInput<TOutput> & {
  effectiveMaxOutputTokens: number;
}): Promise<LLMProviderRunResult<TOutput>> {
  const installed = reviewedOrdinaryPaidComposition();
  return installed
    ? createOrdinaryPaidAdapterBridge(installed)(input)
    : closedBridge(input);
}
