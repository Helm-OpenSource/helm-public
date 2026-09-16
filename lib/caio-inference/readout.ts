import "server-only";

import { WorkspaceRole } from "@prisma/client";

import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

import { CAIO_INFERENCE_REJECTION_CODES, type CaioInferenceRejectionCode, type CaioInferenceTaskClass } from "./contracts";
import type { CaioLayeredJudgement } from "./layered-judgement";

/**
 * OWNER-only readout for the /caio review section. A read failure yields available=false so the page never
 * renders an unreadable state as "no judgement"; an empty queue says so in words rather than showing blank.
 * Judgement text is model-authored data about aggregates and is rendered as text, never executed or followed.
 */
const MAX_JOBS = 10;
const MAX_LAYER_ENTRIES = 8;
/** A job still queued for longer than this means no worker is pulling: the device side is offline. */
export const CAIO_INFERENCE_OFFLINE_AFTER_MS = 90 * 60_000;

export type CaioInferenceJudgementProjection = {
  taskClass: CaioInferenceTaskClass | string;
  windowStart: string;
  windowEnd: string;
  completedAt: string | null;
  confidenceBand: string;
  facts: string[];
  inferences: string[];
  risks: Array<{ statement: string; severity: string }>;
  unknowns: string[];
  suggestions: Array<{ kind: string; summary: string }>;
};

export type CaioInferenceReviewReadout =
  | { available: false }
  | {
      available: true;
      workerState: "idle" | "working" | "offline";
      jobs: Array<{
        taskClass: CaioInferenceTaskClass | string;
        status: string;
        windowStart: string;
        windowEnd: string;
        attempt: number;
        rejectionCode: CaioInferenceRejectionCode | null;
        completedAt: string | null;
      }>;
      latestJudgement: CaioInferenceJudgementProjection | null;
    };

export async function getCaioInferenceReviewReadout(input: {
  workspaceId: string;
  membershipRole: WorkspaceRole;
  now?: Date;
}): Promise<CaioInferenceReviewReadout | null> {
  if (input.membershipRole !== WorkspaceRole.OWNER) return null;
  const now = input.now ?? new Date();
  try {
    const [rows, completed] = await Promise.all([
      db.caioInferenceJob.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        take: MAX_JOBS,
        select: {
          taskClass: true, status: true, windowStart: true, windowEnd: true, attempt: true,
          rejectionCode: true, completedAt: true, createdAt: true, claimedAt: true,
        },
      }),
      db.caioInferenceJob.findFirst({
        where: { workspaceId: input.workspaceId, status: "completed" },
        orderBy: { completedAt: "desc" },
        select: {
          taskClass: true, windowStart: true, windowEnd: true, completedAt: true, layeredJudgementJson: true,
        },
      }),
    ]);

    return {
      available: true,
      workerState: readWorkerState(rows, now),
      jobs: rows.map((row) => ({
        taskClass: row.taskClass,
        status: row.status,
        windowStart: row.windowStart.toISOString(),
        windowEnd: row.windowEnd.toISOString(),
        attempt: row.attempt,
        rejectionCode: rejectionCode(row.rejectionCode),
        completedAt: row.completedAt?.toISOString() ?? null,
      })),
      latestJudgement: completed ? projectJudgement(completed) : null,
    };
  } catch {
    return { available: false };
  }
}

function readWorkerState(
  rows: ReadonlyArray<{ status: string; createdAt: Date; claimedAt: Date | null }>,
  now: Date,
): "idle" | "working" | "offline" {
  if (rows.some((row) => row.status === "claimed")) return "working";
  const stuck = rows.find(
    (row) => row.status === "queued" && now.getTime() - row.createdAt.getTime() > CAIO_INFERENCE_OFFLINE_AFTER_MS,
  );
  if (stuck) return "offline";
  // A window that expired or dead-lettered without ever being claimed is the same story told after the fact.
  if (rows.some((row) => (row.status === "expired" || row.status === "dead_letter") && row.claimedAt === null)) {
    return "offline";
  }
  return "idle";
}

function rejectionCode(value: string | null): CaioInferenceRejectionCode | null {
  return value !== null && (CAIO_INFERENCE_REJECTION_CODES as readonly string[]).includes(value)
    ? (value as CaioInferenceRejectionCode)
    : null;
}

function projectJudgement(row: {
  taskClass: string;
  windowStart: Date;
  windowEnd: Date;
  completedAt: Date | null;
  layeredJudgementJson: string | null;
}): CaioInferenceJudgementProjection {
  const layered = safeParseJson<CaioLayeredJudgement | null>(row.layeredJudgementJson ?? "null", null);
  const text = (value: unknown): string => (typeof value === "string" ? value : "");
  return {
    taskClass: row.taskClass,
    windowStart: row.windowStart.toISOString(),
    windowEnd: row.windowEnd.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    confidenceBand: typeof layered?.confidence?.band === "string" ? layered.confidence.band : "unknown",
    facts: (layered?.facts ?? []).slice(0, MAX_LAYER_ENTRIES).map((entry) => text(entry?.statement)),
    inferences: (layered?.inferences ?? []).slice(0, MAX_LAYER_ENTRIES).map((entry) => text(entry?.statement)),
    risks: (layered?.risks ?? []).slice(0, MAX_LAYER_ENTRIES).map((entry) => ({
      statement: text(entry?.statement),
      severity: typeof entry?.severity === "string" ? entry.severity : "low",
    })),
    unknowns: (layered?.unknowns ?? []).slice(0, MAX_LAYER_ENTRIES).map((entry) => text(entry?.statement)),
    suggestions: (layered?.suggestions ?? []).slice(0, MAX_LAYER_ENTRIES).map((entry) => ({
      kind: typeof entry?.kind === "string" ? entry.kind : "rule_draft",
      summary: text(entry?.summary),
    })),
  };
}
