import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The review loop on an isolated MySQL database: a window freezes into a job, a claimed job reports the
 * worker as working, a queued window nobody pulls reports it as offline, and every judgement layer reaches
 * the OWNER readout.
 *
 *   CAIO_INFERENCE_DATABASE_URL=<disposable helm_caio_inference_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-inference/review-loop.mysql.test.ts --config vitest.public.config.ts
 */

import { WorkspaceRole } from "@prisma/client";

import { db } from "@/lib/db";

import { buildCaioInferenceInput } from "./input-builder";
import { claimCaioInferenceJob, type CaioInferenceDispatchPort } from "./job-store.service";
import { CAIO_INFERENCE_OFFLINE_AFTER_MS, getCaioInferenceReviewReadout } from "./readout";
import { caioReviewWindow, createCaioInferenceEnqueueJob } from "./review-jobs";

const integrationDatabaseUrl = process.env.CAIO_INFERENCE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `r${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);
const RUN_AT = new Date("2026-09-16T10:37:00.000Z");
const { windowStart, windowEnd } = caioReviewWindow("hourly_diagnosis", RUN_AT);

function dispatchPort(): CaioInferenceDispatchPort {
  return {
    claim: vi.fn(async ({ jobId, now }: { jobId: string; now: Date }) => ({
      status: "claimed" as const,
      decisionRef: `decision-${jobId}`,
      gatewayRef: "gateway:caio-inference",
      claimHash: `sha256:${"c".repeat(64)}`,
      leaseExpiresAt: new Date(now.getTime() + 600_000).toISOString(),
    })),
    complete: vi.fn(async () => ({ status: "success" as const })),
    expire: vi.fn(async () => ({ status: "failure" as const })),
    fail: vi.fn(async () => ({ status: "failure" as const })),
  };
}

describeMysql("CAIO review loop with an isolated MySQL database", () => {
  let workspaceId = "";
  let tickId = "";

  async function seedSnapshot(createdAt: Date, evidenceRefs: readonly string[]): Promise<void> {
    const snapshot = {
      schemaVersion: "helm.temporal-operating-context-snapshot.v1",
      signalEvents: [{ eventId: "event-1", evidenceRefs: [...evidenceRefs] }],
      objects: [{ aliasRef: "alias-1", evidenceRefs: [evidenceRefs[0]] }],
    };
    await db.caioOperatingContextSnapshot.create({
      data: {
        workspaceId,
        tickId,
        status: "PROJECTED",
        snapshotId: `snapshot-${suffix}`,
        snapshotHash: `sha256:${"a".repeat(64)}`,
        objectCount: 1,
        signalCount: 1,
        snapshotJson: JSON.stringify(snapshot),
        createdAt,
      },
    });
  }

  beforeAll(async () => {
    const databaseName = new URL(integrationDatabaseUrl!).pathname.replace(/^\//u, "");
    if (process.env.DATABASE_URL !== integrationDatabaseUrl || !databaseName.startsWith("helm_caio_inference_")) {
      throw new Error("Refusing review loop integration test: use a disposable helm_caio_inference_* database as DATABASE_URL.");
    }
    workspaceId = (await db.workspace.create({ data: { name: `CAIO review ${suffix}`, slug: `caio-review-${suffix}` } })).id;
    tickId = (
      await db.caioQuickCheckTick.create({
        data: { workspaceId, bucketStart: windowStart, status: "COMPLETED", startedAt: windowStart },
      })
    ).id;
    await seedSnapshot(new Date(windowStart.getTime() + 60_000), ["evidence:metric-a", "evidence:metric-b"]);
    // A snapshot outside the window must not leak into the frozen input.
    await db.caioOperatingContextSnapshot.create({
      data: {
        workspaceId,
        tickId: (
          await db.caioQuickCheckTick.create({
            data: { workspaceId, bucketStart: new Date(windowEnd.getTime() + 60_000), status: "COMPLETED", startedAt: windowEnd },
          })
        ).id,
        status: "PROJECTED",
        snapshotHash: `sha256:${"d".repeat(64)}`,
        objectCount: 1,
        signalCount: 1,
        snapshotJson: JSON.stringify({ signalEvents: [{ evidenceRefs: ["evidence:outside-window"] }] }),
        createdAt: new Date(windowEnd.getTime() + 120_000),
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("freezes only the window's projected snapshots and their evidence", async () => {
    const built = await buildCaioInferenceInput({
      workspaceId,
      taskClass: "hourly_diagnosis",
      windowStart,
      windowEnd,
      supplements: async () => [{ key: "cases.lifecycle-summary", counts: { caseCount: 12, stale: Number.NaN } }],
    });
    expect(built).not.toBeNull();
    expect(built!.snapshotRefs).toHaveLength(1);
    expect(built!.evidenceRefs).toEqual(["evidence:metric-a", "evidence:metric-b"]);
    // An unreadable supplement count stays unknown instead of becoming zero.
    expect(built!.supplements).toEqual([
      { key: "cases.lifecycle-summary", counts: { caseCount: 12, stale: null } },
    ]);
  });

  it("skips a window with no projected snapshot instead of asking an empty question", async () => {
    const emptyWindow = caioReviewWindow("hourly_diagnosis", new Date(RUN_AT.getTime() - 7_200_000));
    await expect(
      buildCaioInferenceInput({
        workspaceId,
        taskClass: "hourly_diagnosis",
        windowStart: emptyWindow.windowStart,
        windowEnd: emptyWindow.windowEnd,
      }),
    ).resolves.toBeNull();

    const job = createCaioInferenceEnqueueJob({
      key: `tenant.caio.review.empty.${suffix}`,
      tenantKey: "tenant",
      extensionKey: "tenant-caio",
      taskClass: "hourly_diagnosis",
      resolveWorkspaceIds: async () => [workspaceId],
    });
    const targets = await job.resolveTargets();
    await expect(
      job.runTarget(targets[0]!, {
        jobKey: job.key, targetKey: targets[0]!.key, traceId: "trace-empty",
        requestedAt: new Date(RUN_AT.getTime() - 7_200_000), windowDate: "2026-09-16", source: "test",
      }),
    ).resolves.toMatchObject({ status: "skipped", message: "no_projected_snapshot" });
    expect(await db.caioInferenceJob.count({ where: { workspaceId } })).toBe(0);
  });

  it("enqueues one job per window through the scheduler job and repeats as already_enqueued", async () => {
    const job = createCaioInferenceEnqueueJob({
      key: `tenant.caio.review.hourly.${suffix}`,
      tenantKey: "tenant",
      extensionKey: "tenant-caio",
      taskClass: "hourly_diagnosis",
      resolveWorkspaceIds: async () => [workspaceId],
    });
    const targets = await job.resolveTargets();
    const context = {
      jobKey: job.key, targetKey: targets[0]!.key, traceId: "trace-1",
      requestedAt: RUN_AT, windowDate: "2026-09-16", source: "test" as const,
    };

    const first = await job.runTarget(targets[0]!, context);
    expect(first).toMatchObject({ status: "success", message: "enqueued", signalCount: 1 });
    const second = await job.runTarget(targets[0]!, context);
    expect(second).toMatchObject({ status: "skipped", message: "already_enqueued" });
    expect(await db.caioInferenceJob.count({ where: { workspaceId } })).toBe(1);
  });

  it("reports the worker as working while a claim is live and as offline when nobody pulls", async () => {
    const readBeforeClaim = await getCaioInferenceReviewReadout({
      workspaceId, membershipRole: WorkspaceRole.OWNER, now: RUN_AT,
    });
    expect(readBeforeClaim).toMatchObject({ available: true, workerState: "idle", latestJudgement: null });

    const offline = await getCaioInferenceReviewReadout({
      workspaceId,
      membershipRole: WorkspaceRole.OWNER,
      now: new Date(RUN_AT.getTime() + CAIO_INFERENCE_OFFLINE_AFTER_MS + 60_000),
    });
    expect(offline).toMatchObject({ available: true, workerState: "offline" });

    const claimed = await claimCaioInferenceJob({ workspaceId, dispatch: dispatchPort(), now: RUN_AT });
    expect(claimed.status).toBe("claimed");
    const working = await getCaioInferenceReviewReadout({
      workspaceId, membershipRole: WorkspaceRole.OWNER, now: RUN_AT,
    });
    expect(working).toMatchObject({ available: true, workerState: "working" });
    expect(await getCaioInferenceReviewReadout({ workspaceId, membershipRole: WorkspaceRole.MEMBER })).toBeNull();
  });

  it("projects every judgement layer and the closed rejection code onto the readout", async () => {
    const layered = {
      schemaVersion: "helm.caio.layered-judgement.v1",
      facts: [{ statement: "Dead letters rose in the window.", evidenceRefs: ["evidence:metric-a"] }],
      inferences: [{ statement: "The consumer is likely stalled.", evidenceRefs: ["evidence:metric-a"] }],
      risks: [{ statement: "Follow-ups may be missed.", severity: "medium", evidenceRefs: ["evidence:metric-b"] }],
      unknowns: [{ statement: "Whether the provider callback is delayed." }],
      suggestions: [{ kind: "dry_run_request", summary: "Dry-run a restart rule.", evidenceRefs: ["evidence:metric-a"] }],
      confidence: { band: "medium", score: null },
    };
    await db.caioInferenceJob.updateMany({
      where: { workspaceId },
      data: {
        status: "completed",
        completedAt: RUN_AT,
        layeredJudgementJson: JSON.stringify(layered),
        layeredJudgementHash: `sha256:${"e".repeat(64)}`,
        rejectionCode: null,
      },
    });

    const readout = await getCaioInferenceReviewReadout({
      workspaceId, membershipRole: WorkspaceRole.OWNER, now: RUN_AT,
    });
    expect(readout).toMatchObject({ available: true, workerState: "idle" });
    if (!readout?.available) return;
    expect(readout.latestJudgement).toMatchObject({
      confidenceBand: "medium",
      facts: ["Dead letters rose in the window."],
      inferences: ["The consumer is likely stalled."],
      risks: [{ statement: "Follow-ups may be missed.", severity: "medium" }],
      unknowns: ["Whether the provider callback is delayed."],
      suggestions: [{ kind: "dry_run_request", summary: "Dry-run a restart rule." }],
    });

    await db.caioInferenceJob.updateMany({
      where: { workspaceId },
      data: { status: "rejected", rejectionCode: "evidence_outside_input" },
    });
    const rejected = await getCaioInferenceReviewReadout({
      workspaceId, membershipRole: WorkspaceRole.OWNER, now: RUN_AT,
    });
    if (!rejected?.available) return;
    expect(rejected.jobs[0]).toMatchObject({ status: "rejected", rejectionCode: "evidence_outside_input" });
  });
});
