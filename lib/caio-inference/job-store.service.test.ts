import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { caioInferenceJob: state } }));

import { computeCaioInferenceInputHash, type CaioInferenceInput } from "./contracts";
import { validateCaioLayeredJudgement } from "./layered-judgement";
import { submitCaioInferenceJudgement, type CaioInferenceDispatchPort } from "./job-store.service";

const workspaceId = "synthetic-workspace";
const jobId = "synthetic-job";
const claimToken = "synthetic-claim";
const evidenceRef = "evidence:synthetic-metric";
const now = new Date("2026-09-16T12:00:00.000Z");

const frozenInput: CaioInferenceInput = {
  schemaVersion: "helm.caio.inference-input.v1",
  workspaceId,
  taskClass: "hourly_diagnosis",
  windowStart: "2026-09-16T09:00:00.000Z",
  windowEnd: "2026-09-16T10:00:00.000Z",
  snapshotRefs: [{ snapshotId: "synthetic-snapshot", snapshotHash: `sha256:${"a".repeat(64)}` }],
  evidenceRefs: [evidenceRef],
  supplements: [],
};
const inputHash = computeCaioInferenceInputHash(frozenInput);

function output(statement = "Synthetic count rose.", ref = evidenceRef) {
  return {
    schemaVersion: "helm.caio.layered-judgement.v1",
    facts: [{ statement, evidenceRefs: [ref] }],
    inferences: [], risks: [], unknowns: [], suggestions: [],
    confidence: { band: "medium", score: null },
  };
}

const originalOutput = output();
const verified = validateCaioLayeredJudgement(originalOutput, new Set(frozenInput.evidenceRefs));
if (!verified.ok) throw new Error("synthetic output fixture invalid");

function completedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: jobId, workspaceId, status: "completed", claimToken, inputHash,
    inputJson: JSON.stringify(frozenInput), layeredJudgementHash: verified.contentHash,
    leaseExpiresAt: new Date("2026-09-16T10:10:00.000Z"),
    ...overrides,
  };
}

const dispatch: CaioInferenceDispatchPort = {
  claim: vi.fn(), complete: vi.fn(), expire: vi.fn(), fail: vi.fn(),
};

async function replay(overrides: Record<string, unknown> = {}) {
  return submitCaioInferenceJudgement({
    workspaceId, jobId, claimToken, inputHash, output: originalOutput, dispatch, now,
    ...overrides,
  });
}

describe("completed CAIO inference submission replay", () => {
  beforeEach(() => {
    state.findFirst.mockReset();
    state.update.mockReset();
    vi.mocked(dispatch.complete).mockClear();
    state.findFirst.mockImplementation(async ({ where }) =>
      where.id === jobId && where.workspaceId === workspaceId ? completedRow() : null,
    );
  });

  it("replays the original valid content after the old lease without dispatch or writes", async () => {
    await expect(replay()).resolves.toEqual({ status: "replayed", judgementHash: verified.contentHash });
    expect(state.update).not.toHaveBeenCalled();
    expect(dispatch.complete).not.toHaveBeenCalled();
  });

  it("rejects a different claim token", async () => {
    await expect(replay({ claimToken: "other-claim" })).resolves.toEqual({ status: "rejected", code: "claim_token_mismatch" });
  });

  it("rejects a different frozen input hash", async () => {
    await expect(replay({ inputHash: `sha256:${"b".repeat(64)}` })).resolves.toEqual({ status: "rejected", code: "input_hash_mismatch" });
  });

  it("rejects a changed but valid output body", async () => {
    await expect(replay({ output: output("Different synthetic count.") })).resolves.toEqual({ status: "rejected", code: "output_hash_mismatch" });
  });

  it("rejects output that cites evidence outside the frozen input", async () => {
    await expect(replay({ output: output("Synthetic count rose.", "evidence:other") }))
      .resolves.toEqual({ status: "rejected", code: "evidence_outside_input" });
  });

  it("rejects a missing terminal content hash rather than returning an empty replay", async () => {
    state.findFirst.mockResolvedValue(completedRow({ layeredJudgementHash: null }));
    await expect(replay()).resolves.toEqual({ status: "rejected", code: "output_hash_mismatch" });
  });

  it("rejects a damaged terminal content hash", async () => {
    state.findFirst.mockResolvedValue(completedRow({ layeredJudgementHash: `sha256:${"f".repeat(64)}` }));
    await expect(replay()).resolves.toEqual({ status: "rejected", code: "output_hash_mismatch" });
  });

  it("rejects a persisted input body that no longer matches its frozen hash", async () => {
    state.findFirst.mockResolvedValue(completedRow({ inputJson: JSON.stringify({ ...frozenInput, evidenceRefs: ["evidence:other"] }) }));
    await expect(replay()).resolves.toEqual({ status: "rejected", code: "input_hash_mismatch" });
  });

  it("does not read another workspace's completed job", async () => {
    await expect(replay({ workspaceId: "synthetic-other-workspace" }))
      .resolves.toEqual({ status: "rejected", code: "claim_token_mismatch" });
    expect(state.findFirst).toHaveBeenCalledWith({ where: { id: jobId, workspaceId: "synthetic-other-workspace" } });
  });
});
