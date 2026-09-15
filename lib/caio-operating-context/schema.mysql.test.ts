import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Schema guarantees for the CAIO operating-context runtime tables on an isolated MySQL database.
 *
 *   CAIO_OPERATING_CONTEXT_DATABASE_URL=<disposable helm_caio_operating_context_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-operating-context/schema.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";

import { assertDisposableCaioOperatingContextDatabase } from "./mysql-test-guard";

const integrationDatabaseUrl = process.env.CAIO_OPERATING_CONTEXT_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

describeMysql("CAIO operating-context runtime tables", () => {
  let workspaceId = "";

  beforeAll(async () => {
    assertDisposableCaioOperatingContextDatabase(integrationDatabaseUrl);
    workspaceId = (await db.workspace.create({ data: { name: `CAIO context ${suffix}`, slug: `caio-context-${suffix}` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("claims each workspace bucket exactly once", async () => {
    const bucketStart = new Date("2026-09-16T02:00:00Z");
    await db.caioQuickCheckTick.create({ data: { workspaceId, bucketStart } });
    await expect(db.caioQuickCheckTick.create({ data: { workspaceId, bucketStart } })).rejects.toSatisfy(isUniqueViolation);
  });

  it("allows one open candidate per merge key and any number of cleared ones", async () => {
    const tick = await db.caioQuickCheckTick.create({ data: { workspaceId, bucketStart: new Date("2026-09-16T02:10:00Z") } });
    const candidate = (openKey: string | null, status: "OPEN" | "CLEARED") => ({
      workspaceId, detectorId: "dead-letter-surge", mergeKey: "closure", openKey, objectKey: "job:closure",
      severity: "critical", reasonCode: "dead_letters_over_threshold", titleZh: "死信激增", titleEn: "Dead-letter surge",
      status, firstSeenAt: new Date(), lastSeenAt: new Date(), lastTickId: tick.id, evidenceRefsJson: "[]",
    });
    await db.caioAnomalyCandidate.create({ data: candidate("dead-letter-surge:closure", "OPEN") });
    await expect(db.caioAnomalyCandidate.create({ data: candidate("dead-letter-surge:closure", "OPEN") })).rejects.toSatisfy(isUniqueViolation);
    await db.caioAnomalyCandidate.create({ data: candidate(null, "CLEARED") });
    await db.caioAnomalyCandidate.create({ data: candidate(null, "CLEARED") });
    expect(await db.caioAnomalyCandidate.count({ where: { workspaceId, status: "CLEARED" } })).toBe(2);
  });

  it("stores one observation per template per tick", async () => {
    const tick = await db.caioQuickCheckTick.create({ data: { workspaceId, bucketStart: new Date("2026-09-16T02:20:00Z") } });
    const observation = {
      workspaceId, tickId: tick.id, sourceKey: "source-a", templateId: "dead-letters", domain: "operations",
      windowStart: new Date("2026-09-16T02:10:00Z"), windowEnd: new Date("2026-09-16T02:20:00Z"), observedAt: new Date(),
      status: "unknown", errorCode: "observation_gate_rejected",
    };
    await db.caioMetricObservation.create({ data: observation });
    await expect(db.caioMetricObservation.create({ data: observation })).rejects.toSatisfy(isUniqueViolation);
  });

  it("keeps one context snapshot per tick and cascades it with the tick", async () => {
    const tick = await db.caioQuickCheckTick.create({ data: { workspaceId, bucketStart: new Date("2026-09-16T03:00:00Z") } });
    await db.caioOperatingContextSnapshot.create({ data: { workspaceId, tickId: tick.id, status: "NO_SIGNALS", reasonCode: "no_signals" } });
    await expect(db.caioOperatingContextSnapshot.create({ data: { workspaceId, tickId: tick.id, status: "NO_SIGNALS" } }))
      .rejects.toSatisfy(isUniqueViolation);
    await db.caioQuickCheckTick.delete({ where: { id: tick.id } });
    expect(await db.caioOperatingContextSnapshot.count({ where: { tickId: tick.id } })).toBe(0);
  });

  it("cascades all three tables with the workspace", async () => {
    const other = await db.workspace.create({ data: { name: `CAIO context cascade ${suffix}`, slug: `caio-context-cascade-${suffix}` } });
    const tick = await db.caioQuickCheckTick.create({ data: { workspaceId: other.id, bucketStart: new Date("2026-09-16T02:00:00Z") } });
    await db.caioMetricObservation.create({ data: {
      workspaceId: other.id, tickId: tick.id, sourceKey: "s", templateId: "t", domain: "d",
      windowStart: new Date(), windowEnd: new Date(), observedAt: new Date(), status: "unknown",
    } });
    await db.workspace.delete({ where: { id: other.id } });
    expect(await db.caioQuickCheckTick.count({ where: { workspaceId: other.id } })).toBe(0);
    expect(await db.caioMetricObservation.count({ where: { workspaceId: other.id } })).toBe(0);
  });
});
