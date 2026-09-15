import "server-only";

import { WorkspaceRole } from "@prisma/client";

import { db } from "@/lib/db";

import { CAIO_ANOMALY_SEVERITIES, type CaioAnomalySeverity } from "./contracts";

/**
 * OWNER-only readout for the /caio attention section. Any read failure, including missing tables,
 * yields available=false so the page never renders an unreadable state as "nothing to attend to".
 * Evidence refs and metric values are never returned.
 */

export const CAIO_QUICK_CHECK_STALE_AFTER_MS = 30 * 60_000;
const MAX_CANDIDATES = 20;
const SEVERITY_RANK: Record<CaioAnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };

export type CaioOperatingAttentionReadout =
  | { available: false }
  | {
      available: true;
      lastTick: { bucketStart: string; status: "RUNNING" | "COMPLETED" | "FAILED"; stale: boolean } | null;
      openCandidates: Array<{
        detectorId: string;
        titleZh: string;
        titleEn: string;
        severity: CaioAnomalySeverity;
        reasonCode: string;
        hitCount: number;
        firstSeenAt: string;
        lastSeenAt: string;
      }>;
      unknownTemplates: Array<{ templateId: string; domain: string; errorCode: string | null }>;
      lastSnapshot: { status: "PROJECTED" | "REJECTED" | "NO_SIGNALS"; createdAt: string; objectCount: number; signalCount: number } | null;
    };

function snapshotStatus(value: string): "PROJECTED" | "REJECTED" | "NO_SIGNALS" {
  return value === "PROJECTED" || value === "NO_SIGNALS" ? value : "REJECTED";
}

function tickStatus(value: string): "RUNNING" | "COMPLETED" | "FAILED" {
  return value === "COMPLETED" || value === "RUNNING" ? value : "FAILED";
}

function severity(value: string): CaioAnomalySeverity {
  return (CAIO_ANOMALY_SEVERITIES as readonly string[]).includes(value) ? (value as CaioAnomalySeverity) : "critical";
}

export async function getCaioOperatingAttentionReadout(input: {
  workspaceId: string;
  membershipRole: WorkspaceRole;
  now?: Date;
}): Promise<CaioOperatingAttentionReadout | null> {
  if (input.membershipRole !== WorkspaceRole.OWNER) return null;
  const now = input.now ?? new Date();
  try {
    const [lastTick, lastFinishedTick, candidates, lastSnapshot] = await Promise.all([
      db.caioQuickCheckTick.findFirst({ where: { workspaceId: input.workspaceId }, orderBy: { bucketStart: "desc" } }),
      db.caioQuickCheckTick.findFirst({
        where: { workspaceId: input.workspaceId, status: { in: ["COMPLETED", "FAILED"] } },
        orderBy: { bucketStart: "desc" },
        select: { id: true },
      }),
      db.caioAnomalyCandidate.findMany({
        where: { workspaceId: input.workspaceId, status: "OPEN" },
        orderBy: { lastSeenAt: "desc" },
        take: 200,
      }),
      // Snapshot bodies and projection inputs are never read here.
      db.caioOperatingContextSnapshot.findFirst({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        select: { status: true, createdAt: true, objectCount: true, signalCount: true },
      }),
    ]);
    const unknown = lastFinishedTick
      ? await db.caioMetricObservation.findMany({
          where: { tickId: lastFinishedTick.id, status: "unknown" },
          orderBy: { templateId: "asc" },
          select: { templateId: true, domain: true, errorCode: true },
        })
      : [];
    return {
      available: true,
      lastTick: lastTick
        ? {
            bucketStart: lastTick.bucketStart.toISOString(),
            status: tickStatus(lastTick.status),
            stale: now.getTime() - lastTick.bucketStart.getTime() > CAIO_QUICK_CHECK_STALE_AFTER_MS,
          }
        : null,
      openCandidates: candidates
        .map((candidate) => ({
          detectorId: candidate.detectorId,
          titleZh: candidate.titleZh,
          titleEn: candidate.titleEn,
          severity: severity(candidate.severity),
          reasonCode: candidate.reasonCode,
          hitCount: candidate.hitCount,
          firstSeenAt: candidate.firstSeenAt.toISOString(),
          lastSeenAt: candidate.lastSeenAt.toISOString(),
        }))
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.lastSeenAt.localeCompare(a.lastSeenAt))
        .slice(0, MAX_CANDIDATES),
      unknownTemplates: unknown,
      lastSnapshot: lastSnapshot
        ? {
            status: snapshotStatus(lastSnapshot.status),
            createdAt: lastSnapshot.createdAt.toISOString(),
            objectCount: lastSnapshot.objectCount,
            signalCount: lastSnapshot.signalCount,
          }
        : null,
    };
  } catch {
    return { available: false };
  }
}
