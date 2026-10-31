import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  reserveCaioInferenceJobForInline: vi.fn(),
  finalizeCaioInferenceInlineJudgement: vi.fn(),
  markCaioInferenceInlineInDoubt: vi.fn(),
  rejectCaioInferenceInlineJob: vi.fn(),
}));
vi.mock("./job-store.service", () => store);

import type { CaioInferenceInput } from "./contracts";
import type { CaioInferenceInlineDispatchHandle, CaioInferenceInlineExecution } from "./inline-dispatch";
import {
  CAIO_INLINE_EXECUTE_DEFAULT_CRON,
  caioReviewWorkingHours,
  createCaioInferenceInlineExecuteJob,
  isWithinCaioReviewWorkingWindow,
} from "./inline-execute-job";
import { CAIO_HOURLY_REVIEW_ENABLED_ENV } from "./review-jobs";

const workspaceId = "workspace-1";
const ENABLED = { [CAIO_HOURLY_REVIEW_ENABLED_ENV]: "true" };
// 10:00 Asia/Shanghai is 02:00Z; 22:00 Asia/Shanghai is 14:00Z.
const IN_WINDOW = new Date("2026-09-16T02:00:00.000Z");
const OUT_OF_WINDOW = new Date("2026-09-16T14:00:00.000Z");
const INPUT: CaioInferenceInput = {
  schemaVersion: "helm.caio.inference-input.v1",
  workspaceId,
  taskClass: "hourly_diagnosis",
  windowStart: "2026-09-16T01:00:00.000Z",
  windowEnd: "2026-09-16T02:00:00.000Z",
  snapshotRefs: [],
  evidenceRefs: ["evidence:metric-a"],
  supplements: [],
};
const RESERVATION = {
  status: "reserved" as const,
  workspaceId,
  jobId: "job-1",
  claimToken: "token-1",
  attempt: 1,
  taskClass: "hourly_diagnosis" as const,
  inputHash: `sha256:${"a".repeat(64)}`,
  input: INPUT,
  leaseExpiresAt: new Date(IN_WINDOW.getTime() + 120_000),
};
const KEY = { workspaceId, jobId: "job-1", claimToken: "token-1", attempt: 1 };
const COMPLETED: CaioInferenceInlineExecution = {
  status: "completed",
  output: { schemaVersion: "helm.caio.layered-judgement.v1" },
  decisionRef: "decision-1",
  claimHash: `sha256:${"c".repeat(64)}`,
  gatewayRef: "gateway:caio-inference-inline",
  terminalReceiptRef: "receipt-2",
  terminalOutputHash: `sha256:${"e".repeat(64)}`,
  reasonCode: null,
};

function harness(input: {
  execution?: CaioInferenceInlineExecution | (() => Promise<CaioInferenceInlineExecution>);
  stopped?: boolean;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  maxJobsPerTick?: number;
}) {
  const execute = vi.fn(typeof input.execution === "function" ? input.execution : async () => input.execution ?? COMPLETED);
  const handle: CaioInferenceInlineDispatchHandle = { gatewayRef: "gateway:caio-inference-inline", execute };
  const isStopped = vi.fn(async () => input.stopped ?? false);
  const job = createCaioInferenceInlineExecuteJob({
    key: "caio-inline-execute",
    tenantKey: "synthetic",
    extensionKey: "synthetic-extension",
    resolveWorkspaceIds: async () => [workspaceId],
    dispatchHandle: handle,
    guards: { isStopped },
    env: input.env ?? ENABLED,
    now: () => input.now ?? IN_WINDOW,
    ...(input.maxJobsPerTick === undefined ? {} : { maxJobsPerTick: input.maxJobsPerTick }),
  });
  const run = () =>
    job.runTarget(
      { key: `workspace:${workspaceId}`, workspaceId },
      { jobKey: job.key, targetKey: `workspace:${workspaceId}`, traceId: "trace", requestedAt: input.now ?? IN_WINDOW, windowDate: "2026-09-16", source: "test" },
    );
  return { job, execute, isStopped, run };
}

describe("CAIO inline execute job", () => {
  beforeEach(() => {
    for (const fn of Object.values(store)) fn.mockReset();
    store.reserveCaioInferenceJobForInline.mockResolvedValueOnce(RESERVATION).mockResolvedValue({ status: "none" });
    store.finalizeCaioInferenceInlineJudgement.mockResolvedValue({ status: "completed", judgementHash: `sha256:${"e".repeat(64)}` });
    store.markCaioInferenceInlineInDoubt.mockResolvedValue("marked");
    store.rejectCaioInferenceInlineJob.mockResolvedValue("rejected");
  });

  it("reads the working window from the review cron in the review timezone", () => {
    expect(caioReviewWorkingHours("hourly_diagnosis")).toEqual({ fromHour: 8, toHour: 20 });
    expect(isWithinCaioReviewWorkingWindow(IN_WINDOW)).toBe(true);
    expect(isWithinCaioReviewWorkingWindow(OUT_OF_WINDOW)).toBe(false);
    // 07:59 and 20:59 Shanghai: the window is the cron's inclusive hour range.
    expect(isWithinCaioReviewWorkingWindow(new Date("2026-09-15T23:59:00.000Z"))).toBe(false);
    expect(isWithinCaioReviewWorkingWindow(new Date("2026-09-16T12:59:00.000Z"))).toBe(true);
    expect(CAIO_INLINE_EXECUTE_DEFAULT_CRON).toBe("*/5 * * * *");
  });

  it("is enabled only by the exact hourly switch and does nothing when it is off", async () => {
    const off = harness({ env: { [CAIO_HOURLY_REVIEW_ENABLED_ENV]: "TRUE" } });
    expect(off.job.enabled()).toBe(false);
    await expect(off.run()).resolves.toEqual({ status: "skipped", message: "task_class_disabled" });
    expect(store.reserveCaioInferenceJobForInline).not.toHaveBeenCalled();
    expect(harness({}).job.enabled()).toBe(true);
  });

  it("neither reserves nor consumes the backlog outside the working window", async () => {
    const { run, execute } = harness({ now: OUT_OF_WINDOW });
    await expect(run()).resolves.toEqual({ status: "skipped", message: "outside_working_window" });
    expect(store.reserveCaioInferenceJobForInline).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("stops before reserving when the guard reports a stop", async () => {
    const { run, execute, isStopped } = harness({ stopped: true });
    await expect(run()).resolves.toMatchObject({ status: "skipped", message: "guardian_stop" });
    expect(isStopped).toHaveBeenCalledWith(workspaceId);
    expect(store.reserveCaioInferenceJobForInline).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("reserves, executes once and finalizes on the reservation tuple with the terminal digest", async () => {
    const { run, execute } = harness({});
    await expect(run()).resolves.toMatchObject({ status: "success", signalCount: 1, failureCount: 0, details: { completed: 1, reservations: 1 } });
    expect(store.reserveCaioInferenceJobForInline).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId, gatewayRef: "gateway:caio-inference-inline", taskClass: "hourly_diagnosis", now: IN_WINDOW,
    }));
    expect(execute).toHaveBeenCalledWith({ workspaceId, jobId: "job-1", attempt: 1, taskClass: "hourly_diagnosis", inferenceInput: INPUT });
    expect(store.finalizeCaioInferenceInlineJudgement).toHaveBeenCalledWith(expect.objectContaining({
      ...KEY,
      inputHash: RESERVATION.inputHash,
      output: COMPLETED.output,
      decisionRef: "decision-1",
      gatewayRef: "gateway:caio-inference-inline",
      claimHash: COMPLETED.claimHash,
      terminalOutputHash: COMPLETED.terminalOutputHash,
    }));
    expect(store.markCaioInferenceInlineInDoubt).not.toHaveBeenCalled();
    expect(store.rejectCaioInferenceInlineJob).not.toHaveBeenCalled();
  });

  it("counts a replayed finalize as idempotent success and a validation refusal as rejected", async () => {
    store.finalizeCaioInferenceInlineJudgement.mockResolvedValueOnce({ status: "replayed", judgementHash: "sha256:x" });
    await expect(harness({}).run()).resolves.toMatchObject({ status: "success", signalCount: 1, details: { replayed: 1 } });

    store.reserveCaioInferenceJobForInline.mockReset();
    store.reserveCaioInferenceJobForInline.mockResolvedValueOnce(RESERVATION).mockResolvedValue({ status: "none" });
    store.finalizeCaioInferenceInlineJudgement.mockResolvedValueOnce({ status: "rejected", code: "evidence_outside_input" });
    await expect(harness({}).run()).resolves.toMatchObject({ status: "success", signalCount: 0, failureCount: 1, details: { rejected: 1 } });
    expect(store.rejectCaioInferenceInlineJob).not.toHaveBeenCalled();
  });

  it("writes nothing more when the reservation tuple went stale under its feet", async () => {
    store.finalizeCaioInferenceInlineJudgement.mockResolvedValueOnce({ status: "stale" });
    await expect(harness({}).run()).resolves.toMatchObject({ status: "success", details: { stale: 1, completed: 0 } });
    expect(store.markCaioInferenceInlineInDoubt).not.toHaveBeenCalled();
    expect(store.rejectCaioInferenceInlineJob).not.toHaveBeenCalled();
  });

  it("marks in_doubt, rejects blocked and failed with their closed codes, and records output_lost", async () => {
    const binding = { decisionRef: "decision-1", claimHash: `sha256:${"c".repeat(64)}` };
    const cases: Array<{ execution: CaioInferenceInlineExecution; expectCode?: string; expectInDoubt?: boolean; status: string }> = [
      { execution: { status: "in_doubt", reasonCode: "adapter_outcome_unknown", ...binding }, expectInDoubt: true, status: "failed" },
      { execution: { status: "blocked", reasonCode: "no_active_model_route_policy", decisionRef: "decision-1", claimHash: null }, expectCode: "dispatch_claim_denied", status: "success" },
      { execution: { status: "failed", reasonCode: "provider_rejected", ...binding }, expectCode: "provider_failure", status: "success" },
      { execution: { status: "output_lost", reasonCode: "terminal_receipt_replayed_without_output", ...binding }, expectCode: "output_lost", status: "success" },
    ];
    for (const testCase of cases) {
      store.reserveCaioInferenceJobForInline.mockReset();
      store.reserveCaioInferenceJobForInline.mockResolvedValueOnce(RESERVATION).mockResolvedValue({ status: "none" });
      store.markCaioInferenceInlineInDoubt.mockClear();
      store.rejectCaioInferenceInlineJob.mockClear();
      const result = await harness({ execution: testCase.execution }).run();
      expect(result).toMatchObject({ status: testCase.status, failureCount: 1 });
      if (testCase.expectInDoubt) {
        expect(store.markCaioInferenceInlineInDoubt).toHaveBeenCalledWith(expect.objectContaining({ ...KEY, decisionRef: "decision-1" }));
        expect(store.rejectCaioInferenceInlineJob).not.toHaveBeenCalled();
      } else {
        expect(store.rejectCaioInferenceInlineJob).toHaveBeenCalledWith(expect.objectContaining({ ...KEY, code: testCase.expectCode }));
        expect(store.markCaioInferenceInlineInDoubt).not.toHaveBeenCalled();
      }
      expect(store.finalizeCaioInferenceInlineJudgement).not.toHaveBeenCalled();
    }
  });

  it("takes at most maxJobsPerTick reservations and reports an empty queue as skipped", async () => {
    store.reserveCaioInferenceJobForInline.mockReset();
    store.reserveCaioInferenceJobForInline.mockResolvedValue(RESERVATION);
    const { run, execute } = harness({ maxJobsPerTick: 2 });
    await expect(run()).resolves.toMatchObject({ status: "success", details: { completed: 2, reservations: 2 } });
    expect(execute).toHaveBeenCalledTimes(2);

    store.reserveCaioInferenceJobForInline.mockReset();
    store.reserveCaioInferenceJobForInline.mockResolvedValue({ status: "none" });
    await expect(harness({}).run()).resolves.toMatchObject({ status: "skipped", message: "no_queued_job" });
  });
});
