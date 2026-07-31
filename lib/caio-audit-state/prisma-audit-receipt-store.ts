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
 * The receipt's seventh field, `posture`, is persisted and compared. It has to
 * be: posture is part of the receipt digest, so the same request recorded
 * under a different deployment posture is a DIFFERENT dispatch. Within one
 * installation the gate already refuses a claim naming another posture
 * (CaioAuditPostureMismatchError), but that check cannot reach the case this
 * column exists for — two differently-postured deployments sharing one
 * workspace's rows, which is a deployment topology rather than a code path the
 * gate can rule out. Without the column such a duplicate
 * [workspaceId, requestId] resolved as an idempotent "replayed"; it now
 * resolves as "conflict". The encrypted emergency queue never had this gap: it
 * binds the full receipt digest, which already covers posture.
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
            posture: receipt.posture,
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
          existing.policyVersion === receipt.policyVersion &&
          existing.posture === receipt.posture;
        if (!sameContent) {
          return { outcome: "conflict" };
        }
        return { outcome: "replayed", receiptId: existing.id };
      }
    },
  };
}
