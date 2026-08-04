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
 *
 * The column is NULLABLE, and NULL means LEGACY UNKNOWN / QUARANTINED — a row
 * written before posture was recorded. Such a row is never equal to anything:
 * it cannot resolve a duplicate as a replay, so a legacy row forces "conflict"
 * rather than certifying a dispatch it has no evidence about.
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
        // A NULL stored posture is LEGACY UNKNOWN, not a wildcard and not
        // "the same as whatever is asking". The column is nullable precisely
        // because a row predating posture recording cannot have one invented
        // for it, and the one thing such a row must never do is answer the
        // question this comparison asks. Letting NULL match would resurrect
        // the replay-vs-conflict bug the column exists to close, in exactly
        // the case where the evidence is weakest. Written as an explicit
        // non-null test rather than leaning on `null === "self_service"` being
        // false, so the intent survives a change to either side's type.
        const storedPosture: string | null = existing.posture;
        const samePosture =
          storedPosture !== null && storedPosture === receipt.posture;
        const sameContent =
          existing.clientType === receipt.client &&
          existing.modelAlias === receipt.modelAlias &&
          existing.inputHash === receipt.inputHash &&
          existing.policyVersion === receipt.policyVersion &&
          samePosture;
        if (!sameContent) {
          return { outcome: "conflict" };
        }
        return { outcome: "replayed", receiptId: existing.id };
      }
    },
  };
}
