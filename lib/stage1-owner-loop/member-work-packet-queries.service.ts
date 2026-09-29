import { MembershipStatus, type Prisma } from "@prisma/client";

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

type ClaimWithAction = Prisma.DecisionWorkPacketClaimGetPayload<{
  include: { actionItem: { select: { id: true; title: true; status: true; workspaceId: true } } };
}>;

const MAX_PACKETS = 50;
const CLAIM_PAGE_SIZE = 500;
const MAX_SCANNED_CLAIMS = 10_000;

export async function listWorkPacketsAssignedToMember(input: {
  workspaceId: string;
  userId: string;
  /** Claims read per page; only tests lower it. */
  pageSize?: number;
}): Promise<MemberWorkPacket[]> {
  const pageSize = Math.min(Math.max(input.pageSize ?? CLAIM_PAGE_SIZE, 1), CLAIM_PAGE_SIZE);
  const membership = await db.membership.findFirst({
    where: { workspaceId: input.workspaceId, userId: input.userId },
    select: { status: true },
  });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new MemberWorkPacketAccessError();
  }
  const targetRef = `user:${input.userId}`;
  // Claims carry the executor only inside ownerCommandJson, so the read pages through the workspace's claims
  // (newest first, keyset on createdAt/id) until it has MAX_PACKETS or runs out, bounded by MAX_SCANNED_CLAIMS.
  // A single latest-500 window made older packets for a member vanish once the workspace had more claims.
  const packets: MemberWorkPacket[] = [];
  let cursor: { createdAt: Date; id: string } | null = null;
  for (let scanned = 0; scanned < MAX_SCANNED_CLAIMS && packets.length < MAX_PACKETS; ) {
    const claims: ClaimWithAction[] = await db.decisionWorkPacketClaim.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(cursor
          ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize,
      include: {
        actionItem: { select: { id: true, title: true, status: true, workspaceId: true } },
      },
    });
    if (claims.length === 0) break;
    scanned += claims.length;
    const last: ClaimWithAction = claims[claims.length - 1];
    cursor = { createdAt: last.createdAt, id: last.id };
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
    if (claims.length < pageSize) break;
  }
  return packets;
}
