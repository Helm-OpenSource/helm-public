import { describe, expect, it, vi } from "vitest";

import type { GovernedJsonValue, GovernedModelGatewayResult } from "@/lib/llm/governed-model-gateway.service";

import type { CaioInferenceInput } from "./contracts";
import {
  classifyCaioInferenceInlineGatewayError,
  createCaioInferenceInlineDispatchHandle,
  type CaioInferenceInlineGatewayPort,
} from "./inline-dispatch";

const INPUT: CaioInferenceInput = {
  schemaVersion: "helm.caio.inference-input.v1",
  workspaceId: "workspace-1",
  taskClass: "hourly_diagnosis",
  windowStart: "2026-09-16T09:00:00.000Z",
  windowEnd: "2026-09-16T10:00:00.000Z",
  snapshotRefs: [{ snapshotId: "snapshot-1", snapshotHash: `sha256:${"a".repeat(64)}` }],
  evidenceRefs: ["evidence:metric-a"],
  supplements: [],
};
const OUTPUT = { schemaVersion: "helm.caio.layered-judgement.v1", facts: [] } as unknown as GovernedJsonValue;
const CLAIM_HASH = `sha256:${"c".repeat(64)}`;
const OUTPUT_HASH = `sha256:${"e".repeat(64)}`;

type Result = GovernedModelGatewayResult<GovernedJsonValue>;

function gatewayResult(input: {
  status: Result["status"];
  output?: GovernedJsonValue | null;
  reasonCode?: string | null;
  withTerminal?: boolean;
  withStarted?: boolean;
  decisionId?: string;
}): Result {
  const decisionId = input.decisionId ?? "decision-1";
  const started = input.withStarted === false ? null : { receiptId: "receipt-1", sequence: 1, dispatchClaimHash: CLAIM_HASH };
  const terminal = input.withTerminal
    ? { receiptId: "receipt-2", sequence: 2, dispatchClaimHash: CLAIM_HASH, outputContentHash: OUTPUT_HASH }
    : null;
  return {
    status: input.status,
    output: input.output ?? null,
    attempts: [
      {
        decision: { decisionId },
        startedReceipt: started,
        terminalReceipt: terminal,
        status: input.status,
        reasonCode: input.reasonCode ?? null,
        replayed: false,
      },
    ],
    selectedDecisionRef: decisionId,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    rawContentPersisted: false,
  } as unknown as Result;
}

function harness(gateway: CaioInferenceInlineGatewayPort, assets: readonly string[] = ["asset:operating-aggregates"]) {
  const project = vi.fn(async () => ({ receipt: { receiptId: "projection-1" } }));
  const handle = createCaioInferenceInlineDispatchHandle({
    gateway,
    project,
    sourceAssetRefs: async () => assets,
    gatewayRef: "gateway:caio-inference-inline",
    policyKey: "caio-pro-default",
    requestedMaxOutputTokens: 1_200,
  });
  const execute = () =>
    handle.execute({ workspaceId: "workspace-1", jobId: "job-1", attempt: 2, taskClass: "hourly_diagnosis", inferenceInput: INPUT });
  return { project, handle, execute };
}

function thrown(name: string, code: string, decisionRef: string | null = null): Error {
  const error = new Error(code) as Error & { code: string; decisionRef: string | null };
  error.name = name;
  error.code = code;
  error.decisionRef = decisionRef;
  return error;
}

describe("CAIO inline governed dispatch handle", () => {
  it("projects, calls the gateway exactly once per attempt without fallback and returns the settled body", async () => {
    const gateway = vi.fn(async () => gatewayResult({ status: "success", output: OUTPUT, withTerminal: true }));
    const { project, execute } = harness(gateway);
    await expect(execute()).resolves.toEqual({
      status: "completed",
      output: OUTPUT,
      decisionRef: "decision-1",
      claimHash: CLAIM_HASH,
      gatewayRef: "gateway:caio-inference-inline",
      terminalReceiptRef: "receipt-2",
      terminalOutputHash: OUTPUT_HASH,
      reasonCode: null,
    });
    expect(project).toHaveBeenCalledWith(expect.objectContaining({
      engineKey: "caio-inference-window",
      idempotencyKey: "caio-inference-inline-projection:job-1:2",
      sourceAssetRefs: ["asset:operating-aggregates"],
      localContext: INPUT,
    }));
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(gateway).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      gatewayRef: "gateway:caio-inference-inline",
      policyKey: "caio-pro-default",
      requestKey: "caio-inference-inline:job-1:2",
      taskClass: "reasoning_counterfactual",
      taskRef: "caio-inference-job:job-1",
      projectionReceiptRef: "projection-1",
      projectedPayload: INPUT,
      requestedMaxOutputTokens: 1_200,
      allowFallback: false,
    });
  });

  it("reports a terminal replayed without a body as output_lost, never as completed", async () => {
    const { execute } = harness(vi.fn(async () =>
      gatewayResult({ status: "success", output: null, withTerminal: true, reasonCode: "terminal_receipt_replayed_without_output" }),
    ));
    await expect(execute()).resolves.toEqual({
      status: "output_lost", reasonCode: "terminal_receipt_replayed_without_output", decisionRef: "decision-1", claimHash: CLAIM_HASH,
    });
  });

  it("maps blocked, not dispatched, failure, in_doubt and unknown outcomes to the closed statuses", async () => {
    const cases: Array<[Result["status"], string, string | null]> = [
      ["blocked", "blocked", "no_active_model_route_policy"],
      ["not_dispatched", "blocked", "adapter_not_registered"],
      ["failure", "failed", "provider_rejected"],
      ["in_doubt", "in_doubt", "adapter_outcome_unknown_after_timeout"],
      ["unknown", "in_doubt", null],
    ];
    for (const [status, expected, reasonCode] of cases) {
      const { execute } = harness(vi.fn(async () => gatewayResult({ status, reasonCode, withTerminal: status === "failure" })));
      await expect(execute()).resolves.toMatchObject({ status: expected, reasonCode, decisionRef: "decision-1" });
    }
  });

  it("refuses to call completed a body whose claim binding is missing", async () => {
    const { execute } = harness(vi.fn(async () => gatewayResult({ status: "success", output: OUTPUT, withStarted: false })));
    await expect(execute()).resolves.toMatchObject({ status: "in_doubt", reasonCode: "claim_binding_missing" });
  });

  it("classifies thrown gateway errors by whether a claim could exist", () => {
    expect(classifyCaioInferenceInlineGatewayError(
      thrown("GovernedModelGatewayError", "terminal_receipt_persistence_failed_output_withheld", "decision-9"),
    )).toEqual({ status: "in_doubt", reasonCode: "terminal_receipt_persistence_failed_output_withheld", decisionRef: "decision-9", claimHash: null });
    expect(classifyCaioInferenceInlineGatewayError(thrown("GovernedModelGatewayError", "spend_invariant_breach_output_withheld", "decision-9")))
      .toMatchObject({ status: "in_doubt" });
    expect(classifyCaioInferenceInlineGatewayError(thrown("GovernedModelGatewayError", "projection_receipt_not_found")))
      .toMatchObject({ status: "blocked", reasonCode: "projection_receipt_not_found" });
    expect(classifyCaioInferenceInlineGatewayError(thrown("ModelEgressStoreError", "spend_reservation_budget_exceeded")))
      .toMatchObject({ status: "blocked", reasonCode: "spend_reservation_budget_exceeded" });
    expect(classifyCaioInferenceInlineGatewayError(thrown("GovernedModelProjectionError", "projection_engine_not_registered")))
      .toMatchObject({ status: "blocked" });
    // Anything unforeseen (connection loss, a crashed retry helper) is a possible charge: fail closed.
    expect(classifyCaioInferenceInlineGatewayError(new Error("socket hang up"))).toMatchObject({ status: "in_doubt", reasonCode: "socket hang up" });
    expect(classifyCaioInferenceInlineGatewayError(thrown("GovernedModelGatewayError", "some_future_code")))
      .toMatchObject({ status: "in_doubt", reasonCode: "some_future_code" });
    expect(classifyCaioInferenceInlineGatewayError(null)).toMatchObject({ status: "in_doubt" });
  });

  it("returns the thrown classification from execute and never retries", async () => {
    const gateway = vi.fn(async () => {
      throw thrown("GovernedModelGatewayError", "terminal_receipt_persistence_failed_output_withheld", "decision-1");
    });
    const { execute } = harness(gateway);
    await expect(execute()).resolves.toMatchObject({ status: "in_doubt", decisionRef: "decision-1" });
    expect(gateway).toHaveBeenCalledTimes(1);
  });

  it("blocks before any network when no source asset is authorised or the projection refuses", async () => {
    const gateway = vi.fn(async () => gatewayResult({ status: "success", output: OUTPUT }));
    const none = harness(gateway, []);
    await expect(none.execute()).resolves.toEqual({ status: "blocked", reasonCode: "no_authorized_source_asset", decisionRef: null, claimHash: null });
    expect(none.project).not.toHaveBeenCalled();

    const refused = harness(gateway);
    refused.project.mockRejectedValueOnce(thrown("GovernedModelProjectionError", "projection_scan_failed"));
    await expect(refused.execute()).resolves.toEqual({ status: "blocked", reasonCode: "projection_scan_failed", decisionRef: null, claimHash: null });
    expect(gateway).not.toHaveBeenCalled();
  });
});
