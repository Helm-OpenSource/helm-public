import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * In-process governed execution primitives on an isolated MySQL database. The governed gateway is NOT part of
 * this suite: it proves the queue's own guarantees for inline rows (one reservation wins, compare-and-swap on
 * the reservation tuple, reconciliation never requeues a doubtful or in-flight inline row, a lost thread
 * leaves `in_doubt` evidence instead of a resend) and nothing about egress governance.
 *
 *   CAIO_INFERENCE_DATABASE_URL=<disposable helm_caio_inference_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-inference/job-store.inline.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";

import { type CaioInferenceInput } from "./contracts";
import {
  enqueueCaioInferenceJob,
  finalizeCaioInferenceInlineJudgement,
  markCaioInferenceInlineInDoubt,
  reclaimCaioInferenceJobs,
  rejectCaioInferenceInlineJob,
  reserveCaioInferenceJobForInline,
  type CaioInferenceDispatchPort,
  type CaioInferenceInlineReservation,
} from "./job-store.service";

const integrationDatabaseUrl = process.env.CAIO_INFERENCE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `n${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);
const BASE = new Date("2026-09-16T03:00:00.000Z");
const at = (offsetMs: number) => new Date(BASE.getTime() + offsetMs);
const LEASE_MS = 120_000;
const GATEWAY_REF = "gateway:caio-inference-inline";
const BINDING = { decisionRef: "decision-inline", gatewayRef: GATEWAY_REF, claimHash: `sha256:${"c".repeat(64)}` };

function judgement(evidenceRef: string, statement = "Dead letters rose in the window.") {
  return {
    schemaVersion: "helm.caio.layered-judgement.v1",
    facts: [{ statement, evidenceRefs: [evidenceRef] }],
    inferences: [],
    risks: [],
    unknowns: [],
    suggestions: [],
    confidence: { band: "medium", score: null },
  };
}

function dispatchPort(): CaioInferenceDispatchPort {
  return {
    claim: vi.fn(async () => ({ status: "blocked" as const })),
    complete: vi.fn(async () => ({ status: "success" as const })),
    expire: vi.fn(async () => ({ status: "failure" as const })),
    fail: vi.fn(async () => ({ status: "failure" as const })),
  };
}

describeMysql("CAIO inline inference reservation with an isolated MySQL database", () => {
  let workspaceId = "";
  let sequence = 0;

  async function newWorkspace(): Promise<void> {
    sequence += 1;
    workspaceId = (
      await db.workspace.create({
        data: { name: `CAIO inline ${suffix} ${sequence}`, slug: `caio-inline-${suffix}-${sequence}` },
      })
    ).id;
  }

  async function enqueue(): Promise<string> {
    const payload: CaioInferenceInput = {
      schemaVersion: "helm.caio.inference-input.v1",
      workspaceId,
      taskClass: "hourly_diagnosis",
      windowStart: at(-3_600_000).toISOString(),
      windowEnd: BASE.toISOString(),
      snapshotRefs: [{ snapshotId: `snapshot-${suffix}`, snapshotHash: `sha256:${"a".repeat(64)}` }],
      evidenceRefs: ["evidence:metric-a"],
      supplements: [],
    };
    const result = await enqueueCaioInferenceJob({
      workspaceId,
      taskClass: payload.taskClass,
      windowStart: new Date(payload.windowStart),
      windowEnd: new Date(payload.windowEnd),
      input: payload,
      now: BASE,
    });
    return result.jobId;
  }

  async function reserve(now: Date): Promise<CaioInferenceInlineReservation> {
    const reserved = await reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now, preparationLeaseMs: LEASE_MS });
    if (reserved.status !== "reserved") throw new Error(`reservation expected, got ${reserved.status}`);
    return reserved;
  }

  async function row(jobId: string) {
    return db.caioInferenceJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  beforeAll(async () => {
    const databaseName = new URL(integrationDatabaseUrl!).pathname.replace(/^\//u, "");
    if (process.env.DATABASE_URL !== integrationDatabaseUrl || !databaseName.startsWith("helm_caio_inference_")) {
      throw new Error("Refusing inline reservation integration test: use a disposable helm_caio_inference_* database as DATABASE_URL.");
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("hands one queued job to exactly one of two concurrent executors and marks the row as inline", async () => {
    await newWorkspace();
    const jobId = await enqueue();
    const [left, right] = await Promise.all([
      reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(1_000) }),
      reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(1_000) }),
    ]);
    expect([left, right].filter((result) => result.status === "reserved")).toHaveLength(1);
    expect([left, right].filter((result) => result.status === "none")).toHaveLength(1);
    const stored = await row(jobId);
    expect(stored).toMatchObject({ status: "claimed", attempt: 1, gatewayRef: GATEWAY_REF, decisionRef: null, dispatchClaimHash: null });
    expect(stored.leaseExpiresAt?.getTime()).toBe(at(1_000).getTime() + LEASE_MS);
    await expect(reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(2_000) })).resolves.toEqual({ status: "none" });
  });

  it("finalizes a settled judgement once, replays the identical body and refuses a different one", async () => {
    await newWorkspace();
    await enqueue();
    const reserved = await reserve(at(10_000));
    const finalize = (output: unknown, now: Date) =>
      finalizeCaioInferenceInlineJudgement({ ...reserved, ...BINDING, output, now });

    const first = await finalize(judgement("evidence:metric-a"), at(20_000));
    expect(first).toMatchObject({ status: "completed" });
    const stored = await row(reserved.jobId);
    expect(stored).toMatchObject({
      status: "completed", rejectionCode: null, decisionRef: BINDING.decisionRef, gatewayRef: GATEWAY_REF,
      dispatchClaimHash: BINDING.claimHash, claimToken: reserved.claimToken, attempt: 1,
    });
    expect(JSON.parse(stored.judgementPacketJson!)).toMatchObject({ commitmentClass: "advice", humanReviewerRequired: true });

    await expect(finalize(judgement("evidence:metric-a"), at(21_000))).resolves.toMatchObject({ status: "replayed" });
    await expect(finalize(judgement("evidence:metric-a", "Another statement."), at(22_000)))
      .resolves.toEqual({ status: "rejected", code: "output_hash_mismatch" });
    expect((await row(reserved.jobId)).layeredJudgementHash).toBe(stored.layeredJudgementHash);
  });

  it("refuses a body that fails validation or does not match the terminal digest, binding the decision but not the body", async () => {
    await newWorkspace();
    await enqueue();
    const outside = await reserve(at(30_000));
    await expect(
      finalizeCaioInferenceInlineJudgement({ ...outside, ...BINDING, output: judgement("evidence:invented"), now: at(31_000) }),
    ).resolves.toEqual({ status: "rejected", code: "evidence_outside_input" });
    expect(await row(outside.jobId)).toMatchObject({
      status: "rejected", rejectionCode: "evidence_outside_input", decisionRef: BINDING.decisionRef, layeredJudgementJson: null, claimToken: null,
    });

    await newWorkspace();
    await enqueue();
    const digest = await reserve(at(32_000));
    await expect(
      finalizeCaioInferenceInlineJudgement({
        ...digest, ...BINDING, output: judgement("evidence:metric-a"), terminalOutputHash: `sha256:${"e".repeat(64)}`, now: at(33_000),
      }),
    ).resolves.toEqual({ status: "rejected", code: "output_hash_mismatch" });
    expect((await row(digest.jobId)).status).toBe("rejected");
  });

  it("never lets a superseded or foreign reservation tuple write", async () => {
    await newWorkspace();
    await enqueue();
    const reserved = await reserve(at(40_000));
    const output = judgement("evidence:metric-a");
    await expect(finalizeCaioInferenceInlineJudgement({ ...reserved, ...BINDING, claimToken: "other-token", output, now: at(41_000) }))
      .resolves.toEqual({ status: "stale" });
    await expect(finalizeCaioInferenceInlineJudgement({ ...reserved, ...BINDING, attempt: reserved.attempt + 1, output, now: at(41_000) }))
      .resolves.toEqual({ status: "stale" });
    await expect(markCaioInferenceInlineInDoubt({ ...reserved, claimToken: "other-token", now: at(41_000) })).resolves.toBe("stale");
    expect(await row(reserved.jobId)).toMatchObject({ status: "claimed", rejectionCode: null, layeredJudgementJson: null });

    // Once the reservation reached a terminal state, the original tuple is spent too.
    await expect(rejectCaioInferenceInlineJob({ ...reserved, ...BINDING, code: "provider_failure", now: at(42_000) })).resolves.toBe("rejected");
    await expect(markCaioInferenceInlineInDoubt({ ...reserved, now: at(43_000) })).resolves.toBe("stale");
    await expect(finalizeCaioInferenceInlineJudgement({ ...reserved, ...BINDING, output, now: at(44_000) })).resolves.toEqual({ status: "stale" });
    expect(await row(reserved.jobId)).toMatchObject({ status: "rejected", rejectionCode: "provider_failure" });
  });

  it("marks an in-flight inline row doubtful on lease expiry instead of requeuing it, and its own thread can still finalize", async () => {
    const port = dispatchPort();
    await newWorkspace();
    await enqueue();
    const reserved = await reserve(at(50_000));

    const reclaimed = await reclaimCaioInferenceJobs({ workspaceId, dispatch: port, now: at(50_000 + LEASE_MS + 1_000), maxAttempts: 1 });
    expect(reclaimed).toEqual({ requeued: 0, deadLettered: 0, expired: 0, inDoubt: 1 });
    expect(port.expire).not.toHaveBeenCalled();
    expect(await row(reserved.jobId)).toMatchObject({
      status: "claimed", rejectionCode: "in_doubt", attempt: 1, claimToken: reserved.claimToken, gatewayRef: GATEWAY_REF,
    });
    // A later executor tick finds nothing to run: the doubtful row is not queued and no new attempt starts.
    await expect(reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(60_000 + LEASE_MS) })).resolves.toEqual({ status: "none" });

    // The thread that owned the reservation returns late with the gateway's settled body: same tuple, so it lands.
    await expect(
      finalizeCaioInferenceInlineJudgement({ ...reserved, ...BINDING, output: judgement("evidence:metric-a"), now: at(70_000 + LEASE_MS) }),
    ).resolves.toMatchObject({ status: "completed" });
    expect(await row(reserved.jobId)).toMatchObject({ status: "completed", rejectionCode: null });
    const again = await reclaimCaioInferenceJobs({ workspaceId, dispatch: port, now: at(80_000 + 2 * LEASE_MS), maxAttempts: 1 });
    expect(again).toEqual({ requeued: 0, deadLettered: 0, expired: 0, inDoubt: 0 });
  });

  it("keeps a doubtful row out of reconciliation across passes: no requeue, no dead letter, no attempt bump", async () => {
    const port = dispatchPort();
    await newWorkspace();
    await enqueue();
    const reserved = await reserve(at(90_000));
    await expect(markCaioInferenceInlineInDoubt({ ...reserved, ...BINDING, now: at(91_000) })).resolves.toBe("marked");
    expect(await row(reserved.jobId)).toMatchObject({ status: "claimed", rejectionCode: "in_doubt", decisionRef: BINDING.decisionRef });

    for (const offset of [LEASE_MS + 1_000, 10 * LEASE_MS, 100 * LEASE_MS]) {
      const outcome = await reclaimCaioInferenceJobs({ workspaceId, dispatch: port, now: at(90_000 + offset), maxAttempts: 1 });
      expect(outcome).toEqual({ requeued: 0, deadLettered: 0, expired: 0, inDoubt: 1 });
    }
    expect(port.expire).not.toHaveBeenCalled();
    expect(await row(reserved.jobId)).toMatchObject({ status: "claimed", rejectionCode: "in_doubt", attempt: 1, claimToken: reserved.claimToken });
    await expect(reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(90_000 + 101 * LEASE_MS) })).resolves.toEqual({ status: "none" });
  });

  it("does not resend after a crash between the gateway terminal and finalize: a restarted executor finds no work", async () => {
    const port = dispatchPort();
    const gateway = vi.fn(async () => ({ status: "success" as const }));
    await newWorkspace();
    await enqueue();

    // Tick 1: reserve, call the gateway once, then the process dies before finalize.
    const reserved = await reserve(at(100_000));
    await gateway();
    expect(gateway).toHaveBeenCalledTimes(1);

    // Restart: reconciliation runs first, then the executor's reserve. Neither starts a new attempt.
    const reclaimed = await reclaimCaioInferenceJobs({ workspaceId, dispatch: port, now: at(100_000 + LEASE_MS + 5_000), maxAttempts: 3 });
    expect(reclaimed).toMatchObject({ requeued: 0, deadLettered: 0, inDoubt: 1 });
    const next = await reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(100_000 + LEASE_MS + 6_000) });
    expect(next).toEqual({ status: "none" });
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(await row(reserved.jobId)).toMatchObject({ status: "claimed", rejectionCode: "in_doubt", attempt: 1 });
  });

  it("still reconciles worker-path rows the old way (requeue then dead letter)", async () => {
    const port = dispatchPort();
    await newWorkspace();
    const jobId = await enqueue();
    // A worker row: claimed with a decision bound, lease expired. The inline marker is absent.
    await db.caioInferenceJob.update({
      where: { id: jobId },
      data: {
        status: "claimed", claimToken: "worker-token", claimedAt: at(0), leaseExpiresAt: at(1_000), attempt: 1,
        decisionRef: "decision-worker", gatewayRef: "gateway:caio-inference", dispatchClaimHash: `sha256:${"d".repeat(64)}`,
      },
    });
    const outcome = await reclaimCaioInferenceJobs({ workspaceId, dispatch: port, now: at(2_000), maxAttempts: 3 });
    expect(outcome).toEqual({ requeued: 1, deadLettered: 0, expired: 0, inDoubt: 0 });
    expect(port.expire).toHaveBeenCalledTimes(1);
    expect(await row(jobId)).toMatchObject({ status: "queued", claimToken: null, decisionRef: null, gatewayRef: null });
  });

  it("rejects a reservation whose persisted input no longer matches its frozen hash without touching another row", async () => {
    await newWorkspace();
    const jobId = await enqueue();
    await db.caioInferenceJob.update({ where: { id: jobId }, data: { inputJson: "{\"schemaVersion\":\"tampered\"}" } });
    await expect(reserveCaioInferenceJobForInline({ workspaceId, gatewayRef: GATEWAY_REF, now: at(110_000) }))
      .resolves.toEqual({ status: "rejected", jobId, code: "input_hash_mismatch" });
    expect(await row(jobId)).toMatchObject({ status: "rejected", rejectionCode: "input_hash_mismatch", claimToken: null });
  });
});
