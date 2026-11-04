import type { Prisma } from "@prisma/client";

import { parseCaioAttentionEvidenceRefs, type CaioAttentionResolvedEvidence } from "@/lib/caio-attention/evidence";

/**
 * Database lookups behind the attention evidence rules (lib/caio-attention/evidence.ts). Kept outside
 * lib/caio-attention on purpose: that module never references the generic governed-task tables, while an
 * `execution-receipt:<id>` ref still has to be checked against the receipt that exists. Read-only; runs on the
 * caller's transaction so submission and review see the same rows they lock against.
 */
/** Looks up every system evidence ref of the disposition; unknown kinds are external and need reviewer attestation. */
export async function resolveCaioAttentionSystemEvidence(tx: Prisma.TransactionClient, refs: readonly string[]): Promise<CaioAttentionResolvedEvidence[]> {
  const parsed = parseCaioAttentionEvidenceRefs(refs);
  if (!parsed.ok) return [];
  const ids = (kind: string) => parsed.refs.filter((r) => r.kind === kind).map((r) => r.ref.slice(kind.length + 1));
  const lookups: Promise<CaioAttentionResolvedEvidence[]>[] = [
    tx.auditLog.findMany({ where: { id: { in: ids("audit-log") } }, select: { id: true, workspaceId: true, createdAt: true } })
      .then((rows) => rows.map((row) => ({ ref: `audit-log:${row.id}`, found: true, workspaceId: row.workspaceId, createdAt: row.createdAt }))),
    tx.executionReceipt.findMany({ where: { id: { in: ids("execution-receipt") } }, select: { id: true, workspaceId: true, createdAt: true } })
      .then((rows) => rows.map((row) => ({ ref: `execution-receipt:${row.id}`, found: true, workspaceId: row.workspaceId, createdAt: row.createdAt }))),
    tx.caioQuickCheckTick.findMany({ where: { id: { in: ids("caio-tick") } }, select: { id: true, workspaceId: true, bucketStart: true, status: true } })
      .then((rows) => rows.map((row) => ({ ref: `caio-tick:${row.id}`, found: true, workspaceId: row.workspaceId, bucketStart: row.bucketStart, tickStatus: row.status }))),
    tx.caioDetectorEvaluation.findMany({
      where: { id: { in: ids("caio-detector-evaluation") } }, select: { id: true, workspaceId: true, bucketStart: true, detectorId: true, outcome: true },
    }).then((rows) => rows.map((row) => ({
      ref: `caio-detector-evaluation:${row.id}`, found: true, workspaceId: row.workspaceId, bucketStart: row.bucketStart, detectorId: row.detectorId, outcome: row.outcome,
    }))),
    tx.caioAnomalyCandidate.findMany({ where: { id: { in: ids("caio-anomaly-candidate") } }, select: { id: true, workspaceId: true } })
      .then((rows) => rows.map((row) => ({ ref: `caio-anomaly-candidate:${row.id}`, found: true, workspaceId: row.workspaceId }))),
  ];
  const found: CaioAttentionResolvedEvidence[] = [];
  for (const lookup of lookups) found.push(...(await lookup)); // sequential on one transaction connection
  return found;
}

/** Tables the evidence lookups read; the web identity needs SELECT on each (deployments already grant it). */
export const CAIO_ATTENTION_EVIDENCE_SOURCE_TABLES = ["AuditLog", "ExecutionReceipt", "CaioQuickCheckTick", "CaioAnomalyCandidate"] as const;

/** SELECT grants for the least-privilege fixture's web identity (printed by scripts/caio-attention-grant-fixture.ts). */
export function renderCaioAttentionEvidenceGrantSql(database: string, host = "%"): string {
  if (!/^[A-Za-z0-9_]+$/u.test(database) || !/^[A-Za-z0-9_.%-]+$/u.test(host)) throw new Error("unsafe MySQL identifier");
  return CAIO_ATTENTION_EVIDENCE_SOURCE_TABLES
    .map((table) => `GRANT SELECT ON \`${database}\`.\`${table}\` TO 'attention_web'@'${host}';\n`).join("");
}
