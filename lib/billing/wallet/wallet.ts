import "server-only";
import type { Prisma } from "@prisma/client";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";
import { resolvePayerForWorkspaceInTransaction } from "../payer/payer-accounts";
import { fenToDecimalString } from "../funds/money";

/** Billing V1 S2-c wallet read, finance visibility only: payer resolved server-side; reader is an ACTIVE, unscoped OWNER/BILLING_ADMIN.
 * Projection balance plus wallet deltas newest first (keyset cursor); no evidence, operation keys or business data; fen strings. */
export const WALLET_PAGE_MAX = 100;
export type WalletQuery = { workspaceId: string; actorUserId: string; cursor?: string | null; limit?: number };
export type WalletView = { currency: "CNY"; billingMode: "off" | "shadow" | "enforce"; availableFen: string;
  transactions: Array<{ id: string; kind: string; walletDeltaFen: string; reversalOfId: string | null; createdAt: string }>;
  nextCursor: string | null };

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
function fail(code: string): never { throw new Error(code); }

export async function getWalletInTransaction(tx: Prisma.TransactionClient, query: WalletQuery): Promise<WalletView> {
  if (typeof query.workspaceId !== "string" || !REF.test(query.workspaceId)) fail("wallet_forbidden");
  if (typeof query.actorUserId !== "string" || !REF.test(query.actorUserId)) fail("wallet_forbidden");
  const limit = query.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > WALLET_PAGE_MAX) fail("wallet_query_invalid");
  if (query.cursor != null && (typeof query.cursor !== "string" || !REF.test(query.cursor))) fail("wallet_query_invalid");
  const [member] = await tx.$queryRaw<Array<{ role: string; status: string; accessScope: string | null; workspaceStatus: string }>>`
    SELECT m.role, m.status, m.accessScope, w.status AS workspaceStatus FROM Membership m JOIN Workspace w ON w.id = m.workspaceId
    WHERE m.workspaceId = ${query.workspaceId} AND m.userId = ${query.actorUserId}
      AND CAST(m.userId AS BINARY) = CAST(${query.actorUserId} AS BINARY)
      AND CAST(m.workspaceId AS BINARY) = CAST(${query.workspaceId} AS BINARY)`;
  if (!member || member.status !== "ACTIVE" || member.workspaceStatus !== "ACTIVE" ||
      (member.accessScope !== null && member.accessScope !== "") ||
      !canManageWorkspaceBilling(member.role as Parameters<typeof canManageWorkspaceBilling>[0])) fail("wallet_forbidden");
  const payer = await resolvePayerForWorkspaceInTransaction(tx, query.workspaceId);
  const [projection] = await tx.$queryRaw<Array<{ balanceFen: bigint }>>`SELECT balanceFen FROM FundsAccountProjection
    WHERE payerAccountId = ${payer.payerAccountId} AND account = 'customer_wallet_available'`;
  let after: { createdAt: Date; id: string } | null = null;
  if (query.cursor != null) {
    // The cursor must be one of this payer's own transactions; another payer's id is indistinguishable from a missing one.
    const [anchor] = await tx.$queryRaw<Array<{ createdAt: Date }>>`SELECT createdAt FROM FundsTransaction
      WHERE id = ${query.cursor} AND payerAccountId = ${payer.payerAccountId}`;
    if (!anchor) fail("wallet_query_invalid");
    after = { createdAt: anchor.createdAt, id: query.cursor };
  }
  const rows = await tx.$queryRaw<Array<{ id: string; kind: string; reversalOfId: string | null; createdAt: Date;
    direction: string | null; amountFen: bigint | null }>>`
    SELECT t.id, t.kind, t.reversalOfId, t.createdAt, e.direction, e.amountFen FROM FundsTransaction t
    LEFT JOIN FundsJournalEntry e ON e.transactionId = t.id AND e.account = 'customer_wallet_available'
    WHERE t.payerAccountId = ${payer.payerAccountId}
      AND (${after ? 1 : 0} = 0 OR t.createdAt < ${after?.createdAt ?? null} OR (t.createdAt = ${after?.createdAt ?? null} AND t.id < ${after?.id ?? null}))
    ORDER BY t.createdAt DESC, t.id DESC LIMIT ${limit + 1}`;
  const page = rows.slice(0, limit);
  return { currency: "CNY", billingMode: payer.billingMode,
    availableFen: fenToDecimalString(projection ? BigInt(projection.balanceFen) : BigInt(0)),
    transactions: page.map(row => ({ id: row.id, kind: row.kind, reversalOfId: row.reversalOfId, createdAt: row.createdAt.toISOString(),
      walletDeltaFen: fenToDecimalString(row.amountFen == null ? BigInt(0)
        : row.direction === "credit" ? BigInt(row.amountFen) : -BigInt(row.amountFen)) })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
