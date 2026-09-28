import "server-only";

import { sha256 } from "@/lib/expert-capability/hashing";
import type {
  GovernedJsonValue,
  GovernedModelAdapterResult,
} from "@/lib/llm/governed-model-adapter-registry.service";
import type { ModelRouteTaskClass } from "@/lib/llm/model-route-contracts";
import type { GovernedProjectionEngine } from "@/lib/llm/governed-model-projection.service";
import {
  computeGovernedProjectionRegistrationHash,
  type GovernedProjectionEngineRegistration,
} from "@/lib/llm/model-route-contracts";

import {
  CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
  CAIO_INFERENCE_ROUTE_TASK_CLASS,
  CAIO_INFERENCE_TASK_CLASSES,
  type CaioInferenceInput,
  type CaioInferenceProviderEvidence,
} from "./contracts";
import type { CaioInferenceDispatchPort } from "./job-store.service";
import {
  caioInferenceCostBand,
  computeCaioInferenceCostUsdMicros,
  validateCaioInferencePrice,
  type CaioInferencePrice,
} from "./pricing";

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

function engineRegistration(
  registration: CaioInferenceProjectionRegistration,
): GovernedProjectionEngineRegistration {
  return {
    ...registration,
    engineKey: CAIO_INFERENCE_PROJECTION_ENGINE_KEY,
    // The projection runs in the tenant's own runtime; nothing about it is delegated to a provider.
    executionBoundary: "local_only",
  };
}

/**
 * The projector/scanner identity a route must pin to accept this engine's receipts. Route builders use this
 * rather than the raw implementation hashes: the receipt carries registration-envelope hashes.
 */
export function caioInferenceProjectionRouteIdentity(registration: CaioInferenceProjectionRegistration) {
  const full = engineRegistration(registration);
  return Object.freeze({
    projectorRegistrationRef: full.projectorRegistrationRef,
    projectorRegistrationHash: computeGovernedProjectionRegistrationHash(full, "projector"),
    projectorVersion: full.projectorVersion,
    scannerRegistrationRef: full.scannerRegistrationRef,
    scannerRegistrationHash: computeGovernedProjectionRegistrationHash(full, "scanner"),
    scannerVersion: full.scannerVersion,
  });
}

// Closed-schema scan of the projected payload. The payload may only be the frozen inference input: known
// keys, identifiers/refs/hashes/timestamps matching strict patterns, and numeric (or null) aggregate counts.
// Anything that could carry free text fails the scan, and the egress gate then refuses the dispatch.
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/u;
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;
const HASH_RE = /^sha256:[a-f0-9]{64}$/u;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const MAX_ITEMS = 2_000;

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

export function scanCaioInferenceProjectedPayload(payload: unknown): "passed" | "failed" {
  if (
    !hasExactKeys(payload, [
      "schemaVersion", "workspaceId", "taskClass", "windowStart", "windowEnd", "snapshotRefs", "evidenceRefs", "supplements",
    ]) ||
    payload.schemaVersion !== CAIO_INFERENCE_INPUT_SCHEMA_VERSION ||
    typeof payload.workspaceId !== "string" || !REF_RE.test(payload.workspaceId) ||
    !(CAIO_INFERENCE_TASK_CLASSES as readonly unknown[]).includes(payload.taskClass) ||
    typeof payload.windowStart !== "string" || !ISO_RE.test(payload.windowStart) ||
    typeof payload.windowEnd !== "string" || !ISO_RE.test(payload.windowEnd) ||
    !Array.isArray(payload.snapshotRefs) || payload.snapshotRefs.length > MAX_ITEMS ||
    !Array.isArray(payload.evidenceRefs) || payload.evidenceRefs.length > MAX_ITEMS ||
    !Array.isArray(payload.supplements) || payload.supplements.length > MAX_ITEMS
  ) {
    return "failed";
  }
  for (const snapshot of payload.snapshotRefs) {
    if (
      !hasExactKeys(snapshot, ["snapshotId", "snapshotHash"]) ||
      typeof snapshot.snapshotId !== "string" || !REF_RE.test(snapshot.snapshotId) ||
      typeof snapshot.snapshotHash !== "string" || !HASH_RE.test(snapshot.snapshotHash)
    ) return "failed";
  }
  for (const ref of payload.evidenceRefs) {
    if (typeof ref !== "string" || !REF_RE.test(ref)) return "failed";
  }
  for (const supplement of payload.supplements) {
    if (
      !hasExactKeys(supplement, ["key", "counts"]) ||
      typeof supplement.key !== "string" || !KEY_RE.test(supplement.key) ||
      !supplement.counts || typeof supplement.counts !== "object" || Array.isArray(supplement.counts)
    ) return "failed";
    for (const [key, count] of Object.entries(supplement.counts)) {
      if (!KEY_RE.test(key) || !(count === null || (typeof count === "number" && Number.isFinite(count)))) {
        return "failed";
      }
    }
  }
  return "passed";
}

export function createCaioInferenceProjectionEngine(input: {
  registration: CaioInferenceProjectionRegistration;
  maxInputTokens: number;
  maxOutputTokens: number;
}): GovernedProjectionEngine<CaioInferenceInput, CaioInferenceInput> {
  return {
    registration: engineRegistration(input.registration),
    project: async ({ localContext }) => ({
      projectedPayload: localContext,
      candidateEvidenceRefs: localContext.evidenceRefs,
      selectedEvidenceRefs: localContext.evidenceRefs,
      droppedEvidenceRefs: [],
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      remoteSafe: true,
      // Aggregates and refs only: nothing to redact. The scan is real: the payload must be the closed
      // aggregate schema (no field that can carry free text) or it fails and egress refuses the dispatch.
      redactionStatus: "alias_only",
      promptInjectionScanStatus: scanCaioInferenceProjectedPayload(localContext),
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
  /**
   * Price for the route. Omitted means the on-premises zero price. A `per_token` price makes provider usage
   * mandatory and is the only way a non-zero cost reaches the receipt; its version must equal `pricingVersion`.
   */
  price?: CaioInferencePrice;
  project: CaioInferenceProjectionPort;
  deferred: CaioInferenceDeferredDispatchPort;
  sourceAssetRefs: (workspaceId: string) => Promise<readonly string[]>;
}): CaioInferenceDispatchPort {
  const price: CaioInferencePrice = input.price ?? { kind: "zero", pricingVersion: input.pricingVersion };
  if (price.pricingVersion !== input.pricingVersion) throw new Error("caio_inference_price_version_mismatch");
  const priceCheck = validateCaioInferencePrice(price);
  if (!priceCheck.valid) throw new Error(`caio_inference_price_invalid:${priceCheck.errors.join(",")}`);
  const perToken = price.kind === "per_token";

  // Usage and cost evidence for one terminal receipt. Zero-priced (local) routes keep recording no tokens and
  // cost 0 exactly as before: forwarding token counts there would newly subject local calls to the route's
  // input-token ceiling. Per-token routes record the reported tokens and the server-computed cost.
  const costEvidence = (evidence: CaioInferenceProviderEvidence | undefined) => {
    const usage = evidence?.usage ?? null;
    if (!perToken || usage === null) {
      return { promptTokens: null, completionTokens: null, actualCostUsdMicros: 0, costBand: "zero" as const };
    }
    const cost = computeCaioInferenceCostUsdMicros(price, usage);
    return {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
      actualCostUsdMicros: cost,
      costBand: caioInferenceCostBand(cost),
    };
  };

  return {
    requiresProviderUsage: perToken,
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

    complete: async ({ workspaceId, decisionRef, gatewayRef, claimHash, layeredJudgementHash, evidence }) =>
      input.deferred.complete({
        workspaceId,
        decisionRef,
        gatewayRef,
        claimHash,
        // The worker relays the provider's answer. The reference is a hash — of the provider's own request id
        // when a remote provider returned one, otherwise of the judgement body — never the body itself.
        result: {
          outcome: "success",
          output: { judgementHash: layeredJudgementHash },
          requestDisposition: "accepted",
          providerRequestRef: sha256(
            perToken && evidence?.providerRequestRef ? `provider:${evidence.providerRequestRef}` : layeredJudgementHash,
          ),
          ...costEvidence(evidence),
          costCurrency: "USD",
          pricingVersion: input.pricingVersion,
          errorCode: null,
        },
      }),

    expire: async ({ workspaceId, decisionRef, gatewayRef, claimHash }) =>
      input.deferred.expire({ workspaceId, decisionRef, gatewayRef, claimHash }),

    // The worker answered but the judgement was refused: a terminal failure receipt with the closed rejection
    // code, so the route's concurrency slot is released. Nothing about the refused body is recorded.
    fail: async ({ workspaceId, decisionRef, gatewayRef, claimHash, errorCode, evidence }) =>
      input.deferred.complete({
        workspaceId,
        decisionRef,
        gatewayRef,
        claimHash,
        // No `output` property at all: the gateway's explicit-failure contract rejects even `output: null`.
        result: {
          outcome: "failure",
          requestDisposition: "accepted",
          providerRequestRef: sha256(`${decisionRef}:${errorCode}`),
          // A refused remote answer was still billed: its usage and cost are recorded so the monthly cap sees it.
          ...costEvidence(evidence),
          costCurrency: "USD",
          pricingVersion: input.pricingVersion,
          errorCode,
        },
      }),
  };
}
