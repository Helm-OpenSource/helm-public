import { describe, expect, it, vi } from "vitest";

import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  GovernedModelProjectionError,
  createGovernedModelProjectionService,
} from "@/lib/llm/governed-model-projection.service";

const IMPLEMENTATION_HASH = `sha256:${"a".repeat(64)}`;

function engine() {
  return {
    registration: {
      engineKey: "synthetic-local-v1",
      projectorRegistrationRef:
        "projector:synthetic-local-v1",
      projectorKey: "synthetic-projector",
      projectorVersion: "v1",
      projectorImplementationHash: IMPLEMENTATION_HASH,
      scannerRegistrationRef: "scanner:synthetic-local-v1",
      scannerKey: "synthetic-scanner",
      scannerVersion: "v1",
      scannerImplementationHash: IMPLEMENTATION_HASH,
      executionBoundary: "local_only" as const,
    },
    project: vi.fn(async () => ({
      projectedPayload: {
        question: "Synthetic question",
        facts: ["Synthetic fact"],
      },
      candidateEvidenceRefs: [
        "evidence:synthetic-a",
        "evidence:synthetic-b",
      ],
      selectedEvidenceRefs: ["evidence:synthetic-a"],
      droppedEvidenceRefs: ["evidence:synthetic-b"],
      maxInputTokens: 2_000,
      maxOutputTokens: 500,
      remoteSafe: true,
      redactionStatus: "synthetic" as const,
      promptInjectionScanStatus: "passed" as const,
    })),
  };
}

describe("governed model projection service", () => {
  it("computes the persisted hash and byte count from the exact returned payload", async () => {
    const selectedEngine = engine();
    const recordReceipt = vi.fn(async (input) => ({
      receipt: {
        receiptId: "projection:synthetic",
        projectedPayloadHash: input.projectedPayloadHash,
      },
      replayed: false,
    }));
    const project = createGovernedModelProjectionService(
      [selectedEngine],
      {
        recordReceipt:
          recordReceipt as never,
        now: () => new Date("2026-07-23T12:00:00.000Z"),
      },
    );

    const result = await project({
      workspaceId: "workspace-test",
      engineKey: "synthetic-local-v1",
      idempotencyKey: "projection-synthetic-1",
      sourceAssetRefs: ["asset:synthetic"],
      localContext: { secret: "local-only" },
    });

    const serialized = canonicalJson(result.projectedPayload);
    expect(recordReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        projectedPayloadHash: sha256(serialized),
        projectedPayloadBytes: Buffer.byteLength(
          serialized,
          "utf8",
        ),
      }),
    );
    expect(JSON.stringify(recordReceipt.mock.calls[0]![0])).not.toContain(
      "local-only",
    );
  });

  it("fails before persistence when the engine returns an incomplete evidence partition", async () => {
    const selectedEngine = engine();
    selectedEngine.project.mockResolvedValueOnce({
      projectedPayload: { question: "Synthetic question", facts: [] },
      candidateEvidenceRefs: ["evidence:synthetic-a"],
      selectedEvidenceRefs: [],
      droppedEvidenceRefs: [],
      maxInputTokens: 2_000,
      maxOutputTokens: 500,
      remoteSafe: true,
      redactionStatus: "synthetic",
      promptInjectionScanStatus: "passed",
    });
    const recordReceipt = vi.fn();
    const project = createGovernedModelProjectionService(
      [selectedEngine],
      {
        recordReceipt: recordReceipt as never,
        now: () => new Date(),
      },
    );

    await expect(
      project({
        workspaceId: "workspace-test",
        engineKey: "synthetic-local-v1",
        idempotencyKey: "projection-synthetic-invalid",
        sourceAssetRefs: ["asset:synthetic"],
        localContext: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GovernedModelProjectionError>>({
        code: "projection_evidence_partition_invalid",
      }),
    );
    expect(recordReceipt).not.toHaveBeenCalled();
  });

  it("has an empty-registry fail-closed default", async () => {
    const project = createGovernedModelProjectionService([]);
    await expect(
      project({
        workspaceId: "workspace-test",
        engineKey: "missing",
        idempotencyKey: "projection-missing",
        sourceAssetRefs: ["asset:synthetic"],
        localContext: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GovernedModelProjectionError>>({
        code: "projection_engine_not_registered",
      }),
    );
  });
});
