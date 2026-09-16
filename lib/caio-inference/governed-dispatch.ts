import "server-only";

import { sha256 } from "@/lib/expert-capability/hashing";
import type {
  GovernedJsonValue,
  GovernedModelAdapterResult,
} from "@/lib/llm/governed-model-adapter-registry.service";
import type { ModelRouteTaskClass } from "@/lib/llm/model-route-contracts";
import type {
  GovernedProjectionEngine,
  GovernedProjectionEngineRegistration,
} from "@/lib/llm/governed-model-projection.service";

import {
  CAIO_INFERENCE_ROUTE_TASK_CLASS,
  type CaioInferenceInput,
} from "./contracts";
import type { CaioInferenceDispatchPort } from "./job-store.service";

/**
 * Binds the inference queue to the governed deferred dispatch.
 *
 * The queue never touches the egress authority: it calls this port, and this port calls the projection
 * service and the gateway's deferred dispatch. Projection and the route decision happen at CLAIM time, not at
 * enqueue time, because both a projection receipt and a route decision expire in minutes while a job may wait
 * in the queue for an hour.
 *
 * The projected payload IS the frozen input: it already carries nothing but snapshot identity, snapshot
 * hashes, evidence refs and aggregate counts, so the projector drops nothing and redacts nothing. That is
 * declared honestly as `alias_only` with every candidate ref selected.
 */
export const CAIO_INFERENCE_PROJECTION_ENGINE_KEY = "caio-inference-window";

export type CaioInferenceProjectionRegistration = Omit<
  GovernedProjectionEngineRegistration,
  "engineKey" | "executionBoundary"
>;

export function createCaioInferenceProjectionEngine(input: {
  registration: CaioInferenceProjectionRegistration;
  maxInputTokens: number;
  maxOutputTokens: number;
}): GovernedProjectionEngine<CaioInferenceInput, CaioInferenceInput> {
  return {
    registration: {
      ...input.registration,
      engineKey: CAIO_INFERENCE_PROJECTION_ENGINE_KEY,
      // The projection runs in the tenant's own runtime; nothing about it is delegated to a provider.
      executionBoundary: "local_only",
    },
    project: async ({ localContext }) => ({
      projectedPayload: localContext,
      candidateEvidenceRefs: localContext.evidenceRefs,
      selectedEvidenceRefs: localContext.evidenceRefs,
      droppedEvidenceRefs: [],
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      remoteSafe: true,
      // Aggregates and refs only: there is no record-level text to redact, and no free text to scan.
      redactionStatus: "alias_only",
      promptInjectionScanStatus: "not_run",
    }),
  };
}

export type CaioInferenceProjectionPort = (input: {
  workspaceId: string;
  engineKey: string;
  idempotencyKey: string;
  sourceAssetRefs: readonly string[];
  localContext: CaioInferenceInput;
}) => Promise<{ receipt: { receiptId: string } }>;

export type CaioInferenceDeferredDispatchPort = {
  claim: (request: {
    workspaceId: string;
    gatewayRef: string;
    policyKey: string;
    requestKey: string;
    /**
     * 路由任务类，不是 CAIO 的任务类——两者在 `CAIO_INFERENCE_ROUTE_TASK_CLASS` 处完成映射，
     * 到这个端口时已经是路由侧的取值。
     *
     * 声明成 `string` 会让受治理网关**无法**充当这个端口：网关的 claim 只接受
     * `ModelRouteTaskClass` 联合，而一个「接受任意字符串」的端口类型比它更宽，
     * 赋值方向上不成立（逆变）。租户装配把网关直接塞进来时第一个撞上——
     * core 自己不会撞，因为 core 只按映射后的值调用它。
     */
    taskClass: ModelRouteTaskClass;
    taskRef: string;
    projectionReceiptRef: string;
    projectedPayload: CaioInferenceInput;
    requestedMaxOutputTokens: number;
  }) => Promise<
    | {
        status: "claimed";
        decisionRef: string;
        gatewayRef: string;
        claimHash: string;
        leaseExpiresAt: string;
      }
    | {
        status: "blocked" | "not_dispatched" | "in_doubt" | "success" | "failure" | "partial" | "unknown";
        attempt?: unknown;
      }
  >;
  complete: (input: {
    workspaceId: string;
    decisionRef: string;
    gatewayRef: string;
    claimHash: string;
    /**
     * 终态结果。与 `taskClass` 同一个病：声明成 `unknown` 会让受治理网关无法充当这个端口——
     * 网关的 complete 只接受 `GovernedModelAdapterResult`，而「接受任何东西」的端口更宽。
     * core 自己一直按这个形状调用它，收窄不改行为。
     */
    result: GovernedModelAdapterResult<GovernedJsonValue>;
  }) => Promise<{ status: string }>;
  expire: (input: {
    workspaceId: string;
    decisionRef: string;
    gatewayRef: string;
    claimHash: string;
  }) => Promise<{ status: string }>;
};

export function createCaioInferenceGovernedDispatch(input: {
  gatewayRef: string;
  policyKey: string;
  requestedMaxOutputTokens: number;
  pricingVersion: string;
  project: CaioInferenceProjectionPort;
  deferred: CaioInferenceDeferredDispatchPort;
  sourceAssetRefs: (workspaceId: string) => Promise<readonly string[]>;
}): CaioInferenceDispatchPort {
  return {
    claim: async ({ workspaceId, jobId, taskClass, inferenceInput, attempt }) => {
      const sourceAssetRefs = await input.sourceAssetRefs(workspaceId);
      if (sourceAssetRefs.length === 0) {
        // No authorized source asset means no governed route can admit this payload at all.
        return { status: "blocked", reasonCode: "no_authorized_source_asset" };
      }
      // Each attempt is its own request: a retry after a lease expiry never reuses the claimed decision.
      const attemptRef = `${jobId}:${attempt}`;
      const projected = await input.project({
        workspaceId,
        engineKey: CAIO_INFERENCE_PROJECTION_ENGINE_KEY,
        idempotencyKey: `caio-inference-projection:${attemptRef}`,
        sourceAssetRefs,
        localContext: inferenceInput,
      });
      const claimed = await input.deferred.claim({
        workspaceId,
        gatewayRef: input.gatewayRef,
        policyKey: input.policyKey,
        requestKey: `caio-inference:${attemptRef}`,
        taskClass: CAIO_INFERENCE_ROUTE_TASK_CLASS[taskClass],
        taskRef: `caio-inference-job:${jobId}`,
        projectionReceiptRef: projected.receipt.receiptId,
        projectedPayload: inferenceInput,
        requestedMaxOutputTokens: input.requestedMaxOutputTokens,
      });
      if (claimed.status !== "claimed") {
        return { status: "blocked", reasonCode: claimed.status };
      }
      return {
        status: "claimed",
        decisionRef: claimed.decisionRef,
        gatewayRef: claimed.gatewayRef,
        claimHash: claimed.claimHash,
        leaseExpiresAt: claimed.leaseExpiresAt,
      };
    },

    complete: async ({ workspaceId, decisionRef, gatewayRef, claimHash, layeredJudgementHash }) =>
      input.deferred.complete({
        workspaceId,
        decisionRef,
        gatewayRef,
        claimHash,
        // The worker is the provider here: it accepted the request and produced one judgement. The reference
        // is the body's content hash, never the body itself, and a local model costs nothing to call.
        result: {
          outcome: "success",
          output: { judgementHash: layeredJudgementHash },
          requestDisposition: "accepted",
          providerRequestRef: sha256(layeredJudgementHash),
          promptTokens: null,
          completionTokens: null,
          actualCostUsdMicros: 0,
          costCurrency: "USD",
          pricingVersion: input.pricingVersion,
          costBand: "zero",
          errorCode: null,
        },
      }),

    expire: async ({ workspaceId, decisionRef, gatewayRef, claimHash }) =>
      input.deferred.expire({ workspaceId, decisionRef, gatewayRef, claimHash }),
  };
}
