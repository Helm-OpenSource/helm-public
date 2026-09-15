import { WorkspaceRole } from "@prisma/client";

import { getWorkspaceStage1OwnerLoopReadout } from "@/features/dashboard/stage1-owner-loop-query";
import { getCaioInitializationGateStatus } from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";

type GateStatus = Awaited<ReturnType<typeof getCaioInitializationGateStatus>>;
type OwnerLoopReadout = NonNullable<Awaited<ReturnType<typeof getWorkspaceStage1OwnerLoopReadout>>>;

export type CaioOperatorReadout = Readonly<{
  gate: { available: true; status: GateStatus } | { available: false };
  ownerLoop: { available: true; readout: OwnerLoopReadout } | { available: false };
}>;

/**
 * Operator panel readout. Non-owners get null before any read. Each part degrades to
 * "unavailable" on its own; a failed read is never rendered as an empty-but-real state.
 */
export async function getCaioOperatorReadout(input: {
  workspaceId: string;
  actorUserId: string;
  membershipRole: WorkspaceRole;
  english: boolean;
}): Promise<CaioOperatorReadout | null> {
  if (input.membershipRole !== WorkspaceRole.OWNER) return null;
  const [gate, ownerLoop] = await Promise.all([
    getCaioInitializationGateStatus({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      english: input.english,
    }).then((status) => ({ available: true as const, status }), () => ({ available: false as const })),
    getWorkspaceStage1OwnerLoopReadout({
      workspaceId: input.workspaceId,
      membershipRole: input.membershipRole,
    }).then(
      (readout) => (readout ? { available: true as const, readout } : { available: false as const }),
      () => ({ available: false as const }),
    ),
  ]);
  return { gate, ownerLoop };
}
