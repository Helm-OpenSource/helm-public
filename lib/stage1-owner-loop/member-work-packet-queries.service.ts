import { MembershipStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

import { validateOwnerCommandDraft } from "./contracts";
import type { OwnerCommandDraft } from "./types";

/**
 * The work an owner has dispatched TO a member, as that member sees it.
 *
 * Visibility follows the same explicit grant the private execution ingress already honours: the owner's
 * command names the executor (`executionTargetRef === "user:<id>"`). A member sees only packets that name
 * them; another member of the same workspace, even an OWNER-level one, gets nothing through this read, and a
 * non-member or inactive member is refused outright. It is read-only and exposes the owner's instruction, not
 * the private decision evidence.
 */

export class MemberWorkPacketAccessError extends Error {
  readonly code = "member_work_packet_membership_required";

  constructor() {
    super("member_work_packet_membership_required");
    this.name = "MemberWorkPacketAccessError";
  }
}

export type MemberWorkPacket = Readonly<{
  actionItemRef: string;
  decisionRef: string;
  title: string;
  status: string;
  goal: string;
  action: string;
  dueAt: string;
  acceptanceCriteria: readonly string[];
  dispatchedAt: string;
}>;

const MAX_PACKETS = 50;

export async function listWorkPacketsAssignedToMember(input: {
  workspaceId: string;
  userId: string;
}): Promise<MemberWorkPacket[]> {
  const membership = await db.membership.findFirst({
    where: { workspaceId: input.workspaceId, userId: input.userId },
    select: { status: true },
  });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new MemberWorkPacketAccessError();
  }
  const targetRef = `user:${input.userId}`;
  const claims = await db.decisionWorkPacketClaim.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      actionItem: { select: { id: true, title: true, status: true, workspaceId: true } },
    },
  });
  const packets: MemberWorkPacket[] = [];
  for (const claim of claims) {
    const command = safeParseJson<OwnerCommandDraft | null>(claim.ownerCommandJson, null);
    if (
      !command ||
      !validateOwnerCommandDraft(command).valid ||
      command.executionTargetRef !== targetRef ||
      command.workspaceRef !== `workspace:${input.workspaceId}` ||
      claim.actionItem.workspaceId !== input.workspaceId
    ) {
      continue;
    }
    packets.push(
      Object.freeze({
        actionItemRef: claim.actionItem.id,
        decisionRef: claim.decisionRecordId,
        title: claim.actionItem.title,
        status: claim.actionItem.status,
        goal: command.goal,
        action: command.action,
        dueAt: command.dueAt,
        acceptanceCriteria: Object.freeze([...command.acceptanceCriteria]),
        dispatchedAt: claim.createdAt.toISOString(),
      }),
    );
    if (packets.length >= MAX_PACKETS) break;
  }
  return packets;
}
