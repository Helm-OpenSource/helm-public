import { describe, expect, it, vi } from "vitest";

import { sha256 } from "@/lib/expert-capability/hashing";

import type { CaioInferenceInput } from "./contracts";
import {
  CAIO_INFERENCE_PROJECTION_ENGINE_KEY,
  createCaioInferenceGovernedDispatch,
  createCaioInferenceProjectionEngine,
  type CaioInferenceDeferredDispatchPort,
} from "./governed-dispatch";

const INPUT: CaioInferenceInput = {
  schemaVersion: "helm.caio.inference-input.v1",
  workspaceId: "workspace-1",
  taskClass: "hourly_diagnosis",
  windowStart: "2026-09-16T09:00:00.000Z",
  windowEnd: "2026-09-16T10:00:00.000Z",
  snapshotRefs: [{ snapshotId: "snapshot-1", snapshotHash: `sha256:${"a".repeat(64)}` }],
  evidenceRefs: ["evidence:metric-a", "evidence:metric-b"],
  supplements: [{ key: "cases.lifecycle-summary", counts: { caseCount: 12, stale: null } }],
};

function harness(input?: { assets?: readonly string[]; claimStatus?: "claimed" | "blocked" }) {
  const project = vi.fn(async () => ({ receipt: { receiptId: "projection-1" } }));
  const deferred: CaioInferenceDeferredDispatchPort = {
    claim: vi.fn(async () =>
      (input?.claimStatus ?? "claimed") === "claimed"
        ? {
            status: "claimed" as const,
            decisionRef: "decision-1",
            gatewayRef: "gateway:caio-inference",
            claimHash: `sha256:${"c".repeat(64)}`,
            leaseExpiresAt: "2026-09-16T10:10:00.000Z",
          }
        : { status: "blocked" as const },
    ),
    complete: vi.fn(async () => ({ status: "success" })),
    expire: vi.fn(async () => ({ status: "failure" })),
  };
  const port = createCaioInferenceGovernedDispatch({
    gatewayRef: "gateway:caio-inference",
    policyKey: "caio-pro-default",
    requestedMaxOutputTokens: 1_200,
    pricingVersion: "local-pricing-202609",
    project,
    deferred,
    sourceAssetRefs: async () => input?.assets ?? ["asset:operating-aggregates"],
  });
  return { project, deferred, port };
}

const claimArgs = {
  workspaceId: "workspace-1",
  jobId: "job-1",
  taskClass: "hourly_diagnosis" as const,
  routeTaskClass: "reasoning_counterfactual" as const,
  inferenceInput: INPUT,
  attempt: 2,
  now: new Date("2026-09-16T10:05:00.000Z"),
};

describe("CAIO inference projection engine", () => {
  it("projects the frozen input unchanged and declares that nothing was dropped", async () => {
    const engine = createCaioInferenceProjectionEngine({
      registration: {
        projectorRegistrationRef: "projector:caio-inference",
        projectorKey: "caio-inference-window",
        projectorVersion: "v1",
        projectorImplementationHash: `sha256:${"1".repeat(64)}`,
        scannerRegistrationRef: "scanner:caio-inference",
        scannerKey: "caio-inference-noop",
        scannerVersion: "v1",
        scannerImplementationHash: `sha256:${"2".repeat(64)}`,
      },
      maxInputTokens: 4_000,
      maxOutputTokens: 1_200,
    });

    expect(engine.registration.engineKey).toBe(CAIO_INFERENCE_PROJECTION_ENGINE_KEY);
    expect(engine.registration.executionBoundary).toBe("local_only");
    const projected = await engine.project({
      workspaceId: "workspace-1",
      sourceAssetRefs: ["asset:operating-aggregates"],
      localContext: INPUT,
    });
    expect(projected.projectedPayload).toBe(INPUT);
    // The evidence partition is exact: everything the input carried is selected, nothing is dropped.
    expect(projected.selectedEvidenceRefs).toEqual(INPUT.evidenceRefs);
    expect(projected.droppedEvidenceRefs).toEqual([]);
    expect(projected.candidateEvidenceRefs).toEqual(INPUT.evidenceRefs);
    expect(projected).toMatchObject({ remoteSafe: true, redactionStatus: "alias_only", promptInjectionScanStatus: "not_run" });
  });
});

describe("CAIO inference governed dispatch", () => {
  it("projects and claims per attempt, so a retry never reuses a claimed decision", async () => {
    const test = harness();
    const claimed = await test.port.claim(claimArgs);

    expect(claimed).toEqual({
      status: "claimed",
      decisionRef: "decision-1",
      gatewayRef: "gateway:caio-inference",
      claimHash: `sha256:${"c".repeat(64)}`,
      leaseExpiresAt: "2026-09-16T10:10:00.000Z",
    });
    expect(vi.mocked(test.project).mock.calls[0]![0]).toMatchObject({
      engineKey: CAIO_INFERENCE_PROJECTION_ENGINE_KEY,
      idempotencyKey: "caio-inference-projection:job-1:2",
      sourceAssetRefs: ["asset:operating-aggregates"],
    });
    expect(vi.mocked(test.deferred.claim).mock.calls[0]![0]).toMatchObject({
      requestKey: "caio-inference:job-1:2",
      taskClass: "reasoning_counterfactual",
      taskRef: "caio-inference-job:job-1",
      projectionReceiptRef: "projection-1",
      requestedMaxOutputTokens: 1_200,
    });

    const second = await test.port.claim({ ...claimArgs, attempt: 3 });
    expect(second.status).toBe("claimed");
    expect(vi.mocked(test.deferred.claim).mock.calls[1]![0].requestKey).toBe("caio-inference:job-1:3");
  });

  it("refuses to project when no authorized source asset backs the payload", async () => {
    const test = harness({ assets: [] });
    await expect(test.port.claim(claimArgs)).resolves.toEqual({
      status: "blocked",
      reasonCode: "no_authorized_source_asset",
    });
    expect(test.project).not.toHaveBeenCalled();
    expect(test.deferred.claim).not.toHaveBeenCalled();
  });

  it("passes a refused claim back as blocked with the gateway's own status", async () => {
    const test = harness({ claimStatus: "blocked" });
    await expect(test.port.claim(claimArgs)).resolves.toEqual({ status: "blocked", reasonCode: "blocked" });
  });

  it("completes with a zero-cost accepted result that names only the judgement hash", async () => {
    const test = harness();
    const judgementHash = `sha256:${"d".repeat(64)}`;
    await test.port.complete({
      workspaceId: "workspace-1",
      decisionRef: "decision-1",
      gatewayRef: "gateway:caio-inference",
      claimHash: `sha256:${"c".repeat(64)}`,
      layeredJudgementHash: judgementHash,
      now: new Date(),
    });

    const result = vi.mocked(test.deferred.complete).mock.calls[0]![0].result as Record<string, unknown>;
    expect(result).toMatchObject({
      outcome: "success",
      requestDisposition: "accepted",
      providerRequestRef: sha256(judgementHash),
      actualCostUsdMicros: 0,
      costCurrency: "USD",
      pricingVersion: "local-pricing-202609",
      costBand: "zero",
      errorCode: null,
    });
    // The judgement body never reaches the egress receipt path; only its hash does.
    expect(JSON.stringify(result)).not.toContain("statement");
  });

  it("forwards lease expiry to the governed reconciliation unchanged", async () => {
    const test = harness();
    await test.port.expire({
      workspaceId: "workspace-1",
      decisionRef: "decision-1",
      gatewayRef: "gateway:caio-inference",
      claimHash: `sha256:${"c".repeat(64)}`,
      now: new Date(),
    });
    expect(test.deferred.expire).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      decisionRef: "decision-1",
      gatewayRef: "gateway:caio-inference",
      claimHash: `sha256:${"c".repeat(64)}`,
    });
  });
});
