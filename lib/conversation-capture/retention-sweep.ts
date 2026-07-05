/**
 * Capture retention sweep — pure, review-first.
 *
 * Turns the workspace `dataRetentionDays` setting from "stored but never
 * enforced" into an honest, human-gated cleanup path: this module only
 * COMPUTES which capture sessions have outlived the retention window and
 * packages them as a pending-delete review packet. Nothing is deleted here;
 * deletion is a separate human decision. No DB access, no scheduling.
 */

export const CAPTURE_RETENTION_SWEEP_RULE_VERSION =
  "capture-retention-sweep/v1" as const;

export interface RetentionSweepSessionLike {
  readonly id: string;
  readonly title: string | null;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
}

export interface RetentionSweepInput {
  readonly workspaceId: string;
  readonly retentionDays: number;
  readonly now: Date;
  readonly sessions: readonly RetentionSweepSessionLike[];
}

export interface RetentionSweepCandidate {
  readonly captureSessionId: string;
  readonly title: string | null;
  readonly referenceDateIso: string;
  readonly ageDays: number;
}

export interface RetentionSweepPacket {
  readonly ruleVersion: typeof CAPTURE_RETENTION_SWEEP_RULE_VERSION;
  readonly workspaceId: string;
  readonly retentionDays: number;
  readonly generatedAtIso: string;
  readonly reviewPosture: "review_required";
  readonly pendingDeleteCandidates: readonly RetentionSweepCandidate[];
  readonly boundaries: readonly string[];
}

export const RETENTION_SWEEP_BOUNDARIES = [
  "This packet lists candidates only; nothing is deleted automatically",
  "Deletion requires an explicit human decision per candidate or batch",
  "Export before delete stays available through workspace self-service export",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildRetentionSweepPacket(
  input: RetentionSweepInput,
): RetentionSweepPacket {
  const retentionDays = Math.max(1, Math.floor(input.retentionDays));
  const cutoffMs = input.now.getTime() - retentionDays * DAY_MS;

  const pendingDeleteCandidates = input.sessions.flatMap((session) => {
    const referenceDate = session.endedAt ?? session.createdAt;
    if (referenceDate.getTime() > cutoffMs) {
      return [];
    }
    return [
      {
        captureSessionId: session.id,
        title: session.title,
        referenceDateIso: referenceDate.toISOString(),
        ageDays: Math.floor(
          (input.now.getTime() - referenceDate.getTime()) / DAY_MS,
        ),
      },
    ];
  });

  return {
    ruleVersion: CAPTURE_RETENTION_SWEEP_RULE_VERSION,
    workspaceId: input.workspaceId,
    retentionDays,
    generatedAtIso: input.now.toISOString(),
    reviewPosture: "review_required",
    pendingDeleteCandidates,
    boundaries: [...RETENTION_SWEEP_BOUNDARIES],
  };
}
