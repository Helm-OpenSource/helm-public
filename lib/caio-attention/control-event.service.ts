import { randomBytes } from "node:crypto";

import type { Prisma } from "@prisma/client";

/**
 * Append-only audit of the control plane (design v6 §1.6 "resume … 写审计", §2.4 GUARD_DOWNGRADED record): every
 * operator / deploy-host operation appends one CaioAttentionControlEvent inside its own transaction, after its state
 * write, so the operation and its record commit or roll back together. The operator identity holds SELECT/INSERT
 * only, so nothing can rewrite the trail. `op` is the CLI op name (CHECK-constrained in the migration). The payload
 * carries the operation's details and never a lease token (the lease is the fence credential).
 */
export const CAIO_ATTENTION_CONTROL_EVENT_OPS = [
  "pause", "resume", "expected-nodes", "deploy-begin", "attest-node", "deploy-end", "deploy-recover", "guard-downgrade",
  "routes-publish", "routes-activate",
] as const;
export type CaioAttentionControlEventOp = (typeof CAIO_ATTENTION_CONTROL_EVENT_OPS)[number];

export type CaioAttentionControlEvent = Readonly<{
  op: CaioAttentionControlEventOp;
  actorRef: string;
  /** Control epoch / openEpoch after the operation; null only for the workspace-scoped route-config ops. */
  epoch: number | null;
  openEpoch: number | null;
  payload: Readonly<Record<string, unknown>>;
}>;

export async function appendCaioAttentionControlEvent(tx: Prisma.TransactionClient, event: CaioAttentionControlEvent): Promise<string> {
  const id = `ce_${randomBytes(12).toString("hex")}`;
  await tx.$executeRaw`INSERT INTO CaioAttentionControlEvent (id, op, actorRef, epoch, openEpoch, payloadJson)
    VALUES (${id}, ${event.op}, ${event.actorRef.slice(0, 191)}, ${event.epoch}, ${event.openEpoch}, ${JSON.stringify(event.payload)})`;
  return id;
}
