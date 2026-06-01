/**
 * Helm Business Advancement evidence chain audit writer
 *
 * Persists `AdvancementJudgement.evidenceChain` snapshots into the existing
 * `AuditLog.payload` JSON field (no schema change; per launch plan §三 Week
 * 2 #16-17).
 *
 * Single write path: the thin read-model adapter constructs a candidate
 * AdvancementJudgement, calls `persistAdvancementJudgementEvidenceChain`,
 * and only after the audit row is committed may the candidate enter the
 * downstream Must Push compression. Any error short-circuits the runtime
 * adoption and falls back to read-first compression.
 */

import "server-only";

import { ActorType, type PrismaClient } from "@prisma/client";

export type AdvancementJudgementEvidenceLink = {
  readonly objectType: string;
  readonly objectId: string;
  readonly relation:
    | "primary_evidence"
    | "supporting_evidence"
    | "exclusion_reason";
  readonly observedAt: string;
};

export type AdvancementJudgementEvidenceChainSnapshot = {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly workspaceId: string;
  readonly subjectObjectType: string;
  readonly subjectObjectId: string;
  readonly ruleVersion: string;
  readonly judgement: "candidate" | "excluded";
  readonly rankingSource: string;
  readonly thresholdStatus: string;
  readonly evidenceLinks: readonly AdvancementJudgementEvidenceLink[];
  readonly capturedAtIso: string;
};

export const ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_AUDIT_ACTION_TYPE =
  "ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_PERSISTED" as const;

/**
 * Persists the snapshot. Writes a single AuditLog row with:
 *   - actionType = ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_PERSISTED
 *   - payload = JSON.stringify(snapshot)
 *
 * Returns the audit row id; throws if Prisma rejects the insert.
 *
 * The function intentionally does **not** swallow errors — Phase 3 review
 * §四 invariant-guard rollback drill requires the runtime to fail closed
 * when audit writes fail.
 */
export async function persistAdvancementJudgementEvidenceChain(input: {
  db: Pick<PrismaClient, "auditLog">;
  snapshot: AdvancementJudgementEvidenceChainSnapshot;
  /** Workspace user id triggering the runtime evaluation, if any. */
  triggeringUserId: string | null;
  /** Source page or job that triggered evaluation (e.g. `/mobile`, `cron:advancement-runtime`). */
  sourcePage: string;
}): Promise<{ auditRowId: string }> {
  const { db, snapshot, triggeringUserId, sourcePage } = input;

  const summary = `${snapshot.tpqrId} ${snapshot.judgement} for ${snapshot.subjectObjectType}:${snapshot.subjectObjectId}`;

  const row = await db.auditLog.create({
    data: {
      workspaceId: snapshot.workspaceId,
      userId: triggeringUserId,
      actor: triggeringUserId ?? "system:business-advancement-runtime",
      actorType: triggeringUserId ? ActorType.USER : ActorType.SYSTEM,
      actionType: ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_AUDIT_ACTION_TYPE,
      targetType: snapshot.subjectObjectType,
      targetId: snapshot.subjectObjectId,
      summary,
      payload: JSON.stringify(snapshot),
      sourcePage,
      relatedObjectType: snapshot.subjectObjectType,
      relatedObjectId: snapshot.subjectObjectId,
    },
    select: { id: true },
  });

  return { auditRowId: row.id };
}
