import "server-only";

import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

import {
  CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
  type CaioInferenceInput,
  type CaioInferenceTaskClass,
} from "./contracts";

/**
 * Freezes one review window into an inference input: the projected operating-context snapshots in the window
 * plus aggregate supplements. Only snapshot identity, snapshot hash and evidence refs leave the database —
 * never snapshot bodies, metric values or any record-level content.
 */
const MAX_SNAPSHOTS = 24;
const MAX_EVIDENCE_REFS = 500;
const MAX_JSON_DEPTH = 12;
const EVIDENCE_REF_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,255}$/iu;

export type CaioInferenceSupplementPort = (input: {
  workspaceId: string;
  windowStart: Date;
  windowEnd: Date;
}) => Promise<ReadonlyArray<{ key: string; counts: Readonly<Record<string, number | null>> }>>;

export async function buildCaioInferenceInput(input: {
  workspaceId: string;
  taskClass: CaioInferenceTaskClass;
  windowStart: Date;
  windowEnd: Date;
  supplements?: CaioInferenceSupplementPort;
}): Promise<CaioInferenceInput | null> {
  const rows = await db.caioOperatingContextSnapshot.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "PROJECTED",
      createdAt: { gte: input.windowStart, lt: input.windowEnd },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_SNAPSHOTS,
    select: { id: true, snapshotHash: true, snapshotJson: true },
  });

  const snapshotRefs: Array<{ snapshotId: string; snapshotHash: string }> = [];
  const evidenceRefs = new Set<string>();
  for (const row of rows) {
    if (!row.snapshotHash) continue;
    snapshotRefs.push({ snapshotId: row.id, snapshotHash: row.snapshotHash });
    for (const ref of collectEvidenceRefs(safeParseJson<unknown>(row.snapshotJson ?? "null", null))) {
      if (evidenceRefs.size >= MAX_EVIDENCE_REFS) break;
      evidenceRefs.add(ref);
    }
  }
  // No snapshot or no evidence means there is nothing a judgement could be bound to; the window is skipped
  // rather than sent as an empty question.
  if (snapshotRefs.length === 0 || evidenceRefs.size === 0) return null;

  const supplements = input.supplements
    ? await input.supplements({
        workspaceId: input.workspaceId,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      })
    : [];

  return {
    schemaVersion: CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
    workspaceId: input.workspaceId,
    taskClass: input.taskClass,
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    snapshotRefs,
    evidenceRefs: [...evidenceRefs].sort(),
    supplements: supplements.map((entry) => ({
      key: entry.key,
      counts: normalizeCounts(entry.counts),
    })),
  };
}

/** Collects `evidenceRefs` entries anywhere in a stored snapshot, bounded in depth and shape. */
function collectEvidenceRefs(value: unknown, depth = 0): string[] {
  if (depth > MAX_JSON_DEPTH || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectEvidenceRefs(entry, depth + 1));
  }
  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "evidenceRefs" && Array.isArray(child)) {
      for (const entry of child) {
        if (typeof entry === "string" && EVIDENCE_REF_PATTERN.test(entry)) found.push(entry);
      }
      continue;
    }
    found.push(...collectEvidenceRefs(child, depth + 1));
  }
  return found;
}

/** A supplement carries counts only: a non-finite or non-numeric reading stays unknown rather than zero. */
function normalizeCounts(counts: Readonly<Record<string, number | null>>): Record<string, number | null> {
  const normalized: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(counts)) {
    normalized[key] = typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  return normalized;
}
