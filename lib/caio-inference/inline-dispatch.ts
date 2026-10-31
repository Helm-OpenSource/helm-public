import "server-only";

import type {
  GovernedJsonValue,
  GovernedModelGatewayResult,
} from "@/lib/llm/governed-model-gateway.service";
import type { ModelRouteTaskClass } from "@/lib/llm/model-route-contracts";

import {
  CAIO_INFERENCE_ROUTE_TASK_CLASS,
  type CaioInferenceInput,
  type CaioInferenceTaskClass,
} from "./contracts";
import { CAIO_INFERENCE_PROJECTION_ENGINE_KEY, type CaioInferenceProjectionPort } from "./governed-dispatch";

/**
 * One-shot governed execution handle for an inline (in-process) inference reservation.
 *
 * The synchronous governed gateway claims, invokes and writes the terminal receipt inside ONE call and only
 * then returns the body (`executeGovernedModelRequest`, lib/llm/governed-model-gateway.service.ts). The
 * queue therefore cannot observe a decision before the model has answered, so this handle does exactly:
 * projection receipt -> one gateway call -> a closed outcome the queue can record. It never retries, never
 * asks for a fallback route, and never calls the deferred dispatch's complete / fail / expire: the gateway
 * already settled the terminal and the spend.
 *
 * Request identity is per attempt (`${jobId}:${attempt}`), the same shape the deferred path uses. A new
 * attempt is a new request, so the queue must never start one for a row that may already have been
 * charged; that rule lives in the queue (reconciliation marks such rows `in_doubt`), not here.
 */
export type CaioInferenceInlineGatewayPort = (request: {
  workspaceId: string;
  gatewayRef: string;
  policyKey: string;
  requestKey: string;
  taskClass: ModelRouteTaskClass;
  taskRef: string;
  projectionReceiptRef: string;
  projectedPayload: CaioInferenceInput;
  requestedMaxOutputTokens: number;
  allowFallback: false;
}) => Promise<GovernedModelGatewayResult<GovernedJsonValue>>;

type Binding = { decisionRef: string | null; claimHash: string | null };

export type CaioInferenceInlineExecution =
  | ({
      status: "completed";
      output: GovernedJsonValue;
      decisionRef: string;
      claimHash: string;
      gatewayRef: string;
      terminalReceiptRef: string | null;
      /** Digest the gateway's terminal receipt recorded for the body, when it recorded one. */
      terminalOutputHash: string | null;
      reasonCode: string | null;
    })
  /** Nothing was charged: the decision was blocked, not dispatched, or refused before the authorization cutoff. */
  | ({ status: "blocked"; reasonCode: string | null } & Binding)
  /** The gateway recorded a FAILURE terminal for the request; the spend is settled by the gateway. */
  | ({ status: "failed"; reasonCode: string | null } & Binding)
  /** A terminal receipt exists for the request but the body is not available (replayed without output). */
  | ({ status: "output_lost"; reasonCode: string | null } & Binding)
  /** The request may have been charged and reached no verifiable terminal. */
  | ({ status: "in_doubt"; reasonCode: string | null } & Binding);

// Thrown AFTER the authorization cutoff: a claim exists, so the request may have been charged.
const POST_CUTOFF_GATEWAY_CODES: ReadonlySet<string> = new Set([
  "terminal_receipt_persistence_failed_output_withheld",
  "spend_invariant_breach_output_withheld",
]);

// Thrown BEFORE the authorization cutoff by the gateway itself: deterministic refusals, nothing charged.
const PRE_CUTOFF_GATEWAY_CODES: ReadonlySet<string> = new Set([
  "governed_model_request_invalid",
  "adapter_registry_configuration_ambiguous",
  "projection_receipt_not_found",
  "projection_receipt_invalid",
  "projection_payload_binding_mismatch",
  "projection_output_token_budget_exceeded",
  "prepared_model_route_decision_missing",
]);

// Store and projection refusals are raised inside their own transactions, which roll back; no claim survives.
const PRE_CUTOFF_ERROR_NAMES: ReadonlySet<string> = new Set([
  "ModelEgressStoreError",
  "GovernedModelProjectionError",
]);

function describeError(error: unknown): { name: string; code: string; decisionRef: string | null } {
  if (!error || typeof error !== "object") return { name: "unknown", code: "gateway_threw_unclassified", decisionRef: null };
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown; decisionRef?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "unknown";
  const code =
    typeof candidate.code === "string" && candidate.code.length > 0
      ? candidate.code
      : typeof candidate.message === "string" && candidate.message.length > 0
        ? candidate.message.split(":")[0]!.trim()
        : "gateway_threw_unclassified";
  const decisionRef = typeof candidate.decisionRef === "string" ? candidate.decisionRef : null;
  return { name, code, decisionRef };
}

export function classifyCaioInferenceInlineGatewayError(error: unknown): CaioInferenceInlineExecution {
  const { name, code, decisionRef } = describeError(error);
  if (name === "GovernedModelGatewayError" && POST_CUTOFF_GATEWAY_CODES.has(code)) {
    return { status: "in_doubt", reasonCode: code, decisionRef, claimHash: null };
  }
  if (name === "GovernedModelGatewayError" && PRE_CUTOFF_GATEWAY_CODES.has(code)) {
    return { status: "blocked", reasonCode: code, decisionRef, claimHash: null };
  }
  if (PRE_CUTOFF_ERROR_NAMES.has(name)) {
    return { status: "blocked", reasonCode: code, decisionRef: null, claimHash: null };
  }
  // Connection loss, a crashed retry helper, anything unforeseen: a claim may have committed. Fail closed.
  return { status: "in_doubt", reasonCode: code, decisionRef, claimHash: null };
}

export function classifyCaioInferenceInlineGatewayResult(
  result: GovernedModelGatewayResult<GovernedJsonValue>,
  gatewayRef: string,
): CaioInferenceInlineExecution {
  const last = result.attempts.at(-1) ?? null;
  const decisionRef = result.selectedDecisionRef || last?.decision.decisionId || null;
  const claimHash = last?.terminalReceipt?.dispatchClaimHash ?? last?.startedReceipt?.dispatchClaimHash ?? null;
  const reasonCode = last?.reasonCode ?? null;
  switch (result.status) {
    case "success":
    case "partial": {
      if (result.output === null) {
        return { status: "output_lost", reasonCode, decisionRef, claimHash };
      }
      if (!decisionRef || !claimHash) {
        // A body without a provable claim binding cannot be recorded as settled.
        return { status: "in_doubt", reasonCode: "claim_binding_missing", decisionRef, claimHash };
      }
      return {
        status: "completed",
        output: result.output,
        decisionRef,
        claimHash,
        gatewayRef,
        terminalReceiptRef: last?.terminalReceipt?.receiptId ?? null,
        terminalOutputHash: last?.terminalReceipt?.outputContentHash ?? null,
        reasonCode,
      };
    }
    case "failure":
      return { status: "failed", reasonCode, decisionRef, claimHash };
    case "blocked":
    case "not_dispatched":
      return { status: "blocked", reasonCode, decisionRef, claimHash };
    case "in_doubt":
    case "unknown":
    default:
      return { status: "in_doubt", reasonCode, decisionRef, claimHash };
  }
}

export type CaioInferenceInlineDispatchHandle = {
  gatewayRef: string;
  execute: (input: {
    workspaceId: string;
    jobId: string;
    attempt: number;
    taskClass: CaioInferenceTaskClass;
    inferenceInput: CaioInferenceInput;
  }) => Promise<CaioInferenceInlineExecution>;
};

export function createCaioInferenceInlineDispatchHandle(input: {
  gateway: CaioInferenceInlineGatewayPort;
  project: CaioInferenceProjectionPort;
  sourceAssetRefs: (workspaceId: string) => Promise<readonly string[]>;
  gatewayRef: string;
  policyKey: string;
  requestedMaxOutputTokens: number;
}): CaioInferenceInlineDispatchHandle {
  return Object.freeze({
    gatewayRef: input.gatewayRef,
    execute: async ({ workspaceId, jobId, attempt, taskClass, inferenceInput }) => {
      const sourceAssetRefs = await input.sourceAssetRefs(workspaceId);
      if (sourceAssetRefs.length === 0) {
        return { status: "blocked", reasonCode: "no_authorized_source_asset", decisionRef: null, claimHash: null };
      }
      const attemptRef = `${jobId}:${attempt}`;
      let projectionReceiptRef: string;
      try {
        const projected = await input.project({
          workspaceId,
          engineKey: CAIO_INFERENCE_PROJECTION_ENGINE_KEY,
          idempotencyKey: `caio-inference-inline-projection:${attemptRef}`,
          sourceAssetRefs,
          localContext: inferenceInput,
        });
        projectionReceiptRef = projected.receipt.receiptId;
      } catch (error) {
        // Projection happens before any decision exists: nothing was authorised, nothing was charged.
        return { status: "blocked", reasonCode: describeError(error).code, decisionRef: null, claimHash: null };
      }
      let result: GovernedModelGatewayResult<GovernedJsonValue>;
      try {
        result = await input.gateway({
          workspaceId,
          gatewayRef: input.gatewayRef,
          policyKey: input.policyKey,
          requestKey: `caio-inference-inline:${attemptRef}`,
          taskClass: CAIO_INFERENCE_ROUTE_TASK_CLASS[taskClass],
          taskRef: `caio-inference-job:${jobId}`,
          projectionReceiptRef,
          projectedPayload: inferenceInput,
          requestedMaxOutputTokens: input.requestedMaxOutputTokens,
          allowFallback: false,
        });
      } catch (error) {
        return classifyCaioInferenceInlineGatewayError(error);
      }
      return classifyCaioInferenceInlineGatewayResult(result, input.gatewayRef);
    },
  });
}
