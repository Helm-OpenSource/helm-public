import { Prisma, type CaioAttentionCase, type PrismaClient } from "@prisma/client";

import {
  caioAttentionActor, caioAttentionParties, canonicalCaioAttentionUserId, parseCaioAttentionIdList,
} from "./core";
import { canReadCaioAttentionCase, isCaioAttentionTerminal, type CaioAttentionActor } from "../state-machine";

/**
 * The only read path for attention cases (design v4 §5.2, v5 §3, owner ruling §6.6). Before confirmation only OWNER
 * and ADMIN can read; afterwards the current command's people and reviewer set can too, and once terminal the
 * participants of earlier command versions keep read-only access. Anyone else gets `not_found` / an empty list, so
 * they cannot learn that a case exists. Every ADMIN read writes a READ event first, including when the ADMIN is also
 * a participant; if the audit write fails nothing is returned.
 */

const PARTICIPANT_EVENT_KINDS = ["CONFIRMED", "REISSUED", "REVIEWERS_ASSIGNED"];
const MAX_PAGE = 50;

async function viewerOf(db: PrismaClient, workspaceId: string, viewerUserId: string): Promise<CaioAttentionActor | null> {
  const userId = canonicalCaioAttentionUserId(viewerUserId);
  if (!userId) return null;
  const member = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true, status: true, accessScope: true },
  });
  const actor = caioAttentionActor(userId, member ? { role: member.role, active: member.status === "ACTIVE" && member.accessScope === null } : undefined);
  return actor.active ? actor : null;
}

/** Everyone named by any earlier command or reviewer assignment of this case. */
async function historicalParticipants(db: PrismaClient, caseId: string): Promise<string[]> {
  const events = await db.caioAttentionCaseEvent.findMany({
    where: { caseId, kind: { in: PARTICIPANT_EVENT_KINDS } }, select: { payloadJson: true },
  });
  const ids = new Set<string>();
  for (const event of events) {
    const payload = JSON.parse(event.payloadJson) as { command?: Record<string, unknown>; reviewerUserIds?: unknown };
    const people = payload.command ?? {};
    for (const value of [people.primaryUserId, people.escalationUserId]) if (typeof value === "string") ids.add(value);
    for (const list of [people.ccUserIds, people.reviewerUserIds, payload.reviewerUserIds]) {
      for (const id of parseCaioAttentionIdList(JSON.stringify(list ?? []))) ids.add(id);
    }
  }
  return [...ids];
}

function recordAdminReads(db: PrismaClient, actor: CaioAttentionActor, caseIds: readonly string[], entry: string) {
  if (actor.role !== "ADMIN" || caseIds.length === 0) return Promise.resolve();
  return db.caioAttentionCaseEvent.createMany({
    data: caseIds.map((caseId) => ({ caseId, kind: "READ", actorUserId: actor.userId, payloadJson: JSON.stringify({ entry }) })),
  }).then(() => undefined);
}

export type CaioAttentionCaseDetail = Readonly<{
  case: CaioAttentionCase;
  events: { id: string; kind: string; commandVersion: number | null; actorUserId: string | null; payloadJson: string; createdAt: Date }[];
  dispositions: Awaited<ReturnType<PrismaClient["caioAttentionDisposition"]["findMany"]>>;
  reviews: Awaited<ReturnType<PrismaClient["caioAttentionReview"]["findMany"]>>;
}>;

export async function loadCaioAttentionCaseForViewer(
  db: PrismaClient, input: Readonly<{ workspaceId: string; caseId: string; viewerUserId: string; entry?: string }>,
): Promise<{ ok: true; detail: CaioAttentionCaseDetail } | { ok: false; reason: "not_found" }> {
  const actor = await viewerOf(db, input.workspaceId, input.viewerUserId);
  const row = actor ? await db.caioAttentionCase.findFirst({ where: { id: input.caseId, workspaceId: input.workspaceId } }) : null;
  if (!actor || !row) return { ok: false, reason: "not_found" };
  const parties = caioAttentionParties(row);
  let access = canReadCaioAttentionCase(actor, parties);
  if (!access.ok && isCaioAttentionTerminal(parties.status) && row.confirmedByUserId !== null) {
    access = canReadCaioAttentionCase(actor, parties, await historicalParticipants(db, row.id));
  }
  if (!access.ok) return { ok: false, reason: "not_found" };
  await recordAdminReads(db, actor, [row.id], input.entry ?? "detail");
  const [events, dispositions, reviews] = await Promise.all([
    db.caioAttentionCaseEvent.findMany({
      where: { caseId: row.id, kind: { not: "READ" } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, kind: true, commandVersion: true, actorUserId: true, payloadJson: true, createdAt: true },
    }),
    db.caioAttentionDisposition.findMany({ where: { caseId: row.id }, orderBy: { sequence: "asc" } }),
    db.caioAttentionReview.findMany({ where: { caseId: row.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return { ok: true, detail: { case: row, events, dispositions, reviews } };
}

/**
 * One page of cases the viewer may see. `queue`: OWNER and ADMIN see the whole workspace (ADMIN reads are audited per
 * listed case); everyone else only confirmed cases where they are in the current command or reviewer set. `mine`:
 * that participant filter for every role. Order: non-terminal first, then critical, then newest.
 */
export async function listCaioAttentionCasesForViewer(
  db: PrismaClient, input: Readonly<{ workspaceId: string; viewerUserId: string; scope?: "queue" | "mine"; take?: number; skip?: number }>,
): Promise<{ rows: CaioAttentionCase[]; total: number }> {
  const actor = await viewerOf(db, input.workspaceId, input.viewerUserId);
  if (!actor) return { rows: [], total: 0 };
  const take = Math.min(Math.max(1, Math.trunc(input.take ?? 20)), MAX_PAGE);
  const skip = Math.max(0, Math.trunc(input.skip ?? 0));
  const me = actor.userId;
  const whole = input.scope !== "mine" && (actor.role === "OWNER" || actor.role === "ADMIN");
  const filter = whole ? Prisma.empty : Prisma.sql`AND confirmedByUserId IS NOT NULL AND (primaryUserId = ${me} OR escalationUserId = ${me}
    OR JSON_CONTAINS(ccUserIdsJson, JSON_QUOTE(${me})) OR JSON_CONTAINS(reviewerUserIdsJson, JSON_QUOTE(${me})))`;
  const [ids, [{ n }]] = await Promise.all([
    db.$queryRaw<Array<{ id: string }>>`SELECT id FROM CaioAttentionCase WHERE workspaceId = ${input.workspaceId} ${filter}
      ORDER BY (activeKey IS NULL), (effectiveSeverity = 'critical') DESC, createdAt DESC, id DESC LIMIT ${take} OFFSET ${skip}`,
    db.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM CaioAttentionCase WHERE workspaceId = ${input.workspaceId} ${filter}`,
  ]);
  const byId = new Map((ids.length === 0 ? [] : await db.caioAttentionCase.findMany({ where: { id: { in: ids.map((r) => r.id) } } }))
    .map((row) => [row.id, row]));
  const rows = ids.map((r) => byId.get(r.id)).filter((row): row is CaioAttentionCase =>
    row !== undefined && canReadCaioAttentionCase(actor, caioAttentionParties(row)).ok);
  await recordAdminReads(db, actor, rows.map((row) => row.id), "list");
  return { rows, total: Number(n) };
}
