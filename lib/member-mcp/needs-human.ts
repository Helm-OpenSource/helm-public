import "server-only";

// Member MCP P2: the owner/admin view of member responses the asynchronous
// processor could not register on its own (needsHuman, or held). Read-only.
//
// Only what a human needs to act is shown: who, which prompt, which kind,
// the status and the processor's closed-set code. For protected responses
// (refuse / pause / appeal) the member's reason is shown to owners and admins
// only, marked unverified — it is member-authored, untrusted text. Answers and
// progress reports never show their text here: they reach /approvals as
// candidates when registered.

import { db } from "@/lib/db";
import { isProtectedResponseKind, parseStoredResponseIntent } from "@/lib/member-mcp/response-contract";

const MAX_ROWS = 100;

export type MemberResponseNeedingHuman = {
  inboxRef: string;
  memberUserId: string;
  memberName: string | null;
  promptRef: string;
  kind: string;
  status: string;
  outcomeCode: string | null;
  attempts: number;
  receivedAt: string;
  unverifiedReason: string | null;
};

export async function listMemberResponsesNeedingHuman(workspaceId: string): Promise<{
  total: number;
  rows: MemberResponseNeedingHuman[];
}> {
  const where = { workspaceId, OR: [{ needsHuman: true }, { status: "held" }] };
  const [total, rows] = await Promise.all([
    db.memberPromptResponseInbox.count({ where }),
    db.memberPromptResponseInbox.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: MAX_ROWS,
      select: {
        id: true,
        memberRef: true,
        promptRef: true,
        kind: true,
        status: true,
        lastErrorCode: true,
        attempts: true,
        receivedAt: true,
        payloadJson: true,
      },
    }),
  ]);
  // memberRef is the member's userId (memberRefForUser).
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.memberRef))] } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));
  return {
    total,
    rows: rows.map((row) => ({
      inboxRef: row.id,
      memberUserId: row.memberRef,
      memberName: names.get(row.memberRef) ?? null,
      promptRef: row.promptRef,
      kind: row.kind,
      status: row.status,
      outcomeCode: row.lastErrorCode,
      attempts: row.attempts,
      receivedAt: row.receivedAt.toISOString(),
      unverifiedReason: isProtectedResponseKind(row.kind)
        ? (parseStoredResponseIntent(row.payloadJson)?.text ?? null)
        : null,
    })),
  };
}
