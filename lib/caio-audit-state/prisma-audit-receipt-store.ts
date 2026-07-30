import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import type { CaioAuditPrimaryStorePort } from "@/lib/caio-audit-state/audit-gate.service";
import { db } from "@/lib/db";

/**
 * Prisma-backed primary audit store adapter over CaioAuditDispatchReceipt.
 *
 * Durability comes from the database commit: persist() resolves only after
 * the row is committed. The unique [workspaceId, requestId] key makes
 * replays idempotent — a duplicate with identical content resolves as
 * "replayed" (the stored persistedVia is preserved), a duplicate with
 * different content resolves as "conflict".
 *
 * KNOWN GAP (stated rather than hidden): the receipt's seventh field,
 * `posture`, has no column on CaioAuditDispatchReceipt, so this store neither
 * persists nor compares it. Within one installation that is harmless — a
 * process runs under exactly one declared posture and the gate refuses any
 * claim naming another (CaioAuditPostureMismatchError) — but if two
 * differently-postured deployments ever shared one workspace's rows, a
 * duplicate [workspaceId, requestId] from the other posture would resolve as
 * "replayed" instead of "conflict". Closing it requires a `posture` column
 * (NOT NULL) plus its inclusion in the sameContent comparison below; that is a
 * prisma/ migration and is deliberately NOT part of this change. The encrypted
 * emergency queue has no such gap: it binds the full receipt digest, which now
 * covers posture.
 */
export function createPrismaCaioAuditReceiptStore(): CaioAuditPrimaryStorePort {
  return {
    async persist({ receipt, persistedVia, now }) {
      try {
        const created = await db.caioAuditDispatchReceipt.create({
          data: {
            id: randomUUID(),
            workspaceId: receipt.workspace,
            requestId: receipt.requestId,
            clientType: receipt.client,
            modelAlias: receipt.modelAlias,
            inputHash: receipt.inputHash,
            policyVersion: receipt.policyVersion,
            persistedVia,
            createdAt: now,
          },
        });
        return { outcome: "persisted", receiptId: created.id };
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
        const existing = await db.caioAuditDispatchReceipt.findUnique({
          where: {
            workspaceId_requestId: {
              workspaceId: receipt.workspace,
              requestId: receipt.requestId,
            },
          },
        });
        if (!existing) {
          throw error;
        }
        const sameContent =
          existing.clientType === receipt.client &&
          existing.modelAlias === receipt.modelAlias &&
          existing.inputHash === receipt.inputHash &&
          existing.policyVersion === receipt.policyVersion;
        if (!sameContent) {
          return { outcome: "conflict" };
        }
        return { outcome: "replayed", receiptId: existing.id };
      }
    },
  };
}
