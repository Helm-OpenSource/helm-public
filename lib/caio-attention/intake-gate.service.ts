import type { Prisma } from "@prisma/client";

import { isCaioAttentionIntakeOpen } from "./control-epoch";

/**
 * Entry gate (design v6 §1.4), read inside the caller's transaction before it creates or keeps a non-terminal case:
 * the Control row under FOR SHARE, then no pause request at the open epoch. The FOR SHARE lock is what lets the
 * operator's deploy-begin / pause (FOR UPDATE on the same row) drain in-flight entries. A missing Control row is
 * closed. The operator Control service and CLI that move the row live outside this module.
 */
export type CaioAttentionIntakeGate = Readonly<{ open: boolean; intakeState: string | null; openEpoch: number | null }>;

export async function readCaioAttentionIntakeGate(tx: Prisma.TransactionClient): Promise<CaioAttentionIntakeGate> {
  const [control] = await tx.$queryRaw<Array<{ intakeState: string; openEpoch: number }>>`
    SELECT intakeState, openEpoch FROM CaioAttentionControl WHERE id = 'global' FOR SHARE`;
  if (!control) return { open: false, intakeState: null, openEpoch: null };
  const openEpoch = Number(control.openEpoch);
  const requests = await tx.$queryRaw<Array<{ openEpoch: number }>>`
    SELECT openEpoch FROM CaioAttentionPauseRequest WHERE openEpoch = ${openEpoch} LIMIT 1`;
  const open = isCaioAttentionIntakeOpen(control.intakeState, openEpoch, requests.map((row) => Number(row.openEpoch)));
  return { open, intakeState: control.intakeState, openEpoch };
}
