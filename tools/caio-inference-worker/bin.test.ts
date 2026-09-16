import { describe, expect, it, vi } from "vitest";

import type { CaioInferenceInput } from "@/lib/caio-inference/contracts";

import {
  caioInferenceWorkerExitCode,
  caioInferenceWorkerUsage,
  runCaioInferenceWorkerCli,
  WORKER_EXIT_OFFLINE,
  WORKER_EXIT_OK,
} from "./bin";
import type { CaioWorkerGatewayPort, CaioWorkerLocalModelPort } from "./contracts";

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

const ANSWER = JSON.stringify({
  schemaVersion: "helm.caio.layered-judgement.v1",
  facts: [{ statement: "Dead letters rose.", evidenceRefs: ["evidence:metric-a"] }],
  inferences: [],
  risks: [],
  unknowns: [],
  suggestions: [],
  confidence: { band: "medium", score: null },
});

function deps(input?: { ready?: boolean; claims?: number }) {
  let remaining = input?.claims ?? 1;
  const lines: string[] = [];
  const gateway: CaioWorkerGatewayPort = {
    claim: vi.fn(async () => {
      if (remaining <= 0) return null;
      remaining -= 1;
      return {
        jobId: `job-${remaining}`,
        claimToken: "claim-1",
        inputHash: `sha256:${"b".repeat(64)}`,
        leaseExpiresAt: "2026-09-16T10:10:00.000Z",
        input: INPUT,
      };
    }),
    submit: vi.fn(async () => ({ status: "completed", code: null })),
  };
  const model: CaioWorkerLocalModelPort = {
    probe: vi.fn(async () => ({ ready: input?.ready ?? true })),
    complete: vi.fn(async () => ANSWER),
  };
  return { gateway, model, lines, stdout: (text: string) => lines.push(text) };
}

describe("caio-inference-worker CLI", () => {
  it("prints usage and does nothing for an unknown command", async () => {
    const test = deps();
    await expect(runCaioInferenceWorkerCli(["rotate"], test)).resolves.toBeNull();
    expect(test.lines[0]).toBe(caioInferenceWorkerUsage());
    expect(test.model.probe).not.toHaveBeenCalled();
    expect(test.gateway.claim).not.toHaveBeenCalled();
  });

  it("probes without claiming and reports offline as its own exit code", async () => {
    const ready = deps();
    const okProbe = await runCaioInferenceWorkerCli(["probe"], ready);
    expect(okProbe).toMatchObject({ status: "ok", passes: [] });
    expect(ready.gateway.claim).not.toHaveBeenCalled();
    expect(caioInferenceWorkerExitCode(okProbe!)).toBe(WORKER_EXIT_OK);

    const offline = deps({ ready: false });
    const offlineProbe = await runCaioInferenceWorkerCli(["probe"], offline);
    expect(offlineProbe).toMatchObject({ status: "offline" });
    expect(caioInferenceWorkerExitCode(offlineProbe!)).toBe(WORKER_EXIT_OFFLINE);
    expect(offline.gateway.claim).not.toHaveBeenCalled();
  });

  it("runs exactly one pass for run-once", async () => {
    const test = deps({ claims: 5 });
    const result = await runCaioInferenceWorkerCli(["run-once"], test);
    expect(result).toMatchObject({ status: "ok" });
    expect(result!.passes).toHaveLength(1);
    expect(test.gateway.claim).toHaveBeenCalledTimes(1);
  });

  it("stops a loop as soon as the queue is empty", async () => {
    const test = deps({ claims: 2 });
    const result = await runCaioInferenceWorkerCli(["run-loop"], { ...test, loopPasses: 5 });
    expect(result!.passes.map((pass) => pass.status)).toEqual(["submitted", "submitted", "idle"]);
    expect(test.gateway.claim).toHaveBeenCalledTimes(3);
    expect(test.model.complete).toHaveBeenCalledTimes(2);
  });
});
