import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Pull inference job queue on an isolated MySQL database. The governed deferred dispatch is injected as a
 * port: this suite proves the queue's own guarantees (one claim wins, lease binding, closed-set rejection,
 * reconciliation and dead lettering), not the egress governance the gateway already owns.
 *
 *   CAIO_INFERENCE_DATABASE_URL=<disposable helm_caio_inference_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-inference/job-store.service.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";

import { computeCaioInferenceInputHash, type CaioInferenceInput } from "./contracts";
import {
  claimCaioInferenceJob,
  enqueueCaioInferenceJob,
  reclaimCaioInferenceJobs,
  submitCaioInferenceJudgement,
  type CaioInferenceDispatchPort,
} from "./job-store.service";

const integrationDatabaseUrl = process.env.CAIO_INFERENCE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `i${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);
const BASE = new Date("2026-09-16T03:00:00.000Z");
const at = (offsetMs: number) => new Date(BASE.getTime() + offsetMs);
const LEASE_MS = 600_000;

function judgement(evidenceRef: string) {
  return {
    schemaVersion: "helm.caio.layered-judgement.v1",
    facts: [{ statement: "Dead letters rose in the window.", evidenceRefs: [evidenceRef] }],
    inferences: [],
    risks: [],
    unknowns: [],
    suggestions: [],
    confidence: { band: "medium", score: null },
  };
}

function dispatchPort(overrides: Partial<CaioInferenceDispatchPort> = {}): CaioInferenceDispatchPort {
  return {
    claim: vi.fn(async ({ jobId, now }: { jobId: string; now: Date }) => ({
      status: "claimed" as const,
      decisionRef: `decision-${jobId}`,
      gatewayRef: "gateway:caio-inference",
      claimHash: `sha256:${"c".repeat(64)}`,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS).toISOString(),
    })),
    complete: vi.fn(async () => ({ status: "success" as const })),
    expire: vi.fn(async () => ({ status: "failure" as const })),
    ...overrides,
  };
}

describeMysql("CAIO inference job queue with an isolated MySQL database", () => {
  let workspaceId = "";
  let sequence = 0;

  async function newWorkspace(): Promise<string> {
    sequence += 1;
    const created = await db.workspace.create({
      data: { name: `CAIO inference ${suffix} ${sequence}`, slug: `caio-inference-${suffix}-${sequence}` },
    });
    workspaceId = created.id;
    return created.id;
  }

  function input(overrides: Partial<CaioInferenceInput> = {}): CaioInferenceInput {
    return {
      schemaVersion: "helm.caio.inference-input.v1",
      workspaceId,
      taskClass: "hourly_diagnosis",
      windowStart: at(-3_600_000).toISOString(),
      windowEnd: BASE.toISOString(),
      snapshotRefs: [{ snapshotId: `snapshot-${suffix}`, snapshotHash: `sha256:${"a".repeat(64)}` }],
      evidenceRefs: ["evidence:metric-a"],
      supplements: [],
      ...overrides,
    };
  }

  async function enqueue(overrides: Partial<CaioInferenceInput> = {}) {
    const payload = input(overrides);
    return {
      payload,
      result: await enqueueCaioInferenceJob({
        workspaceId,
        taskClass: payload.taskClass,
        windowStart: new Date(payload.windowStart),
        windowEnd: new Date(payload.windowEnd),
        input: payload,
        now: BASE,
      }),
    };
  }

  beforeAll(async () => {
    const databaseName = new URL(integrationDatabaseUrl!).pathname.replace(/^\//u, "");
    if (process.env.DATABASE_URL !== integrationDatabaseUrl || !databaseName.startsWith("helm_caio_inference_")) {
      throw new Error("Refusing inference queue integration test: use a disposable helm_caio_inference_* database as DATABASE_URL.");
    }
    await newWorkspace();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("enqueues one job per window and freezes the input hash", async () => {
    const first = await enqueue();
    expect(first.result).toMatchObject({ status: "enqueued" });
    const again = await enqueue();
    expect(again.result).toEqual({ status: "already_enqueued", jobId: first.result.jobId });

    const row = await db.caioInferenceJob.findUniqueOrThrow({ where: { id: first.result.jobId } });
    expect(row).toMatchObject({ status: "queued", attempt: 0, inputHash: computeCaioInferenceInputHash(first.payload) });
    expect(row.claimToken).toBeNull();
  });

  it("hands one queued job to exactly one concurrent worker and binds the lease", async () => {
    const port = dispatchPort();
    await newWorkspace();
    await enqueue();
    const [left, right] = await Promise.all([
      claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(1_000) }),
      claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(1_000) }),
    ]);
    const claimed = [left, right].filter((result) => result.status === "claimed");
    expect(claimed).toHaveLength(1);
    expect([left, right].filter((result) => result.status === "none")).toHaveLength(1);
    expect(port.claim).toHaveBeenCalledTimes(1);

    const claimResult = claimed[0]!;
    if (claimResult.status !== "claimed") return;
    const row = await db.caioInferenceJob.findUniqueOrThrow({ where: { id: claimResult.jobId } });
    expect(row).toMatchObject({ status: "claimed", attempt: 1, decisionRef: `decision-${claimResult.jobId}` });
    expect(row.claimToken).toBe(claimResult.claimToken);
    expect(claimResult.input).toMatchObject({ workspaceId, taskClass: "hourly_diagnosis" });

    // A second pass finds nothing left to claim and never touches the dispatch again.
    await expect(claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(2_000) })).resolves.toEqual({ status: "none" });
    expect(port.claim).toHaveBeenCalledTimes(1);
  });

  it("completes a submission through the dispatch and stores the packet beside the private body", async () => {
    const port = dispatchPort();
    await newWorkspace();
    await enqueue();
    const claimed = await claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(10_000) });
    if (claimed.status !== "claimed") throw new Error("claim expected");

    const submitted = await submitCaioInferenceJudgement({
      workspaceId,
      jobId: claimed.jobId,
      claimToken: claimed.claimToken,
      inputHash: claimed.inputHash,
      output: judgement("evidence:metric-a"),
      dispatch: port,
      now: at(20_000),
    });
    expect(submitted).toMatchObject({ status: "completed" });
    expect(port.complete).toHaveBeenCalledTimes(1);

    const row = await db.caioInferenceJob.findUniqueOrThrow({ where: { id: claimed.jobId } });
    expect(row).toMatchObject({ status: "completed", rejectionCode: null });
    expect(row.layeredJudgementHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.parse(row.judgementPacketJson!)).toMatchObject({
      commitmentClass: "advice",
      humanReviewerRequired: true,
      disposition: "caio.layered-judgement.v1",
      evidenceRefs: ["evidence:metric-a"],
    });

    const replay = await submitCaioInferenceJudgement({
      workspaceId,
      jobId: claimed.jobId,
      claimToken: claimed.claimToken,
      inputHash: claimed.inputHash,
      output: judgement("evidence:metric-a"),
      dispatch: port,
      now: at(21_000),
    });
    expect(replay).toMatchObject({ status: "replayed" });
    expect(port.complete).toHaveBeenCalledTimes(1);
  });

  // A rejected submission must still END its governed dispatch (terminal failure via expire). Leaving the
  // claim open kept the route's concurrency slot forever: the egress gate counts claimed dispatches without
  // a terminal receipt, so one malformed model output blocked every later claim on that route.
  it("rejects a submission with a closed code, closes the dispatch as a failure and never completes it", async () => {
    const port = dispatchPort();
    await newWorkspace();
    const cases = [
      { label: "evidence_outside_input", output: judgement("evidence:invented"), code: "evidence_outside_input" },
      { label: "malformed_output", output: { schemaVersion: "helm.caio.layered-judgement.v1" }, code: "malformed_output" },
    ] as const;
    for (const [index, testCase] of cases.entries()) {
      await enqueue({ windowStart: at(-7_200_000 - index * 3_600_000).toISOString(), windowEnd: at(-3_600_000 - index * 3_600_000).toISOString() });
      const claimed = await claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(30_000 + index) });
      if (claimed.status !== "claimed") throw new Error("claim expected");
      const rejected = await submitCaioInferenceJudgement({
        workspaceId,
        jobId: claimed.jobId,
        claimToken: claimed.claimToken,
        inputHash: claimed.inputHash,
        output: testCase.output,
        dispatch: port,
        now: at(31_000 + index),
      });
      expect(rejected).toEqual({ status: "rejected", code: testCase.code });
      const row = await db.caioInferenceJob.findUniqueOrThrow({ where: { id: claimed.jobId } });
      expect(row).toMatchObject({ status: "rejected", rejectionCode: testCase.code });
      expect(port.expire).toHaveBeenLastCalledWith(expect.objectContaining({ workspaceId }));
    }
    expect(port.expire).toHaveBeenCalledTimes(cases.length);
    expect(port.complete).not.toHaveBeenCalled();
  });

  it("refuses a submission whose claim token or frozen input does not match", async () => {
    const port = dispatchPort();
    await newWorkspace();
    await enqueue();
    const claimed = await claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(40_000) });
    if (claimed.status !== "claimed") throw new Error("claim expected");

    await expect(
      submitCaioInferenceJudgement({
        workspaceId, jobId: claimed.jobId, claimToken: "wrong-token", inputHash: claimed.inputHash,
        output: judgement("evidence:metric-a"), dispatch: port, now: at(41_000),
      }),
    ).resolves.toEqual({ status: "rejected", code: "claim_token_mismatch" });
    await expect(
      submitCaioInferenceJudgement({
        workspaceId, jobId: claimed.jobId, claimToken: claimed.claimToken, inputHash: `sha256:${"f".repeat(64)}`,
        output: judgement("evidence:metric-a"), dispatch: port, now: at(42_000),
      }),
    ).resolves.toEqual({ status: "rejected", code: "input_hash_mismatch" });
    await expect(
      submitCaioInferenceJudgement({
        workspaceId, jobId: claimed.jobId, claimToken: claimed.claimToken, inputHash: claimed.inputHash,
        output: judgement("evidence:metric-a"), dispatch: port, now: at(40_000 + LEASE_MS + 1),
      }),
    ).resolves.toEqual({ status: "rejected", code: "lease_expired" });
    expect(port.complete).not.toHaveBeenCalled();

    // The row stays claimed until reconciliation; a rejected token never releases someone else's lease.
    const row = await db.caioInferenceJob.findUniqueOrThrow({ where: { id: claimed.jobId } });
    expect(row.status).toBe("claimed");
  });

  it("reconciles an expired lease, requeues within the attempt limit and dead letters after it", async () => {
    const port = dispatchPort();
    const reclaimAt = at(40_000 + LEASE_MS + 60_000);
    const first = await reclaimCaioInferenceJobs({ workspaceId, dispatch: port, now: reclaimAt, maxAttempts: 2 });
    expect(first).toMatchObject({ requeued: 1, deadLettered: 0 });
    expect(port.expire).toHaveBeenCalledTimes(1);

    const reclaimed = await claimCaioInferenceJob({ workspaceId, dispatch: port, now: new Date(reclaimAt.getTime() + 1_000) });
    if (reclaimed.status !== "claimed") throw new Error("claim expected");
    expect((await db.caioInferenceJob.findUniqueOrThrow({ where: { id: reclaimed.jobId } })).attempt).toBe(2);

    const second = await reclaimCaioInferenceJobs({
      workspaceId,
      dispatch: port,
      now: new Date(reclaimAt.getTime() + LEASE_MS + 120_000),
      maxAttempts: 2,
    });
    expect(second).toMatchObject({ requeued: 0, deadLettered: 1 });
    expect((await db.caioInferenceJob.findUniqueOrThrow({ where: { id: reclaimed.jobId } })).status).toBe("dead_letter");
  });

  it("expires a queued job whose window is too old to be worth inferring", async () => {
    await newWorkspace();
    const { result } = await enqueue({
      windowStart: at(-172_800_000).toISOString(),
      windowEnd: at(-169_200_000).toISOString(),
    });
    const outcome = await reclaimCaioInferenceJobs({ workspaceId, dispatch: dispatchPort(), now: at(200_000), maxAttempts: 2 });
    expect(outcome.expired).toBeGreaterThanOrEqual(1);
    expect((await db.caioInferenceJob.findUniqueOrThrow({ where: { id: result.jobId } })).status).toBe("expired");
  });

  it("marks the job rejected when the governed dispatch refuses the claim", async () => {
    const port = dispatchPort({
      claim: vi.fn(async () => ({ status: "blocked" as const, reasonCode: "no_active_model_route_policy" })),
    });
    await newWorkspace();
    const { result } = await enqueue({ windowStart: at(-1_800_000).toISOString(), windowEnd: at(-900_000).toISOString() });
    const claimed = await claimCaioInferenceJob({ workspaceId, dispatch: port, now: at(50_000) });
    expect(claimed).toEqual({ status: "rejected", jobId: result.jobId, code: "dispatch_claim_denied" });
    const row = await db.caioInferenceJob.findUniqueOrThrow({ where: { id: result.jobId } });
    expect(row).toMatchObject({ status: "rejected", rejectionCode: "dispatch_claim_denied" });
  });
});
