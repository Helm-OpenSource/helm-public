import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AUDIT_COUNT_CAP, toCappedAuditCount, type CappedAuditCount } from "@/lib/audit/capped-count";

/**
 * Counts matching AuditLog rows up to AUDIT_COUNT_CAP. `where` should be workspace- and time-bounded.
 * The ORDER BY + LIMIT shape lets MySQL read (workspaceId, createdAt) backwards and stop after
 * CAP + 1 entries; without the ORDER BY the optimizer may pick a different workspaceId-prefixed index
 * and scan the workspace in an order unrelated to time.
 */
export async function countAuditLogCapped(where: Prisma.AuditLogWhereInput): Promise<CappedAuditCount> {
  const raw = await db.auditLog.count({
    where,
    orderBy: { createdAt: "desc" },
    take: AUDIT_COUNT_CAP + 1,
  });
  return toCappedAuditCount(raw);
}
